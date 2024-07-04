import { debug } from '@/util/log';
import whirlpoolClient from '@/util/whirlpool-client';
import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, IncreaseLiquidityQuote, increaseLiquidityQuoteByInputTokenWithParams, TokenExtensionUtil, Whirlpool } from '@orca-so/whirlpools-sdk';
import Decimal from 'decimal.js';

/**
 * Gen an estimated quote on the maximum tokens required to deposit based on a specified {@link liquidityDeposit} amount.
 *
 * @param whirlpool The {@link Whirlpool} to get the deposit quote for.
 * @param tickRange The tick index range of the position that liquidity will be deposited into.
 * @param liquidityDeposit The initial amount to deposit as liquidity in the position.
 * @returns A {@link Promise} that resolves to the {@link increaseLiquidityQuoteByInputTokenWithParams} quote.
 */
async function _genDepositQuote(
  whirlpool: Whirlpool,
  tickRange: [number, number],
  liquidityDeposit: Decimal
): Promise<IncreaseLiquidityQuote> {
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();

  const quote = increaseLiquidityQuoteByInputTokenWithParams({
    // Pass the pool definition and state
    tokenMintA: tokenA.mint,
    tokenMintB: tokenB.mint,
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      whirlpool.getData(),
      IGNORE_CACHE
    ),
    sqrtPrice: whirlpool.getData().sqrtPrice,
    tickCurrentIndex: whirlpool.getData().tickCurrentIndex,
    // Price range
    tickLowerIndex: tickRange[0],
    tickUpperIndex: tickRange[1],
    // Input token and amount
    inputTokenMint: tokenB.mint,
    inputTokenAmount: liquidityDeposit,
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(10, 1000) // 1%,
  });

  debug('Token A max input:', DecimalUtil.fromBN(quote.tokenMaxA, tokenA.decimals).toFixed(tokenA.decimals));
  debug('Token B max input:', DecimalUtil.fromBN(quote.tokenMaxB, tokenB.decimals).toFixed(tokenB.decimals));
  return quote;
}
