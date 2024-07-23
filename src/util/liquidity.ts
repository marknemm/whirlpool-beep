import type { LiquidityTxSummary } from '@/interfaces/liquidity';
import { info } from '@/util/log';
import { toStr } from '@/util/number-conversion';
import { getTransactionSummary } from '@/util/transaction';
import { getWhirlpoolTokenPair } from '@/util/whirlpool';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { type DecreaseLiquidityQuote, type IncreaseLiquidityQuote, type Position } from '@orca-so/whirlpools-sdk';
import BN from 'bn.js';
import { green } from 'colors';

/**
 * Generates {@link LiquidityTxSummary}.
 *
 * @param position The {@link Position} to get the {@link LiquidityTxSummary} for.
 * @param signature The signature of the transaction that changed the liquidity.
 * @param quote The {@link DecreaseLiquidityQuote} or {@link IncreaseLiquidityQuote} for the transaction.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 */
export async function genLiquidityTxSummary(
  position: Position,
  signature: string,
  quote?: DecreaseLiquidityQuote | IncreaseLiquidityQuote
): Promise<LiquidityTxSummary> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());

  const txSummary = await getTransactionSummary(signature, [tokenA.mint.publicKey, tokenB.mint.publicKey]);

  const liquidityDelta: LiquidityTxSummary = {
    fee: txSummary.fee,
    position,
    quote,
    signature,
    tokenAmountA: txSummary.tokens.get(tokenA.mint.publicKey)?.neg() ?? new BN(0),
    tokenAmountB: txSummary.tokens.get(tokenB.mint.publicKey)?.neg() ?? new BN(0),
    usd: txSummary.usd * -1, // Tx data is in relationship to wallet, so negate to get flow in/out of pool
  };

  _logLiquidityTxSummary(liquidityDelta, tokenA, tokenB);
  return liquidityDelta;
}

function _logLiquidityTxSummary(txSummary: LiquidityTxSummary, tokenA: DigitalAsset, tokenB: DigitalAsset): void {
  const logVerb = txSummary.usd > 0 ? 'Deposited' : 'Withdrew';

  info(`${logVerb} ${green(`'${tokenA.metadata.symbol}'`)} liquidity:`,
    toStr(txSummary.tokenAmountA.abs(), tokenA.mint.decimals));

  info(`${logVerb} ${green(`'${tokenB.metadata.symbol}'`)} liquidity:`,
    toStr(txSummary.tokenAmountB.abs(), tokenB.mint.decimals));
}
