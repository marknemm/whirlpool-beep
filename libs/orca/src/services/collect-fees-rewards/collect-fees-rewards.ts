import { debug, error, expBackoff, info, numericToString } from '@npc/core';
import OrcaFeeDAO from '@npc/orca/data/orca-fee/orca-fee.dao';
import { getPositions, resolvePosition } from '@npc/orca/util/position/position';
import { toTickRangeKeys } from '@npc/orca/util/tick-range/tick-range';
import whirlpoolClient, { formatWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, getToken, TransactionBuilder, TransactionContext } from '@npc/solana';
import { type Address, type Instruction } from '@orca-so/common-sdk';
import { collectFeesQuote, collectRewardsQuote, PoolUtil, TickArrayUtil, TokenExtensionUtil, type CollectFeesQuote, type CollectRewardsQuote, type Position } from '@orca-so/whirlpools-sdk';
import { green } from 'colors';
import type { CollectFeesRewardsArgs, CollectFeesRewardsIxSet, CollectFeesRewardsQuotes, CollectFeesRewardsSummary } from './collect-fees-rewards.interfaces';

/**
 * Collects all fee rewards for all positions.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to collect fees and rewards from.
 * @returns A {@link Promise} that resolves once all fees and rewards are collected.
 */
export async function collectAllFeesRewards(whirlpoolAddress?: Address): Promise<void> {
  info('\n-- Collect All Fees and Rewards --');

  const bundledPositions = await getPositions({ whirlpoolAddress });

  if (!bundledPositions.length) {
    whirlpoolAddress
      ? info('No positions to collect fees and rewards for in whirlpool:', whirlpoolAddress)
      : info('No positions to collect fees and rewards for');
  } else {
    whirlpoolAddress
      ? info(`Collecting fees and rewards for ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
      : info(`Collecting fees and rewards for all ${bundledPositions.length} positions...`);
  }

  const promises = bundledPositions.map(
    (bundledPosition) => collectFeesRewards(bundledPosition.position)
      .catch((err) => error(err))
  );

  await Promise.all(promises);
}

/**
 * Collects the fee reward for a given {@link position}.
 *
 * @param position The {@link Position} to collect the fee reward for.
 * @returns A {@link Promise} that resolves to a {@link CollectFeesRewardsSummary} once the transaction completes.
 */
export async function collectFeesRewards(position: Position): Promise<CollectFeesRewardsSummary | undefined> {
  const txCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  };

  try {
    const summary = await expBackoff(async (retry) => {
      info('\n-- Collect Fees and Rewards --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      const ixSet = await genCollectFeesRewardsIxSet({ position });
      txCtx.setInstructionSet(await genCollectFeesRewardsIxSet({ position }));
      const { instructions } = txCtx;

      if (!instructions.length) {
        info('No fees or rewards to collect:', opMetadata);
        return undefined;
      }

      const txSummary = await new TransactionContext().setInstructionSet(ixSet).send({
        debugData: {
          name: 'Collect Fees and Rewards',
          ...ixSet.data,
        }
      });

      return { ...txSummary, data: ixSet.data };
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp'].includes(errInfo?.name ?? '');
      }
    });

    if (summary) {
      info('Fees and rewards collected:', opMetadata);
      await position.refreshData();
      await OrcaFeeDAO.insert(summary, { catchErrors: true });
    }
    return summary;
  } catch (err) {
    error('Failed to collect fees and rewards:', opMetadata);
    throw err;
  }
}

/**
 * Creates a {@link CollectFeesRewardsIxSet} to collect fees and rewards for a given {@link position}.
 *
 * @param args The {@link CollectFeesRewardsArgs} to use for the operation.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsIxSet}.
 */
export async function genCollectFeesRewardsIxSet(args: CollectFeesRewardsArgs): Promise<CollectFeesRewardsIxSet> {
  let { position, updateFeesAndRewards } = args;
  position = await resolvePosition(position);
  updateFeesAndRewards = updateFeesAndRewards ?? !position.getData().liquidity.isZero();

  info('Creating collect fees and rewards transaction:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });

  await position.refreshData(); // Want accurate data for transaction

  // Generate collect fees and rewards quotes
  const { collectFeesQuote, collectRewardsQuote } = await _genCollectFeesRewardsQuotes(position);

  // Generate collect fees instruction
  let collectFeesIx: Instruction | undefined;
  if (!collectFeesQuote.feeOwedA.isZero() || !collectFeesQuote.feeOwedB.isZero()) {
    const collectFeesTx = await position.collectFees(updateFeesAndRewards);
    collectFeesIx = collectFeesTx.compressIx(true);
  }

  // Generate collect rewards instructions
  const collectRewardsIxs: Instruction[] = [];
  if (collectRewardsQuote.rewardOwed.some((reward) => reward && !reward.isZero())) {
    const collectRewardsTxs = await position.collectRewards(undefined, updateFeesAndRewards);
    collectRewardsIxs.push(...collectRewardsTxs.map((tx) => tx.compressIx(true)));
  }

  // Generate transaction
  const txBuilder = new TransactionBuilder();
  if (collectFeesIx) {
    txBuilder.addInstructionSet(collectFeesIx);
  }
  for (const ix of collectRewardsIxs) {
    txBuilder.addInstructionSet(ix);
  }

  return {
    ...txBuilder.instructionSet,
    data: {
      collectFeesQuote,
      collectRewardsQuote,
      positionAddress: position.getAddress(),
      tokenMintPair: [
        position.getWhirlpoolData().tokenMintA,
        position.getWhirlpoolData().tokenMintB
      ],
    },
  };
}

/**
 * Generates the {@link CollectFeesQuote} and {@link CollectRewardsQuote} for a given {@link position}.
 *
 * @param position The {@link Position} to generate the {@link CollectFeesQuote} and {@link CollectRewardsQuote} for.
 * @returns A {@link Promise} that resolves to an object containing the {@link CollectFeesQuote} and {@link CollectRewardsQuote}.
 */
async function _genCollectFeesRewardsQuotes(
  position: Position
): Promise<CollectFeesRewardsQuotes> {
  const { tickLowerIndex, tickUpperIndex, whirlpool: whirlpoolAddress } = position.getData();
  const { tickSpacing } = position.getWhirlpoolData();
  const accountFetcher = whirlpoolClient().getFetcher();

  const [tickArrayLowerAddress, tickArrayUpperAddress] = toTickRangeKeys(
    whirlpoolAddress,
    [tickLowerIndex, tickUpperIndex],
    tickSpacing
  );

  const tickArrayLower = await accountFetcher.getTickArray(tickArrayLowerAddress);
  const tickArrayUpper = await accountFetcher.getTickArray(tickArrayUpperAddress);
  if (!tickArrayLower || !tickArrayUpper) {
    throw new Error('TickArray not found');
  }

  const tickLower = TickArrayUtil.getTickFromArray(tickArrayLower, tickLowerIndex, tickSpacing);
  const tickUpper = TickArrayUtil.getTickFromArray(tickArrayUpper, tickUpperIndex, tickSpacing);

  const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
    accountFetcher,
    position.getWhirlpoolData()
  );

  const feesQuote = await collectFeesQuote({
    whirlpool: position.getWhirlpoolData(),
    position: position.getData(),
    tickLower,
    tickUpper,
    tokenExtensionCtx,
  });

  const rewardsQuote = await collectRewardsQuote({
    whirlpool: position.getWhirlpoolData(),
    position: position.getData(),
    tickLower,
    tickUpper,
    tokenExtensionCtx,
  });

  for (let i = 0; i < rewardsQuote.rewardOwed.length; i++) {
    const rewardOwed = rewardsQuote.rewardOwed[i];
    const rewardInfo = position.getWhirlpoolData().rewardInfos[i];

    if (PoolUtil.isRewardInitialized(rewardInfo)) {
      const token = await getToken(rewardInfo.mint.toBase58());
      if (!token) continue;

      debug(`Reward ${green(token.metadata.symbol)} ( idx: ${i} ):`, numericToString(
        rewardOwed,
        token.mint.decimals
      ));
    }
  }

  return { collectFeesQuote: feesQuote, collectRewardsQuote: rewardsQuote };
}

export type * from './collect-fees-rewards.interfaces';
