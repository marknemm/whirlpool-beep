import { getToken } from '@/services/token/get-token';
import { toStr } from '@/util/currency';
import { debug, info } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient from '@/util/whirlpool-client';
import { type BN } from '@coral-xyz/anchor';
import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type IncreaseLiquidityQuote, increaseLiquidityQuoteByInputTokenWithParams, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';

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

  // Obtain increase liquidity quote and create transaction
  const quote = await _genIncreaseLiquidityQuote(position, amount);
  const tx = await position.increaseLiquidity(quote);

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
 * Gen an estimated quote on the maximum tokens required to deposit based on a specified {@link amount}.
 *
 * @param position The {@link Position} to get the deposit quote for.
 * @param amount The amount of liquidity to deposit in the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityQuote}.
 */
async function _genIncreaseLiquidityQuote(
  position: Position,
  amount: Decimal
): Promise<IncreaseLiquidityQuote> {
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

  return quote;
}
