import { USDC_TOKEN_META } from '@/constants/token';
import { WhirlpoolArgs } from '@/interfaces/whirlpool';
import { whirlpoolClient } from '@/util/whirlpool-client';
import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, PriceMath, TokenExtensionUtil, buildDefaultAccountFetcher, increaseLiquidityQuoteByInputTokenWithParams } from '@orca-so/whirlpools-sdk';
import Decimal from 'decimal.js';
import { getPrice } from './get-price';

export async function openPositionIn(whirlpoolArgs: WhirlpoolArgs) {
  const client = whirlpoolClient();
  const ctx = client.getContext();

  const { tokenA, tokenB, whirlpool } = await getPrice(whirlpoolArgs);
  const whirlpoolData = whirlpool.getData();

  // Set price range, amount of tokens to deposit, and acceptable slippage
  const lowerPrice = new Decimal('0.005');
  const upperPrice = new Decimal('0.02');
  const devUSDCAmt = DecimalUtil.toBN(new Decimal('1' /* devUSDC */), tokenB.decimals);
  const slippage = Percentage.fromFraction(10, 1000); // 1%

  // Adjust price range (not all prices can be set, only a limited number of prices are available for range specification)
  // (prices corresponding to InitializableTickIndex are available)
  const lowerTickIdx = PriceMath.priceToInitializableTickIndex(lowerPrice, tokenA.decimals, tokenB.decimals, whirlpoolData.tickSpacing);
  const upperTickIdx = PriceMath.priceToInitializableTickIndex(upperPrice, tokenA.decimals, tokenB.decimals, whirlpoolData.tickSpacing);
  console.log('lower & upper tick index:', lowerTickIdx, upperTickIdx);
  console.log('lower & upper price:',
    PriceMath.tickIndexToPrice(lowerTickIdx, tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals),
    PriceMath.tickIndexToPrice(upperTickIdx, tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals)
  );

  const fetcher = await buildDefaultAccountFetcher(ctx.connection);
  const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
    fetcher,
    whirlpoolData,
    IGNORE_CACHE,
  );

  // Obtain deposit estimation
  const quote = increaseLiquidityQuoteByInputTokenWithParams({
    // Pass the pool definition and state
    tokenMintA: tokenA.mint,
    tokenMintB: tokenB.mint,
    tokenExtensionCtx,
    sqrtPrice: whirlpoolData.sqrtPrice,
    tickCurrentIndex: whirlpoolData.tickCurrentIndex,
    // Price range
    tickLowerIndex: lowerTickIdx,
    tickUpperIndex: upperTickIdx,
    // Input token and amount
    inputTokenMint: USDC_TOKEN_META.mint,
    inputTokenAmount: devUSDCAmt,
    // Acceptable slippage
    slippageTolerance: slippage,
  });

  // Output the estimation
  console.log('devSAMO max input:', DecimalUtil.fromBN(quote.tokenMaxA, tokenA.decimals).toFixed(tokenA.decimals));
  console.log('devUSDC max input:', DecimalUtil.fromBN(quote.tokenMaxB, tokenB.decimals).toFixed(tokenB.decimals));

  // Create a transaction
  const openPositionTx = await whirlpool.openPositionWithMetadata(
    lowerTickIdx,
    upperTickIdx,
    quote
  );

  // Send the transaction
  const signature = await openPositionTx.tx.buildAndExecute();
  console.log('signature:', signature);
  console.log('position NFT:', openPositionTx.positionMint.toBase58());

  // Wait for the transaction to complete
  const latestBlockhash = await ctx.connection.getLatestBlockhash();
  await ctx.connection.confirmTransaction({signature, ...latestBlockhash}, 'confirmed');
}
