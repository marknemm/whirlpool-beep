import FeeRewardTxDAO from '@/data/fee-reward-tx-dao';
import type { FeesRewardsTxSummary } from '@/interfaces/fees-rewards';
import { getPositions } from '@/services/position/get-position';
import { error, info } from '@/util/log';
import { toStr } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import { executeTransaction, getTransactionSummary } from '@/util/transaction';
import wallet from '@/util/wallet';
import { getWhirlpoolTokenPair } from '@/util/whirlpool';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { type Address, TransactionBuilder } from '@orca-so/common-sdk';
import { type Position } from '@orca-so/whirlpools-sdk';
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
export async function collectFeesRewards(position: Position): Promise<FeesRewardsTxSummary> {
  info('\n-- Collect Fees and Rewards --');

  const tx = await genCollectFeesRewardsTx(position);

  info('Executing collect fees and rewards transaction...');
  const signature = await executeTransaction(tx);
  await position.refreshData();
  info('Collected fees and rewards for position:', position.getAddress());

  const txSummary = await _genFeesRewardsTxSummary(position, signature);
  await FeeRewardTxDAO.insert(txSummary, { catchErrors: true });

  return txSummary;
}

/**
 * Creates a transaction to collect fees and rewards for a given {@link position}.
 *
 * @param position The {@link Position} to collect fees and rewards for.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genCollectFeesRewardsTx(position: Position): Promise<TransactionBuilder> {
  info('Creating collect fees and rewards transaction for position:', position.getAddress());

  const collectFeesTx = await position.collectFees(true);
  const collectRewardsTxs = await position.collectRewards();

  const tx = new TransactionBuilder(rpc(), wallet());
  tx.addInstruction(collectFeesTx.compressIx(true));
  collectRewardsTxs.forEach((ix) => tx.addInstruction(ix.compressIx(true)));

  return tx;
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

  const txData: FeesRewardsTxSummary = {
    fee: txSummary.fee,
    position,
    signature,
    tokenAmountA: txSummary.tokens.get(tokenA.mint.publicKey) ?? new BN(0),
    tokenAmountB: txSummary.tokens.get(tokenB.mint.publicKey) ?? new BN(0),
    usd: txSummary.usd,
  };

  _logFeesRewardsTxData(txData, tokenA, tokenB);
  return txData;
}

function _logFeesRewardsTxData(txData: FeesRewardsTxSummary, tokenA: DigitalAsset, tokenB: DigitalAsset): void {
  info(`Collected ${green(`'${tokenA.metadata.symbol}'`)} liquidity:`,
    toStr(txData.tokenAmountA.abs(), tokenA.mint.decimals));

  info(`Collected ${green(`'${tokenB.metadata.symbol}'`)} liquidity:`,
    toStr(txData.tokenAmountB.abs(), tokenB.mint.decimals));
}
