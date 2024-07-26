import type { TxProgramErrorInfo } from '@/interfaces/error';
import { LangErrorCode, LangErrorMessage } from '@coral-xyz/anchor';
import { WHIRLPOOL_IDL } from '@orca-so/whirlpools-sdk';
import { SendTransactionError } from '@solana/web3.js';

/**
 * Gets the {@link TxProgramErrorInfo} for a given error.
 *
 * @param err The error to get the {@link TxProgramErrorInfo} for.
 * Should typically be a `string`, {@link Error}, or {@link SendTransactionError}.
 * @returns The {@link TxProgramErrorInfo} for the given error, if it exists, otherwise `undefined`.
 */
export function getTxProgramErrorInfo(err: unknown): TxProgramErrorInfo | undefined {
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

  // Smart Contract (Orca Whirlpool) IDL error.
  if (errCode >= 6000) {
    return WHIRLPOOL_IDL.errors?.find((error) => error.code === errCode);
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
