import type { PositionTickRange, WhirlpoolArgs } from '@/interfaces/whirlpool';
import { getPrice } from '@/services/whirlpool/get-price';
import { debug, logPositionRange } from '@/util/log';
import { whirlpoolClient } from '@/util/whirlpool-client';
import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, PriceMath, TokenExtensionUtil, increaseLiquidityQuoteByInputTokenWithParams, type IncreaseLiquidityQuote, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { type RpcResponseAndContext, type SignatureResult } from '@solana/web3.js';
import Decimal from 'decimal.js';

/**
 * Opens a position in a {@link Whirlpool}.
 * The position is opened with a price range and a specified amount of liquidity.
 *
 * @param whirlpoolArgs The {@link WhirlpoolArgs} to use for retrieving the {@link Whirlpool} to open a position in.
 * @param priceMargin The price margin {@link Percentage} to use for the position.
 * @param liquidityDeposit The initial amount of token `B` to deposit as liquidity in the position.
 * @returns A {@link Promise} that resolves to an {@link RpcResponseAndContext} containing the {@link SignatureResult} of the transaction.
 */
export async function openPosition(
  whirlpoolArgs: WhirlpoolArgs,
  priceMargin: Percentage,
  liquidityDeposit: Decimal
): Promise<RpcResponseAndContext<SignatureResult>> {
  const client = whirlpoolClient();
  const rpc = client.getContext().connection;

  // Get Whirlpool price data
  const { price, whirlpool } = await getPrice(whirlpoolArgs);

  // Use Whirlpool price data to generate position tick range
  const tickRange = genPositionTickRange(whirlpool, price, priceMargin);

  // Obtain deposit estimation
  const quote = await genDepositQuote(whirlpool, tickRange, liquidityDeposit);

  // Create a transaction
  const { positionMint, tx } = await whirlpool.openPositionWithMetadata(
    tickRange[0],
    tickRange[1],
    quote
  );

  // Send the transaction
  const signature = await tx.buildAndExecute();
  debug('Signature:', signature);
  debug('Position NFT:', positionMint.toBase58());

  // Wait for the transaction to complete
  const latestBlockhash = await rpc.getLatestBlockhash();
  return rpc.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');
}

/**
 * Generates a tick index range for a {@link Whirlpool} position based on a given {@link priceMargin}.
 *
 * `Note`: The generated tick index range will be within `[-443636, 443636]`, which maps to a price range of `[2^-64, 2^64]`.
 * Also, the generated tick index range may not map exactly to the price range due to the {@link Whirlpool} tick spacing.
 *
 * @param whirlpool The {@link Whirlpool} to generate the position range for.
 * @param price The price of token `A` in terms of token `B`.
 * @param priceMargin The price margin {@link Percentage} to use for the position.
 * @returns A tuple containing the lower and upper tick index of the position.
 */
function genPositionTickRange(
  whirlpool: Whirlpool,
  price: Decimal,
  priceMargin: Percentage,
): PositionTickRange {
  // Extract necessary data from Whirlpool
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();
  const tickSpacing = whirlpool.getData().tickSpacing;

  // Calculate price range based on priceMargin Percentage input
  const priceMarginValue = price.mul(priceMargin.toDecimal());
  const lowerPrice = price.minus(priceMarginValue);
  const upperPrice = price.plus(priceMarginValue);

  // Calculate tick index range based on price range (tick index range may not map exactly to price range due to tick spacing)
  const lowerTick = PriceMath.priceToInitializableTickIndex(lowerPrice, tokenA.decimals, tokenB.decimals, tickSpacing);
  const upperTick = PriceMath.priceToInitializableTickIndex(upperPrice, tokenA.decimals, tokenB.decimals, tickSpacing);

  logPositionRange([lowerTick, upperTick], whirlpool);
  return [lowerTick, upperTick]; // Subset of range [-443636, 443636]
}

/**
 * Gen an estimated quote on the maximum tokens required to deposit based on a specified {@link liquidityDeposit} amount.
 *
 * @param whirlpool The {@link Whirlpool} to get the deposit quote for.
 * @param tickRange The tick index range of the position that liquidity will be deposited into.
 * @param liquidityDeposit The initial amount to deposit as liquidity in the position.
 * @returns A {@link Promise} that resolves to the {@link increaseLiquidityQuoteByInputTokenWithParams} quote.
 */
async function genDepositQuote(
  whirlpool: Whirlpool,
  tickRange: PositionTickRange,
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
    inputTokenAmount: (liquidityDeposit instanceof Decimal)
      ? DecimalUtil.toBN(liquidityDeposit, tokenB.decimals)
      : liquidityDeposit,
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(10, 1000) // 1%,
  });

  debug('Token A max input:', DecimalUtil.fromBN(quote.tokenMaxA, tokenA.decimals).toFixed(tokenA.decimals));
  debug('Token B max input:', DecimalUtil.fromBN(quote.tokenMaxB, tokenB.decimals).toFixed(tokenB.decimals));
  return quote;
}
