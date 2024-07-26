import FeeRewardTxDAO from '@/data/fee-reward-tx-dao';
import type { FeesRewardsTxSummary } from '@/interfaces/fees-rewards';
import { getPositions } from '@/services/position/get-position';
import { expBackoff } from '@/util/async';
import { getTxProgramErrorInfo } from '@/util/error';
import { debug, error, info } from '@/util/log';
import { toStr } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import { getToken } from '@/util/token';
import { executeTransaction, getTransactionSummary } from '@/util/transaction';
import wallet from '@/util/wallet';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@/util/whirlpool';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { collectFeesQuote, collectRewardsQuote, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PoolUtil, TickArrayUtil, TokenExtensionUtil, type CollectFeesQuote, type CollectRewardsQuote, type Position } from '@orca-so/whirlpools-sdk';
import BN from 'bn.js';
import { green } from 'colors';

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
 * @returns A {@link Promise} that resolves to a {@link FeesRewardsTxSummary} once the transaction completes.
 */
export async function collectFeesRewards(position: Position): Promise<FeesRewardsTxSummary | undefined> {
  return expBackoff(async (retry) => {
    info('\n-- Collect Fees and Rewards --\n', {
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
      retry,
    });

    // Must refresh data if retrying, or may generate error due to stale data.
    if (retry) {
      await position.refreshData();
    }

    const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
    const { feesQuote, rewardsQuote, tx } = await genCollectFeesRewardsTx(position);

    const hasFees = !feesQuote.feeOwedA.isZero() || !feesQuote.feeOwedB.isZero();
    const hasRewards = rewardsQuote.rewardOwed.some((reward) => reward && !reward.isZero());
    if (!hasFees && !hasRewards) {
      info('No fees or rewards to collect:', {
        whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
        position: position.getAddress().toBase58(),
      });
      return undefined;
    }

    const signature = await executeTransaction(tx, {
      name: 'Collect Fees and Rewards',
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
      [`${tokenA.metadata.symbol} Fee Estimate:`]: toStr(feesQuote.feeOwedA, tokenA.mint.decimals),
      [`${tokenB.metadata.symbol} Fee Estimate:`]: toStr(feesQuote.feeOwedB, tokenB.mint.decimals),
    });
    await position.refreshData();

    const txSummary = await _genFeesRewardsTxSummary(position, signature);
    await FeeRewardTxDAO.insert(txSummary, { catchErrors: true });

    return txSummary;
  }, {
    retryFilter: (result, err) => {
      const errInfo = getTxProgramErrorInfo(err);
      return ['InvalidTimestamp'].includes(errInfo?.name ?? '');
    }
  });
}

/**
 * Creates a transaction to collect fees and rewards for a given {@link position}.
 *
 * @param position The {@link Position} to collect fees and rewards for.
 * @returns A {@link Promise} that resolves to an object containing the
 * {@link CollectFeesQuote}, {@link CollectRewardsQuote}, and {@link TransactionBuilder}.
 */
export async function genCollectFeesRewardsTx(
  position: Position
): Promise<{ feesQuote: CollectFeesQuote, rewardsQuote: CollectRewardsQuote, tx: TransactionBuilder }> {
  info('Creating collect fees and rewards transaction:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });

  const { feesQuote, rewardsQuote } = await _genCollectFeesRewardsQuote(position);

  await position.refreshData();
  const collectFeesTx = await position.collectFees(!position.getData().liquidity.isZero());
  const collectRewardsTxs = await position.collectRewards(undefined, false);

  const tx = new TransactionBuilder(rpc(), wallet());
  tx.addInstruction(collectFeesTx.compressIx(true));
  collectRewardsTxs.forEach((ix) => tx.addInstruction(ix.compressIx(true)));

  return { tx, feesQuote, rewardsQuote };
}

/**
 * Generates the {@link CollectFeesQuote} and {@link CollectRewardsQuote} for a given {@link position}.
 *
 * @param position The {@link Position} to generate the {@link CollectFeesQuote} and {@link CollectRewardsQuote} for.
 * @returns A {@link Promise} that resolves to an object containing the {@link CollectFeesQuote} and {@link CollectRewardsQuote}.
 */
async function _genCollectFeesRewardsQuote(
  position: Position
): Promise<{ feesQuote: CollectFeesQuote, rewardsQuote: CollectRewardsQuote }> {
  const { tickLowerIndex, tickUpperIndex, whirlpool: whirlpoolAddress } = position.getData();
  const { tickSpacing } = position.getWhirlpoolData();
  const accountFetcher = whirlpoolClient().getFetcher();

  const tickArrayLowerAddress = PDAUtil.getTickArrayFromTickIndex(
    tickLowerIndex,
    tickSpacing,
    whirlpoolAddress,
    ORCA_WHIRLPOOL_PROGRAM_ID
  ).publicKey;

  const tickArrayUpperAddress = PDAUtil.getTickArrayFromTickIndex(
    tickUpperIndex,
    tickSpacing,
    whirlpoolAddress,
    ORCA_WHIRLPOOL_PROGRAM_ID
  ).publicKey;

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

      debug(`Reward ${green(token.metadata.symbol)} ( idx: ${i} ):`, toStr(rewardOwed, token.mint.decimals));
    }
  }

  return { feesQuote, rewardsQuote };
}

/**
 * Generates {@link FeesRewardsTxSummary}.
 *
 * @param position The {@link Position} to get the {@link FeesRewardsTxSummary} for.
 * @param signature The signature of the collection transaction.
 * @returns A {@link Promise} that resolves to the {@link FeesRewardsTxSummary}.
 */
async function _genFeesRewardsTxSummary(
  position: Position,
  signature: string,
): Promise<FeesRewardsTxSummary> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());

  const txSummary = await getTransactionSummary(signature, [tokenA.mint.publicKey, tokenB.mint.publicKey]);

  const feesRewardsTxSummary: FeesRewardsTxSummary = {
    fee: txSummary.fee,
    position,
    signature,
    tokenAmountA: txSummary.tokens.get(tokenA.mint.publicKey) ?? new BN(0),
    tokenAmountB: txSummary.tokens.get(tokenB.mint.publicKey) ?? new BN(0),
    usd: txSummary.usd,
  };

  info('Fees and rewards tx summary:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
    signature: txSummary.signature,
    [tokenA.metadata.symbol]: toStr(feesRewardsTxSummary.tokenAmountA, tokenA.mint.decimals),
    [tokenB.metadata.symbol]: toStr(feesRewardsTxSummary.tokenAmountB, tokenB.mint.decimals),
    usd: `$${txSummary.usd}`,
    fee: toStr(txSummary.fee),
  });

  return feesRewardsTxSummary;
}

function _logFeesRewardsTxData(txData: FeesRewardsTxSummary, tokenA: DigitalAsset, tokenB: DigitalAsset): void {
  info(`Collected ${green(`'${tokenA.metadata.symbol}'`)} liquidity:`,
    toStr(txData.tokenAmountA.abs(), tokenA.mint.decimals));

  info(`Collected ${green(`'${tokenB.metadata.symbol}'`)} liquidity:`,
    toStr(txData.tokenAmountB.abs(), tokenB.mint.decimals));
}
