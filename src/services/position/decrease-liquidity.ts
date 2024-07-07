import { getToken } from '@/services/token/get-token';
import { toStr } from '@/util/currency';
import { debug, info } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient from '@/util/whirlpool-client';
import { BN } from '@coral-xyz/anchor';
import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
import { type DecreaseLiquidityQuote, decreaseLiquidityQuoteByLiquidityWithParams, IGNORE_CACHE, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * Withdraws liquidity from a {@link Position}.
 *
 * @param position The {@link Position} to withdraw liquidity from.
 * @param amount The amount of liquidity to withdraw.
 * @returns A {@link Promise} that resolves to the actual decrease in liquidity.
 * @throws An {@link Error} if the deposit transaction fails to complete.
 */
export async function decreaseLiquidity(position: Position, amount: BN | Decimal): Promise<DecreaseLiquidityQuote> {
  info('\n-- Decreasing liquidity --');

  // Obtain decrease liquidity quote and create transaction
  const quote = await _genDecreaseLiquidityQuote(position, amount);
  const tx = await position.decreaseLiquidity(quote);

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
 * Gen an estimated quote on the minimum tokens available to be withdrawn based on a specified {@link amount}.
 *
 * @param position The {@link Position} to get the withdrawal quote for.
 * @param amount The amount to withdraw.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityQuote}.
 */
async function _genDecreaseLiquidityQuote(
  position: Position,
  amount: Decimal
): Promise<DecreaseLiquidityQuote> {
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

  return quote;
}
