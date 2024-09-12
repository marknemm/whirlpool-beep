import { BN, type Address } from '@coral-xyz/anchor';
import { error, expBackoff, info, numericToString, toBN } from '@npc/core';
import OrcaLiquidityDAO from '@npc/orca/data/orca-liquidity/orca-liquidity.dao';
import env from '@npc/orca/util/env/env';
import { getPositions } from '@npc/orca/util/position/position';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, TransactionContext } from '@npc/solana';
import { Percentage } from '@orca-so/common-sdk';
import { decreaseLiquidityQuoteByLiquidityWithParams, IGNORE_CACHE, TokenExtensionUtil, type Position } from '@orca-so/whirlpools-sdk';
import type { DecreaseLiquidityArgs, DecreaseLiquidityIxSet, DecreaseLiquiditySummary } from './decrease-liquidity.interfaces';

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
): Promise<Map<string, DecreaseLiquiditySummary>> {
  info('\n-- Decrease All liquidity --');

  const txSummaries = new Map<string, DecreaseLiquiditySummary>();

  const bundledPositions = await getPositions({ whirlpoolAddress });
  const divAmount = new BN(amount).div(new BN(bundledPositions.length));

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
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquiditySummary}.
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function decreaseLiquidity(
  position: Position,
  amount: BN | number
): Promise<DecreaseLiquiditySummary> {
  const txCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
    amount: numericToString(amount),
  };

  try {
    const summary = await expBackoff(async (retry) => {
      info('\n-- Decreasing liquidity --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      // Generate instruction data to decrease liquidity
      const ixSet = await genDecreaseLiquidityIxSet({ position, liquidity: amount });

      // Execute and verify the transaction
      const txSummary = await txCtx.send({
        debugData: {
          name: 'Decrease Liquidity',
          ...ixSet.data,
        }
      });

      return { ...txSummary, data: ixSet.data };
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'LiquidityUnderflow', 'TokenMinSubceeded'].includes(errInfo?.name ?? '');
      },
    });

    // Insert the liquidity transaction summary into the database
    await OrcaLiquidityDAO.insert(summary, { catchErrors: true });
    return summary;
  } catch (err) {
    error('Failed to decrease liquidity:', opMetadata);
    throw err;
  }
}

/**
 * Creates {@link DecreaseLiquidityIxSet} to decrease liquidity in a given {@link Position}.
 *
 * @param args The {@link DecreaseLiquidityArgs} for generating the instruction data.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityIxSet}.
 * @throws An {@link Error} if the transaction amount is 0 or greater than position liquidity.
 */
export async function genDecreaseLiquidityIxSet(args: DecreaseLiquidityArgs): Promise<DecreaseLiquidityIxSet> {
  const { position } = args;
  const liquidity = toBN(args.liquidity);

  info('Creating Tx to decrease liquidity:', {
    position: position.getAddress().toBase58(),
    liquidity: numericToString(liquidity),
  });

  if (liquidity.isZero()) {
    throw new Error('Cannot decrease liquidity by zero');
  }

  if (liquidity.gt(position.getData().liquidity)) {
    throw new Error('Cannot decrease liquidity by more than position liquidity: '
      + `${numericToString(liquidity)} > ${numericToString(position.getData().liquidity)}`);
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
    liquidity,
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(env.SLIPPAGE_DEFAULT, 100),
  });

  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
  info('Generated decrease liquidity quote:', {
    position: position.getAddress().toBase58(),
    [`${tokenA.metadata.symbol} Min`]: numericToString(quote.tokenMinA, tokenA.mint.decimals),
    [`${tokenB.metadata.symbol} Min`]: numericToString(quote.tokenMinB, tokenB.mint.decimals),
  });

  const ixSet = (
    await position.decreaseLiquidity(quote)
  ).compressIx(false);

  return {
    ...ixSet,
    data: {
      ...quote,
      positionAddress: position.getAddress(),
      tokenMintPair: [tokenA.mint.publicKey, tokenB.mint.publicKey],
      whirlpoolAddress: position.getData().whirlpool,
    },
  };
}

export type * from './decrease-liquidity.interfaces';
