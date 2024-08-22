import { debug, error, expBackoff, info, toStr } from '@npc/core';
import OrcaFeeDAO from '@npc/orca/data/orca-fee/orca-fee.dao.js';
import { getPositions } from '@npc/orca/services/position/query/query-position.js';
import { toTickRangeKeys } from '@npc/orca/util/tick-range/tick-range.js';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@npc/orca/util/whirlpool/whirlpool.js';
import { getProgramErrorInfo, getToken, getTransferTotalsFromIxs, getTxSummary, rpc, SendTransactionResult, TransactionContext, wallet } from '@npc/solana';
import { TransactionBuilder, type Address, type Instruction } from '@orca-so/common-sdk';
import { collectFeesQuote, collectRewardsQuote, PoolUtil, TickArrayUtil, TokenExtensionUtil, type CollectFeesQuote, type CollectRewardsQuote, type Position } from '@orca-so/whirlpools-sdk';
import BN from 'bn.js';
import colors from 'colors';
import type { CollectFeesRewardsIxData, CollectFeesRewardsQuotes, CollectFeesRewardsTxSummary } from './collect-fees-rewards.interfaces.js';

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
 * @returns A {@link Promise} that resolves to a {@link CollectFeesRewardsTxSummary} once the transaction completes.
 */
export async function collectFeesRewards(position: Position): Promise<CollectFeesRewardsTxSummary | undefined> {
  const transactionCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Collect Fees and Rewards --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      const collectFeesRewardsIxData = await genCollectFeesRewardsIxData(position);
      const { instructions } = collectFeesRewardsIxData;

      if (!instructions.length) {
        info('No fees or rewards to collect:', {
          whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
          position: position.getAddress().toBase58(),
        });
        return undefined;
      }

      const sendResult = await transactionCtx
        .resetInstructionData(collectFeesRewardsIxData)
        .send();
      await position.refreshData();

      const txSummary = await genCollectFeesRewardsTxSummary(position, sendResult);
      await OrcaFeeDAO.insert(txSummary, { catchErrors: true });

      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp'].includes(errInfo?.name ?? '');
      }
    });
  } catch (err) {
    error('Failed to collect fees and rewards:', opMetadata);
    throw err;
  }
}

/**
 * Creates {@link CollectFeesRewardsIxData} to collect fees and rewards for a given {@link position}.
 *
 * @param position The {@link Position} to collect fees and rewards for.
 * @param updateFeesAndRewards Whether to update the fees and rewards for the position.
 * Defaults to whether or not the position has liquidity.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsIxData}.
 */
export async function genCollectFeesRewardsIxData(
  position: Position,
  updateFeesAndRewards = !position.getData().liquidity.isZero()
): Promise<CollectFeesRewardsIxData> {
  info('Creating collect fees and rewards transaction:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });

  await position.refreshData(); // Want accurate data for transaction
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());

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
  const tx = new TransactionBuilder(rpc(), wallet());
  if (collectFeesIx) {
    tx.addInstruction(collectFeesIx);
  }
  collectRewardsIxs.forEach((ix) => tx.addInstruction(ix));

  return {
    ...tx.compressIx(false),
    collectFeesQuote,
    collectRewardsQuote,
    debugData: {
      name: 'Collect Fees and Rewards',
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
      [`${tokenA.metadata.symbol} Fee Estimate:`]: toStr(collectFeesQuote.feeOwedA, tokenA.mint.decimals),
      [`${tokenB.metadata.symbol} Fee Estimate:`]: toStr(collectFeesQuote.feeOwedB, tokenB.mint.decimals),
    }
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

      debug(`Reward ${colors.green(token.metadata.symbol)} ( idx: ${i} ):`, toStr(rewardOwed, token.mint.decimals));
    }
  }

  return { collectFeesQuote: feesQuote, collectRewardsQuote: rewardsQuote };
}

/**
 * Generates a {@link CollectFeesRewardsTxSummary} for a collect fees / rewards transaction.
 *
 * @param position The {@link Position} to get the {@link CollectFeesRewardsTxSummary} for.
 * @param sendResult The {@link SendTransactionResult} of the collection transaction.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsTxSummary}.
 */
export async function genCollectFeesRewardsTxSummary(
  position: Position,
  sendResult: SendTransactionResult,
): Promise<CollectFeesRewardsTxSummary> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
  const txSummary = await getTxSummary(sendResult);

  const feesRewardsIx = txSummary.decodedIxs.find(
    (ix) => ix.name.toLowerCase().includes('fee')
  );
  if (!feesRewardsIx) throw new Error('No collect fees / rewards instruction found in transaction');
  const { tokenTotals, usd } = await getTransferTotalsFromIxs([feesRewardsIx]);

  const feesRewardsTxSummary: CollectFeesRewardsTxSummary = {
    position,
    tokenAmountA: tokenTotals.get(tokenA.mint.publicKey) ?? new BN(0),
    tokenAmountB: tokenTotals.get(tokenB.mint.publicKey) ?? new BN(0),
    ...txSummary,
    usd,
  };

  info('Fees and rewards tx summary:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
    [tokenA.metadata.symbol]: toStr(feesRewardsTxSummary.tokenAmountA, tokenA.mint.decimals),
    [tokenB.metadata.symbol]: toStr(feesRewardsTxSummary.tokenAmountB, tokenB.mint.decimals),
    usd: `$${feesRewardsTxSummary.usd}`,
    fee: toStr(feesRewardsTxSummary.fee),
    signature: feesRewardsTxSummary.signature,
  });

  return feesRewardsTxSummary;
}

export type * from './collect-fees-rewards.interfaces.js';
