import { BorshCoder, LangErrorCode, LangErrorMessage, Program, type Address, type Idl } from '@coral-xyz/anchor';
import { numericToBN, type Null } from '@npc/core';
import { toPubKeyStr } from '@npc/solana/util/address/address';
import anchor from '@npc/solana/util/anchor/anchor';
import rpc from '@npc/solana/util/rpc/rpc';
import { ASSOCIATED_TOKEN_PROGRAM_ID, DecodedInitializeAccountInstruction, DecodedTransferInstruction, decodeInstruction, TOKEN_PROGRAM_ID, TokenInstruction } from '@solana/spl-token';
import { ComputeBudgetInstruction, ComputeBudgetProgram, SendTransactionError, SystemInstruction, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction, type ParsedAccountData } from '@solana/web3.js';
import bs58 from 'bs58';
import type { DecodedTransactionIx, ProgramErrorInfo, QueriedTransaction, TempTokenAccount, TokenTransfer } from './program.interfaces';

  const _idlCache = new Map<string, Idl>();
  const _programCache = new Map<string, Program>();
  const _decodedIxCache = new Map<string, DecodedTransactionIx[]>();

/**
 * Caches the {@link Idl} for a given {@link programId}.
 *
 * @param programId The program {@link Address} to cache the {@link Idl} for.
 * @param idl The {@link Idl} to cache.
 */
export function cacheIdl(programId: Address, idl: Idl) {
  _idlCache.set(toPubKeyStr(programId), idl);
}

/**
 * Gets the {@link Idl} and caches it for a given {@link programId}.
 *
 * @param programId The program {@link Address} to get the {@link Idl} for.
 * @returns The {@link Idl} for the program; `undefined` if the {@link Idl} cannot be fetched.
 */
export async function getIdl<T_Idl extends Idl = Idl>(programId: Address): Promise<T_Idl | undefined> {
  programId = toPubKeyStr(programId);

  if (!_idlCache.has(programId)) {
    const idl = await Program.fetchIdl(programId, anchor());
    if (idl) {
      cacheIdl(programId, idl);
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
export async function getProgram<T_Idl extends Idl = Idl>(
  programId: Address | Null,
  idl?: T_Idl
): Promise<Program<T_Idl> | undefined> {
  if (!programId) return;
  const programIdStr = toPubKeyStr(programId);

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
    case ASSOCIATED_TOKEN_PROGRAM_ID.toBase58():    return _decodeAssociatedTokenProgramIx(ix);
    case ComputeBudgetProgram.programId.toBase58(): return _decodeComputeBudgetProgramIx(ix);
    case SystemProgram.programId.toBase58():        return _decodeSystemProgramIx(ix);
    case TOKEN_PROGRAM_ID.toBase58():               return _decodeTokenProgramIx(ix, tempTokenAccounts);
  }

  return _decodeProgramIx(ix);
}

/**
 * Gets the decoded instructions of a given {@link transaction}.
 *
 * @param transaction The {@link QueriedTransaction}, {@link Transaction}, or {@link VersionedTransaction} to decode.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}s.
 */
export async function decodeTransaction(
  transaction: QueriedTransaction | Transaction | VersionedTransaction
): Promise<DecodedTransactionIx[]> {
  const isQueriedTransaction = !(transaction instanceof Transaction)
                            && !(transaction instanceof VersionedTransaction);

  // If cached decoded QueriedTransaction, return it
  if (isQueriedTransaction && _decodedIxCache.has(transaction.signature)) {
    return _decodedIxCache.get(transaction.signature)!;
  }

  const decodedIxs: DecodedTransactionIx[] = [];
  const tempTokenAccounts = new Map<string, TempTokenAccount>();

  // Grab TransactionInstructions, decompile if necessary
  const ixs = (transaction instanceof Transaction)
    ? transaction.instructions
    : TransactionMessage.decompile(transaction.message).instructions ?? [];

  // Decode all instructions
  for (let i = 0; i < ixs.length; i++) {
    // Decoded instruction
    const decodedIx = await decodeIx(ixs[i], tempTokenAccounts);
    decodedIxs.push(decodedIx);

    // Record any (temp) token accounts created during the transaction
    if (decodedIx.programName === 'TokenProgram' && decodedIx.name === 'InitializeAccount') {
      const initAccountData = decodedIx.data as DecodedInitializeAccountInstruction;
      const { account } = initAccountData.keys;
      tempTokenAccounts.set(account.pubkey.toBase58(), initAccountData.keys);
    }

    // Decode inner instructions if QueriedTransaction
    if (isQueriedTransaction) {
      decodedIx.innerInstructions = await _decodeInnerIxs(transaction, i, tempTokenAccounts);
    }
  }

  // Cache decoded instructions from queried on-chain transactions
  if (isQueriedTransaction && decodedIxs.length) {
    _decodedIxCache.set(transaction.signature, decodedIxs);
  }
  return decodedIxs;
}

/**
 * Decodes inner instructions for a given {@link transaction}.
 *
 * @param transaction The on-chain {@link QueriedTransaction} to decode inner instructions for.
 * @param outerIxIdx The index of the outer instruction to decode inner instructions for.
 * @param tempTokenAccounts A map of {@link TempTokenAccount}s created during the transaction.
 * @returns A {@link Promise} that resolves to the inner {@link DecodedTransactionIx}s.
 */
async function _decodeInnerIxs(
  transaction: QueriedTransaction,
  outerIxIdx: number,
  tempTokenAccounts: Map<string, TempTokenAccount>
): Promise<DecodedTransactionIx[]> {
  const { message, meta } = transaction;
  const decodedIxs: DecodedTransactionIx[] = [];

  // Get inner instructions for the instruction if they exist
  const compiledInnerIxs = meta?.innerInstructions?.find(
    (innerIx) => innerIx.index === outerIxIdx
  )?.instructions ?? [];

  // Decode inner instructions
  for (const compiledInnerIx of compiledInnerIxs) {
    const innerIx = new TransactionInstruction({
      programId: message.getAccountKeys().get(compiledInnerIx.programIdIndex)!,
      keys: compiledInnerIx.accounts.map(
        (accountIndex) => ({
          isSigner: message.isAccountSigner(accountIndex),
          isWritable: message.isAccountWritable(accountIndex),
          pubkey: message.getAccountKeys().get(accountIndex)!,
        })
      ),
      data: Buffer.from(bs58.decode(compiledInnerIx.data)),
    });

    const decodedInnerIx = await decodeIx(innerIx, tempTokenAccounts);
    decodedIxs.push(decodedInnerIx);
  }

  return decodedIxs;
}

/**
 * Decodes an {@link AssociatedTokenProgram} instruction.
 *
 * @param ix The {@link TransactionInstruction} to decode.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}.
 * @throws If the instruction is not an {@link AssociatedTokenProgram} instruction or cannot be decoded.
 */
async function _decodeAssociatedTokenProgramIx(ix: TransactionInstruction): Promise<DecodedTransactionIx> {
  if (!ASSOCIATED_TOKEN_PROGRAM_ID.equals(ix.programId)) {
    throw new Error('Instruction is not an Associated Token Program instruction');
  }

  // Manually decode the instruction
  const decodedTransactionIx = {
    data: {
      payer: ix.keys[0].pubkey.toBase58(),
      associatedTokenAccount: ix.keys[1].pubkey.toBase58(),
      walletAddress: ix.keys[2].pubkey.toBase58(),
      tokenMintAddress: ix.keys[3].pubkey.toBase58(),
    },
    innerInstructions: [],
    name: 'CreateAssociatedTokenAccount',
    programName: 'AssociatedTokenProgram',
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
  };

  return decodedTransactionIx;
}

/**
 * Decodes a {@link ComputeBudgetProgram} instruction.
 *
 * @param ix The {@link TransactionInstruction} to decode.
 * @returns A {@link Promise} that resolves to the {@link DecodedTransactionIx}.
 * @throws If the instruction is not a {@link ComputeBudgetProgram} instruction or cannot be decoded.
 */
async function _decodeComputeBudgetProgramIx(ix: TransactionInstruction): Promise<DecodedTransactionIx> {
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
async function _decodeProgramIx(ix: TransactionInstruction): Promise<DecodedTransactionIx> {
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
async function _decodeSystemProgramIx(ix: TransactionInstruction): Promise<DecodedTransactionIx> {
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
async function _decodeTokenProgramIx(
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
    amount: numericToBN(ix.data.amount),
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

export type * from './program.interfaces';
