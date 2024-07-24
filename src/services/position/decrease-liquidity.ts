import LiquidityTxDAO from '@/data/liquidity-tx-dao';
import { LiquidityTxSummary } from '@/interfaces/liquidity';
import { getPositions } from '@/services/position/get-position';
import env from '@/util/env';
import { genLiquidityTxSummary } from '@/util/liquidity';
import { error, info } from '@/util/log';
import { toBN, toStr } from '@/util/number-conversion';
import { executeTransaction } from '@/util/transaction';
import whirlpoolClient, { getWhirlpoolTokenPair } from '@/util/whirlpool';
import { BN } from '@coral-xyz/anchor';
import { type Address, Percentage, type TransactionBuilder } from '@orca-so/common-sdk';
import { type DecreaseLiquidityQuote, decreaseLiquidityQuoteByLiquidityWithParams, IGNORE_CACHE, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';

/**
 * Decreases liquidity of all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to decrease liquidity in.
 * @param amount The amount of liquidity to withdraw from the {@link Whirlpool}. Divided evenly among open positions.
 * @returns A {@link Promise} that resolves to a {@link Map} of {@link Position} addresses to {@link LiquidityTxSummary}s.
 */
export async function decreaseAllLiquidity(
  whirlpoolAddress: Address,
  amount: BN | number
): Promise<Map<string, LiquidityTxSummary>> {
  info('\n-- Decrease All liquidity --');

  const txSummaries = new Map<string, LiquidityTxSummary>();

  const bundledPositions = await getPositions({ whirlpoolAddress });
  const divAmount = toBN(amount).div(toBN(bundledPositions.length));

  bundledPositions.length
    ? info(`Decreasing liquidity of ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info('No positions to decrease liquidity of in whirlpool:', whirlpoolAddress);

  const promises = bundledPositions.map(async ({ position }) => {
    const txSummary = await decreaseLiquidity(position, divAmount)
      .catch((err) => { error(err); });

    if (txSummary) {
      txSummaries.set(position.getAddress().toBase58(), txSummary);
    }
  });

  await Promise.all(promises);
  return txSummaries;
}

/**
 * Decreases liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @param amount The amount of liquidity to withdraw from the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 * @throws An {@link Error} if the deposit transaction fails to complete.
 */
export async function decreaseLiquidity(
  position: Position,
  amount: BN | number
): Promise<LiquidityTxSummary> {
  info('\n-- Decreasing liquidity --');

  if (toBN(amount).isZero()) {
    throw new Error('Cannot decrease liquidity by zero');
  }

  if (toBN(amount).gt(position.getData().liquidity)) {
    throw new Error('Cannot decrease liquidity by more than current liquidity: '
      + `${toStr(amount)} > ${toStr(position.getData().liquidity)}`);
  }

  // Generate transaction to decrease liquidity
  const { quote, tx } = await genDecreaseLiquidityTx(position, amount);

  // Execute and verify the transaction
  info('Executing decrease liquidity transaction...');
  const signature = await executeTransaction(tx);

  // Get Liquidity tx summary and insert into DB
  const txSummary = await genLiquidityTxSummary(position, signature, quote);
  LiquidityTxDAO.insert(txSummary, { catchErrors: true });

  return txSummary;
}

/**
 * Creates a transaction to decrease liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @param amount The amount of liquidity to withdraw from the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genDecreaseLiquidityTx(
  position: Position,
  amount: BN | number
): Promise<{ quote: DecreaseLiquidityQuote, tx: TransactionBuilder }> {
  info('Creating Tx to decrease liquidity by:', toStr(amount));

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
    liquidity: toBN(amount),
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(env.SLIPPAGE_DEFAULT, 100),
  });

  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
  if (!tokenA || !tokenB) throw new Error('Token not found');

  info(`${tokenA?.metadata.symbol} min output:`, toStr(quote.tokenMinA, tokenA?.mint.decimals));
  info(`${tokenB?.metadata.symbol} min output:`, toStr(quote.tokenMinB, tokenB?.mint.decimals));

  const tx = await position.decreaseLiquidity(quote);
  return { quote, tx };
}
