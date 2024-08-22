import { BorshCoder, LangErrorCode, LangErrorMessage, Program, type Address, type Idl } from '@coral-xyz/anchor';
import type { Null } from '@npc/core';
import { toBN } from '@npc/core';
import anchor from '@npc/solana/util/anchor/anchor.js';
import rpc from '@npc/solana/util/rpc/rpc.js';
import { DecodeTransactionArgs, type DecodedTransactionIx } from '@npc/solana/util/transaction-query/transaction-query.js';
import { AddressUtil } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, WHIRLPOOL_IDL } from '@orca-so/whirlpools-sdk';
import { DecodedInitializeAccountInstruction, DecodedTransferInstruction, decodeInstruction, TOKEN_PROGRAM_ID, TokenInstruction } from '@solana/spl-token';
import { ComputeBudgetInstruction, ComputeBudgetProgram, SendTransactionError, SystemInstruction, SystemProgram, TransactionInstruction, TransactionMessage, type CompiledInstruction, type ParsedAccountData, type VersionedMessage } from '@solana/web3.js';
import bs58 from 'bs58';
import type { ProgramErrorInfo, TempTokenAccount, TokenTransfer } from './program.interfaces.js';

const _idlCache = new Map<string, Idl>([
  [ORCA_WHIRLPOOL_PROGRAM_ID.toBase58(), WHIRLPOOL_IDL],
]);
const _programCache = new Map<string, Program>();
const _decodedIxCache = new Map<string, DecodedTransactionIx[]>();

/**
 * Gets the {@link Idl} and caches it for a given {@link programId}.
 *
 * @param programId The program {@link Address} to get the {@link Idl} for.
 * @returns The {@link Idl} for the program; `undefined` if the {@link Idl} cannot be fetched.
 */
export async function getIdl<T_Idl extends Idl = Idl>(programId: Address): Promise<T_Idl | undefined> {
  programId = AddressUtil.toString(programId);

  if (!_idlCache.has(programId)) {
    const idl = await Program.fetchIdl(programId, anchor());
    if (idl) {
      _idlCache.set(programId, idl);
    }
  }

  return _idlCache.get(programId) as T_Idl;
}

/**
 * Gets the {@link Program} for a given program {@link Address} or {@link Idl}.
 * Caches the {@link Program} for future retrievals.
 *
 * Does not fetch first-class programs like {@link SystemProgram} or {@link ComputeBudgetProgram}.
 * Only fetches custom (3rd party) programs with an associated {@link Idl}.
 *
 * @param programId The {@link Address} of the {@link Program} to retrieve.
 * @param idl The {@link Idl} of the {@link Program} to retrieve.
 * If not given, the {@link Idl} will be fetched using the {@link programId}.
 * @returns The {@link Program} for the given program {@link Address} or {@link Idl};
 * `undefined` if the {@link Program} cannot be fetched.
 */
async function getProgram<T_Idl extends Idl = Idl>(
  programId: Address | Null,
  idl?: T_Idl
): Promise<Program<T_Idl> | undefined> {
  if (!programId) return;
  const programIdStr = AddressUtil.toString(programId);

  if (!_programCache.has(programIdStr)) {
    idl ??= await getIdl(programId);
    if (!idl) return undefined;

    const program = new Program(idl, programId, anchor());

    if (program) {
      _programCache.set(programIdStr, program as Program);
    }
  }

  return _programCache.get(programIdStr) as Program<T_Idl>;
}

/**
 * Gets the {@link TxProgramErrorInfo} for a given error.
 *
 * @param err The error to get the {@link TxProgramErrorInfo} for.
 * Should typically be a `string`, {@link Error}, or {@link SendTransactionError}.
 * @returns The {@link TxProgramErrorInfo} for the given error, if it exists, otherwise `undefined`.
 */
export function getProgramErrorInfo(err: unknown): ProgramErrorInfo | undefined {
  // Extract error message from error.
  const errMessage = (typeof err === 'string')
    ? err
    : (err instanceof Error)
      ? err.message
      : (err instanceof SendTransactionError)
        ? err.transactionError.message
        : '';

  // Extract error code from error message - can be hex or decimal.
  const errCodeStr = errMessage.match(/(?:anchor|idl|program) error:? ((?:0x)?\d+)/i)?.[1];
  if (!errCodeStr) return;
  const errCode = parseInt(errCodeStr);

  // Smart Contract IDL error.
  if (errCode >= 6000) {
    for (const idl of _idlCache.values()) {
      const error = idl.errors?.find((error) => error.code === errCode);
      if (error) return error;
    }
  }

  // Anchor IDL error.
  return {
    code: errCode,
    msg: LangErrorMessage.get(errCode),
    name: Object.keys(LangErrorCode).find((key) =>
      LangErrorCode[key as keyof typeof LangErrorCode] === errCode
    ) ?? ''
  };
}

/**
 * Decodes an instruction.
 *
 * @param ix The {@link TransactionInstruction} to decode.
 * @param tempTokenAccounts A map of {@link TempTokenAccount}s created during the transaction.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}.
 * @throws If the instruction cannot be decoded.
 */
export async function decodeIx(
  ix: TransactionInstruction,
  tempTokenAccounts: Map<string, TempTokenAccount> = new Map()
): Promise<DecodedTransactionIx> {
  switch (ix.programId.toBase58()) {
    case ComputeBudgetProgram.programId.toBase58(): return decodeComputeBudgetProgramIx(ix);
    case SystemProgram.programId.toBase58():        return decodeSystemProgramIx(ix);
    case TOKEN_PROGRAM_ID.toBase58():               return decodeTokenProgramIx(ix, tempTokenAccounts);
  }

  return decodeProgramIx(ix);
}

/**
 * Gets the decoded instructions of a transaction.
 *
 * @param args The {@link DecodeTransactionArgs} to decode the transaction.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}s.
 */
export async function decodeTransaction(args: DecodeTransactionArgs): Promise<DecodedTransactionIx[]> {
  const { transaction, meta, signature } = args;
  if (_decodedIxCache.has(signature)) { // Grab from cache if it exists
    return _decodedIxCache.get(signature)!;
  }

  const ixs = TransactionMessage.decompile(transaction.message).instructions ?? [];
  const decodedIxs: DecodedTransactionIx[] = [];
  const tempTokenAccounts = new Map<string, TempTokenAccount>();

  for (let i = 0; i < ixs.length; i++) {
    const decodedIx = await decodeIx(ixs[i], tempTokenAccounts);
    if (decodedIx) {
      // Record any potential temp token accounts created during the transaction
      if (decodedIx.programName === 'TokenProgram' && decodedIx.name === 'InitializeAccount') {
        const initAccountData = decodedIx.data as DecodedInitializeAccountInstruction;
        const { account } = initAccountData.keys;
        tempTokenAccounts.set(account.pubkey.toBase58(), initAccountData.keys);
      }

      // Get inner instructions for the instruction if they exist
      const compiledInnerIxs = meta?.innerInstructions?.find(
        (innerIx) => innerIx.index === i
      )?.instructions ?? [];

      // Decode inner instructions
      for (const compiledInnerIx of compiledInnerIxs) {
        const innerIx = _toTransactionInstruction(transaction.message, compiledInnerIx);

        const decodedInnerIx = await decodeIx(innerIx, tempTokenAccounts);
        if (decodedInnerIx) {
          decodedIx.innerInstructions.push(decodedInnerIx);
        }
      }
    }
    decodedIxs.push(decodedIx);
  }

  if (decodedIxs.length) {
    _decodedIxCache.set(signature, decodedIxs);
  }
  return decodedIxs;
}

function _toTransactionInstruction(message: VersionedMessage, compiledIx: CompiledInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: message.getAccountKeys().get(compiledIx.programIdIndex)!,
    keys: compiledIx.accounts.map(
      (accountIndex) => ({
        isSigner: message.isAccountSigner(accountIndex),
        isWritable: message.isAccountWritable(accountIndex),
        pubkey: message.getAccountKeys().get(accountIndex)!,
      })
    ),
    data: Buffer.from(bs58.decode(compiledIx.data)),
  });
}

/**
 * Decodes a {@link ComputeBudgetProgram} instruction.
 *
 * @param ix The {@link TransactionInstruction} to decode.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}.
 * @throws If the instruction is not a {@link ComputeBudgetProgram} instruction or cannot be decoded.
 */
export async function decodeComputeBudgetProgramIx(ix: TransactionInstruction): Promise<DecodedTransactionIx> {
  if (!ComputeBudgetProgram.programId.equals(ix.programId)) {
    throw new Error('Instruction is not a Compute Budget Program instruction');
  }

  const instructionType = ComputeBudgetInstruction.decodeInstructionType(ix);

  const decodedIx: DecodedTransactionIx = {
    data: {},
    innerInstructions: [],
    name: instructionType,
    programName: ComputeBudgetProgram.name,
    programId: ComputeBudgetProgram.programId,
  };

  switch (instructionType) {
    case 'RequestHeapFrame':
    case 'RequestUnits':        break; // No data to decode
    case 'SetComputeUnitLimit': decodedIx.data = ComputeBudgetInstruction.decodeSetComputeUnitLimit(ix);  break;
    case 'SetComputeUnitPrice': decodedIx.data = ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix);  break;
    default:                    throw new Error(`Unknown Compute Budget Program Instruction: ${instructionType}`);
  }

  return decodedIx;
}

/**
 * Decodes a {@link Program} instruction using its associated on-chain program {@link Idl}.
 *
 * @param ix The {@link TransactionInstruction} to decode.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}.
 * @throws If the instruction cannot be decoded.
 */
export async function decodeProgramIx(ix: TransactionInstruction): Promise<DecodedTransactionIx> {
  const program = await getProgram(ix.programId);
  if (!program) throw new Error('Failed to fetch Program for instruction');

  const decodedIx: DecodedTransactionIx = {
    data: {},
    innerInstructions: [],
    name: program.idl.name,
    programName: program.idl.name,
    programId: program.programId,
  };

  const { idl } = program;
  if (idl) {
    const coder = new BorshCoder(idl);
    const decodedData = coder.instruction.decode(ix.data, 'base58');

    if (decodedData) {
      decodedIx.data = decodedData.data;
      decodedIx.name = decodedData.name;
    }
  }

  return decodedIx;
}

/**
 * Decodes a {@link SystemProgram} instruction.
 *
 * @param ix The {@link TransactionInstruction} to decode.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}.
 * @throws If the instruction is not a {@link SystemProgram} instruction or cannot be decoded.
 */
export async function decodeSystemProgramIx(ix: TransactionInstruction): Promise<DecodedTransactionIx> {
  if (!SystemProgram.programId.equals(ix.programId)) {
    throw new Error('Instruction is not a System Program instruction');
  }

  const instructionType = SystemInstruction.decodeInstructionType(ix);

  const decodedIx: DecodedTransactionIx = {
    data: {},
    innerInstructions: [],
    name: instructionType,
    programName: SystemProgram.name,
    programId: SystemProgram.programId,
  };

  switch (instructionType) {
    case 'Create':                  decodedIx.data = SystemInstruction.decodeCreateAccount(ix);   break;
    case 'Assign':                  decodedIx.data = SystemInstruction.decodeAssign(ix);          break;
    case 'Transfer':                decodedIx.data = SystemInstruction.decodeTransfer(ix);        break;
    case 'CreateWithSeed':          decodedIx.data = SystemInstruction.decodeCreateWithSeed(ix);  break;
    case 'AdvanceNonceAccount':     decodedIx.data = SystemInstruction.decodeNonceAdvance(ix);    break;
    case 'WithdrawNonceAccount':    decodedIx.data = SystemInstruction.decodeNonceWithdraw(ix);   break;
    case 'InitializeNonceAccount':  decodedIx.data = SystemInstruction.decodeNonceInitialize(ix); break;
    case 'AuthorizeNonceAccount':   decodedIx.data = SystemInstruction.decodeNonceAuthorize(ix);  break;
    default:                        throw new Error(`Unknown System Program Instruction: ${instructionType}`);
  }

  return decodedIx;
}

/**
 * Decodes a `TokenProgram` instruction.
 *
 * @param ix The {@link TransactionInstruction} to decode.
 * @param tempTokenAccounts A map of {@link TempTokenAccount}s created during the transaction.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}.
 * @throws If the instruction is not a `TokenProgram` instruction or cannot be decoded.
 */
export async function decodeTokenProgramIx(
  ix: TransactionInstruction,
  tempTokenAccounts: Map<string, TempTokenAccount> = new Map()
): Promise<DecodedTransactionIx> {
  if (!TOKEN_PROGRAM_ID.equals(ix.programId)) {
    throw new Error('Instruction is not a Token Program instruction');
  }

  const decodedTokenIx = decodeInstruction(ix);

  return {
    data: (decodedTokenIx.data.instruction === TokenInstruction.Transfer)
      ? await _extendTokenTransferIxData(decodedTokenIx as DecodedTransferInstruction, tempTokenAccounts)
      : { ...decodedTokenIx.data, keys: decodedTokenIx.keys },
    innerInstructions: [],
    name: TokenInstruction[decodedTokenIx.data.instruction],
    programName: 'TokenProgram',
    programId: TOKEN_PROGRAM_ID,
  };
}

async function _extendTokenTransferIxData(
  ix: DecodedTransferInstruction,
  tempTokenAccounts: Map<string, TempTokenAccount>
): Promise<TokenTransfer> {
  const ixData: TokenTransfer = {
    amount: toBN(ix.data.amount),
    keys: {
      ...ix.keys,
      destinationOwner: '',
      sourceOwner: '',
      mint: '',
    },
  };

  // Derive the owner (wallet account) of the source token account (ATA)
  const srcPublicKey = ixData.keys.source.pubkey;
  const srcAddrStr = srcPublicKey.toBase58();
  const srcTokenAccount = await rpc().getParsedAccountInfo(srcPublicKey);
  ixData.keys.sourceOwner = tempTokenAccounts.get(srcAddrStr)?.owner.pubkey.toBase58()
                         ?? (srcTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.owner
                         ?? srcAddrStr;

  // Derive the owner (wallet account) of the destination token account (ATA)
  const destPublicKey = ixData.keys.destination.pubkey;
  const destAddrStr = destPublicKey.toBase58();
  const destTokenAccount = await rpc().getParsedAccountInfo(destPublicKey);
  ixData.keys.destinationOwner = tempTokenAccounts.get(destAddrStr)?.owner.pubkey.toBase58()
                              ?? (destTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.owner
                              ?? destAddrStr;

  // Derive the mint of the transfer token
  ixData.keys.mint = tempTokenAccounts.get(srcAddrStr)?.mint.pubkey.toBase58()
                  ?? tempTokenAccounts.get(destAddrStr)?.mint.pubkey.toBase58()
                  ?? (srcTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.mint
                  ?? (destTokenAccount.value?.data as ParsedAccountData)?.parsed?.info?.mint;

  return ixData;
}

export type * from './program.interfaces.js';
