import anchor from '@/util/anchor/anchor';
import rpc from '@/util/rpc/rpc';
import { DecodedTransactionIx } from '@/util/transaction/transaction.interfaces';
import { BorshCoder, Program, type Address, type Idl } from '@coral-xyz/anchor';
import { AddressUtil } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk';
import { IDL } from '@orca-so/whirlpools-sdk/dist/artifacts/whirlpool';
import { ComputeBudgetProgram, PublicKey, type ParsedAccountData, type ParsedInstruction, type PartiallyDecodedInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
import type { TempTokenAccount, SplTokenTransferIxData } from './program.interfaces';

const _idlCache = new Map<string, Idl>([
  [ORCA_WHIRLPOOL_PROGRAM_ID.toBase58(), IDL],
]);

/**
 * Gets the {@link Idl} and caches it for a given {@link programId}.
 *
 * @param programId The program {@link Address} to get the {@link Idl} for.
 * @returns The {@link Idl} for the program; `undefined` if the {@link Idl} cannot be fetched.
 */
export async function getIdl(programId: Address): Promise<Idl | undefined> {
  programId = AddressUtil.toString(programId);

  if (!_idlCache.has(programId)) {
    const idl = await Program.fetchIdl(programId, anchor());
    if (idl) {
      _idlCache.set(programId, idl);
    }
  }

  return _idlCache.get(programId);
}

/**
 * Decodes an instruction using its associated on-chain program {@link Idl}.
 *
 * @param ix The instruction to decode.
 * @param tempTokenAccounts A map of temp token accounts created during the transaction.
 * @returns A {@link Promise} that resolves to the decoded instruction; `null` if the instruction cannot be decoded.
 */
export async function decodeIx(
  ix: PartiallyDecodedInstruction | ParsedInstruction,
  tempTokenAccounts: Map<string, TempTokenAccount> = new Map()
): Promise<DecodedTransactionIx> {
  if (!(ix as PartiallyDecodedInstruction).data && (ix as ParsedInstruction).parsed) {
    const parsedIx = ix as ParsedInstruction;

    if (parsedIx.program === 'spl-token' && parsedIx.parsed.type === 'transfer') {
      return _decodeTransferIx(parsedIx, tempTokenAccounts); // Add more information to data
    }

    return {
      programName: parsedIx.program,
      innerInstructions: [],
      name: parsedIx.parsed.type ?? parsedIx.program,
      data: parsedIx.parsed.info ?? parsedIx.parsed,
    };
  }

  if (ComputeBudgetProgram.programId.equals(ix.programId)) {
    return {
      programName: 'computeBudget',
      innerInstructions: [],
      name: 'computeBudget',
      data: {},
    };
  }

  const idl = await getIdl(ix.programId);

  if (idl) {
    const coder = new BorshCoder(idl);
    const { data } = (ix as PartiallyDecodedInstruction);
    if (data) {
      return {
        programName: idl.name,
        innerInstructions: [],
        ...coder.instruction.decode(data, 'base58')!
      };
    }
  }

  return { programName: ix.programId.toBase58(), innerInstructions: [], name: 'unknown', data: {} };
}

async function _decodeTransferIx(
  ix: ParsedInstruction,
  tempTokenAccounts: Map<string, TempTokenAccount>
): Promise<DecodedTransactionIx> {
  const data: SplTokenTransferIxData = ix.parsed.info;
  data.amount = new BN(data.amount);

  const srcPublicKey = new PublicKey(data.source);
  const srcTokenAccount = await rpc().getParsedAccountInfo(srcPublicKey);
  data.sourceOwner = (srcTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.owner
                  ?? tempTokenAccounts.get(data.source)?.owner
                  ?? data.source;

  const destPublicKey = new PublicKey(data.destination);
  const destTokenAccount = await rpc().getParsedAccountInfo(destPublicKey);
  data.destinationOwner = (destTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.owner
                       ?? tempTokenAccounts.get(data.destination)?.owner
                       ?? data.destination;

  data.mint = (srcTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.mint
           ?? (destTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.mint
           ?? tempTokenAccounts.get(data.source)?.mint;

  return {
    data,
    innerInstructions: [],
    name: 'transfer',
    programName: 'spl-token',
  };
}

export type * from './program.interfaces';
