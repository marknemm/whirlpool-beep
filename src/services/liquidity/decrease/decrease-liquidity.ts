import OrcaLiquidityDAO from '@/data/orca-liquidity/orca-liquidity.dao';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import { getPositions } from '@/services/position/query/query-position';
import { expBackoff } from '@/util/async/async';
import env from '@/util/env/env';
import { error, info } from '@/util/log/log';
import { toBN, toStr } from '@/util/number-conversion/number-conversion';
import { getProgramErrorInfo } from '@/util/program/program';
import TransactionContext, { SendTransactionResult } from '@/util/transaction-context/transaction-context';
import { getTransferTotalsFromIxs, getTxSummary } from '@/util/transaction-query/transaction-query';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { BN, type Address } from '@coral-xyz/anchor';
import { Percentage } from '@orca-so/common-sdk';
import { decreaseLiquidityQuoteByLiquidityWithParams, IGNORE_CACHE, TokenExtensionUtil, type Position } from '@orca-so/whirlpools-sdk';
import { DecreaseLiquidityIxArgs, DecreaseLiquidityIxData } from './decrease-liquidity.interfaces';

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
      const ixData = await genDecreaseLiquidityIxData({ position, liquidity: amount });

      // Execute and verify the transaction
      const sendResult = await transactionCtx
        .resetInstructionData(ixData)
        .send();

      // Get Liquidity tx summary and insert into DB
      const txSummary = await genDecreaseLiquidityTxSummary(position, ixData, sendResult);
      await OrcaLiquidityDAO.insert(txSummary, { catchErrors: true });

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
 * @param ixArgs The {@link DecreaseLiquidityIxArgs} for generating the instruction data.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityIxData}.
 * @throws An {@link Error} if the transaction amount is 0 or greater than position liquidity.
 */
export async function genDecreaseLiquidityIxData(ixArgs: DecreaseLiquidityIxArgs): Promise<DecreaseLiquidityIxData> {
  const { position, liquidity } = ixArgs;

  info('Creating Tx to decrease liquidity:', {
    position: position.getAddress().toBase58(),
    liquidity: toStr(liquidity),
  });

  if (toBN(liquidity).isZero()) {
    throw new Error('Cannot decrease liquidity by zero');
  }

  if (toBN(liquidity).gt(position.getData().liquidity)) {
    throw new Error('Cannot decrease liquidity by more than position liquidity: '
      + `${toStr(liquidity)} > ${toStr(position.getData().liquidity)}`);
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
    liquidity: toBN(liquidity),
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
    ixArgs,
    positionAddress: position.getAddress(),
    quote,
    whirlpoolAddress: position.getData().whirlpool,
    debugData: {
      name: 'Decrease Liquidity',
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
      liquidity: toStr(liquidity),
      [`${tokenA.metadata.symbol} Min`]: toStr(quote.tokenMinA, tokenA.mint.decimals),
      [`${tokenB.metadata.symbol} Min`]: toStr(quote.tokenMinB, tokenB.mint.decimals),
    }
  };
}

/**
 * Generates a {@link LiquidityTxSummary}.
 *
 * @param position The {@link Position} to get the {@link LiquidityTxSummary} for.
 * @param ixData The {@link DecreaseLiquidityIxData} for the transaction that changed the liquidity.
 * @param sendResult The {@link TransactionSendResult} of the transaction that changed the liquidity.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 */
export async function genDecreaseLiquidityTxSummary(
  position: Position,
  ixData: DecreaseLiquidityIxData,
  sendResult: SendTransactionResult,
): Promise<LiquidityTxSummary> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
  const txSummary = await getTxSummary(sendResult);

  const liquidityIx = txSummary.decodedIxs.find(
    (ix) => /decrease\s*liquidity/i.test(ix.name)
  );
  if (!liquidityIx) throw new Error('No decrease liquidity instruction found in transaction');
  const { tokenTotals, usd } = await getTransferTotalsFromIxs([liquidityIx]);

  const liquidityTxSummary: LiquidityTxSummary = {
    liquidity: toBN(ixData.ixArgs.liquidity).neg(),
    liquidityUnit: 'liquidity',
    position,
    slippage: Percentage.fromFraction(
      ixData.quote.tokenEstA,
      ixData.quote.tokenMinA
    ).toDecimal().toNumber() - 1,
    tokenAmountA: tokenTotals.get(tokenA.mint.publicKey)?.neg() ?? new BN(0),
    tokenAmountB: tokenTotals.get(tokenB.mint.publicKey)?.neg() ?? new BN(0),
    ...txSummary,
    usd: usd * -1, // Tx data is in relationship to wallet, so negate to get flow in/out of pool
  };

  info('Decrease liquidity tx summary:', {
    whirlpool: await formatWhirlpool(liquidityTxSummary.position.getWhirlpoolData()),
    position: liquidityTxSummary.position.getAddress().toBase58(),
    liquidity: toStr(liquidityTxSummary.liquidity),
    [tokenA.metadata.symbol]: toStr(liquidityTxSummary.tokenAmountA, tokenA.mint.decimals),
    [tokenB.metadata.symbol]: toStr(liquidityTxSummary.tokenAmountB, tokenB.mint.decimals),
    usd: `$${liquidityTxSummary.usd}`,
    fee: toStr(liquidityTxSummary.fee),
    signature: liquidityTxSummary.signature,
  });

  return liquidityTxSummary;
}

export type * from './decrease-liquidity.interfaces';
