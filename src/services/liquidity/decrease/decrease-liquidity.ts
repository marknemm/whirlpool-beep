import LiquidityTxDAO from '@/data/liquidity-tx/liquidity-tx.dao';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import { genLiquidityTxSummary } from '@/services/liquidity/util/liquidity';
import { getPositions } from '@/services/position/query/query-position';
import { expBackoff } from '@/util/async/async';
import env from '@/util/env/env';
import { error, info } from '@/util/log/log';
import { toBN, toStr } from '@/util/number-conversion/number-conversion';
import { getProgramErrorInfo } from '@/util/program/program';
import TransactionContext from '@/util/transaction-context/transaction-context';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { type Address, type BN } from '@coral-xyz/anchor';
import { Percentage } from '@orca-so/common-sdk';
import { decreaseLiquidityQuoteByLiquidityWithParams, IGNORE_CACHE, TokenExtensionUtil, type Position } from '@orca-so/whirlpools-sdk';
import { DecreaseLiquidityIxData } from './decrease-liquidity.interfaces';

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
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function decreaseLiquidity(
  position: Position,
  amount: BN | number
): Promise<LiquidityTxSummary> {
  const transactionCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
    amount: toStr(amount),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Decreasing liquidity --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      // Generate instruction data to decrease liquidity
      const decreaseLiquidityIxData = await genDecreaseLiquidityIxData(position, amount);
      const { quote } = decreaseLiquidityIxData;

      // Execute and verify the transaction
      const { signature } = await transactionCtx
        .resetInstructionData(decreaseLiquidityIxData)
        .send();

      // Get Liquidity tx summary and insert into DB
      const txSummary = await genLiquidityTxSummary(position, signature, quote);
      await LiquidityTxDAO.insert(txSummary, { catchErrors: true });

      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'LiquidityUnderflow', 'TokenMinSubceeded'].includes(errInfo?.name ?? '');
      },
    });
  } catch (err) {
    error('Failed to decrease liquidity:', opMetadata);
    throw err;
  }
}

/**
 * Creates {@link DecreaseLiquidityIxData} to decrease liquidity in a given {@link Position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @param amount The amount of liquidity to withdraw from the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityIxData}.
 * @throws An {@link Error} if the transaction amount is 0 or greater than position liquidity.
 */
export async function genDecreaseLiquidityIxData(
  position: Position,
  amount: BN | number
): Promise<DecreaseLiquidityIxData> {
  info('Creating Tx to decrease liquidity:', {
    position: position.getAddress().toBase58(),
    amount: toStr(amount),
  });

  if (toBN(amount).isZero()) {
    throw new Error('Cannot decrease liquidity by zero');
  }

  if (toBN(amount).gt(position.getData().liquidity)) {
    throw new Error('Cannot decrease liquidity by more than position liquidity: '
      + `${toStr(amount)} > ${toStr(position.getData().liquidity)}`);
  }

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
  info('Generated decrease liquidity quote:', {
    position: position.getAddress().toBase58(),
    [`${tokenA.metadata.symbol} Min`]: toStr(quote.tokenMinA, tokenA.mint.decimals),
    [`${tokenB.metadata.symbol} Min`]: toStr(quote.tokenMinB, tokenB.mint.decimals),
  });

  const tx = await position.decreaseLiquidity(quote);
  return {
    ...tx.compressIx(false),
    positionAddress: position.getAddress(),
    quote,
    whirlpoolAddress: position.getData().whirlpool,
    debugData: {
      name: 'Decrease Liquidity',
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
      [`${tokenA.metadata.symbol} Min`]: toStr(quote.tokenMinA, tokenA.mint.decimals),
      [`${tokenB.metadata.symbol} Min`]: toStr(quote.tokenMinB, tokenB.mint.decimals),
    }
  };
}

export type * from './decrease-liquidity.interfaces';
