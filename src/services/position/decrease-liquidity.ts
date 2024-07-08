import { getToken } from '@/util/token';
import { toStr } from '@/util/currency';
import { debug, info } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient from '@/util/whirlpool';
import { BN } from '@coral-xyz/anchor';
import { DecimalUtil, Percentage, type TransactionBuilder } from '@orca-so/common-sdk';
import { type DecreaseLiquidityQuote, decreaseLiquidityQuoteByLiquidityWithParams, IGNORE_CACHE, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * Decreases liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @param amount The amount of liquidity to withdraw from the {@link Position}.
 * @returns A {@link Promise} that resolves to the actual decrease in liquidity.
 * @throws An {@link Error} if the deposit transaction fails to complete.
 */
export async function decreaseLiquidity(position: Position, amount: BN | Decimal): Promise<BN> {
  info('\n-- Decreasing liquidity --');

  const { tx } = await decreaseLiquidityTx(position, amount);

  // Execute and verify the transaction
  info('Executing decrease liquidity transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  // Refresh position data and log the actual decrease in liquidity
  const initLiquidity = position.getData().liquidity;
  await position.refreshData();
  const deltaLiquidity = position.getData().liquidity.sub(initLiquidity);
  info('Decreased liquidity by:', toStr(deltaLiquidity));

  return deltaLiquidity;
}

/**
 * Creates a transaction to decrease liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @param amount The amount of liquidity to withdraw from the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function decreaseLiquidityTx(
  position: Position,
  amount: BN | Decimal
): Promise<{ quote: DecreaseLiquidityQuote, tx: TransactionBuilder }> {
  info('Creating Tx to decrease liquidity by:', toStr(amount));

  const tokenA = await getToken(position.getWhirlpoolData().tokenMintA);
  const tokenB = await getToken(position.getWhirlpoolData().tokenMintB);

  if (!tokenA || !tokenB) throw new Error('Token not found');

  const quote = decreaseLiquidityQuoteByLiquidityWithParams({
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      position.getWhirlpoolData(),
      IGNORE_CACHE
    ),
    // Whirlpool state
    sqrtPrice: position.getWhirlpoolData().sqrtPrice,
    tickCurrentIndex: position.getWhirlpoolData().tickCurrentIndex,
    // Position tick (price) range
    tickLowerIndex: position.getData().tickLowerIndex,
    tickUpperIndex: position.getData().tickUpperIndex,
    // Withdraw amount
    liquidity: (amount instanceof BN)
      ? amount
      : DecimalUtil.toBN(amount, tokenB.mint.decimals),
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(1, 100), // 1%
  });

  debug('Decrease liquidity quote:', quote);
  info(`${tokenA.metadata.symbol} min output:`, toStr(quote.tokenMinA, tokenA.mint.decimals));
  info(`${tokenB.metadata.symbol} min output:`, toStr(quote.tokenMinB, tokenB.mint.decimals));

  const tx = await position.decreaseLiquidity(quote);
  return { quote, tx };
}
