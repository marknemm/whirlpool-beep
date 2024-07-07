import { getToken } from '@/services/token/get-token';
import { toStr } from '@/util/currency';
import { debug, info } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient from '@/util/whirlpool-client';
import { type BN } from '@coral-xyz/anchor';
import { DecimalUtil, Percentage, type TransactionBuilder } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type IncreaseLiquidityQuote, increaseLiquidityQuoteByInputTokenWithParams, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

/**
 * Deposits liquidity into a {@link Position}.
 *
 * @param position The {@link Position} to deposit liquidity into.
 * @param amount The amount of liquidity to deposit in the {@link Position}.
 * @returns A {@link Promise} that resolves to the actual increase in liquidity.
 * @throws An {@link Error} if the deposit transaction fails to complete.
 */
export async function increaseLiquidity(position: Position, amount: Decimal): Promise<BN> {
  info('\n-- Increasing liquidity --');

  const { tx } = await increaseLiquidityTx(position, amount);

  // Execute and verify the transaction
  info('Executing increase liquidity transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  // Refresh position data and log the actual increase in liquidity
  const initLiquidity = position.getData().liquidity;
  await position.refreshData();
  const deltaLiquidity = position.getData().liquidity.sub(initLiquidity);
  info('Increased liquidity by:', toStr(deltaLiquidity));

  return deltaLiquidity;
}

/**
 * Creates a transaction to increase liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to increase liquidity in.
 * @param amount The amount of liquidity to increase.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function increaseLiquidityTx(
  position: Position,
  amount: Decimal
): Promise<{ quote: IncreaseLiquidityQuote, tx: TransactionBuilder }> {
  const tokenA = await getToken(position.getWhirlpoolData().tokenMintA);
  const tokenB = await getToken(position.getWhirlpoolData().tokenMintB);

  if (!tokenA || !tokenB) throw new Error('Token not found');

  const tokenMintA = new PublicKey(tokenA.mint.publicKey);
  const tokenMintB = new PublicKey(tokenB.mint.publicKey);

  const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
    whirlpoolClient().getFetcher(),
    position.getWhirlpoolData(),
    IGNORE_CACHE
  );

  const quote = increaseLiquidityQuoteByInputTokenWithParams({
    // Pass the pool definition and state
    tokenMintA,
    tokenMintB,
    tokenExtensionCtx,
    sqrtPrice: position.getWhirlpoolData().sqrtPrice,
    tickCurrentIndex: position.getWhirlpoolData().tickCurrentIndex,
    // Position tick (price) range
    tickLowerIndex: position.getData().tickLowerIndex,
    tickUpperIndex: position.getData().tickUpperIndex,
    // Input token and amount
    inputTokenMint: tokenMintB,
    inputTokenAmount: DecimalUtil.toBN(amount, tokenB.mint.decimals),
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(1, 100), // 1%
  });

  debug('Increase liquidity quote:', quote);
  info(`${tokenA.metadata.symbol} max input:`, toStr(quote.tokenMaxA, tokenA.mint.decimals));
  info(`${tokenB.metadata.symbol} max input:`, toStr(quote.tokenMaxB, tokenB.mint.decimals));

  const tx = await position.increaseLiquidity(quote);
  return { quote, tx };
}
