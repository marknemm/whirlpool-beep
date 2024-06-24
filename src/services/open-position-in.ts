import { whirlpoolClient } from '@/util/whirlpool-client';
import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, TokenExtensionUtil, PDAUtil, PriceMath, increaseLiquidityQuoteByInputTokenWithParams, buildDefaultAccountFetcher, IGNORE_CACHE } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';

export async function openPositionIn() {
  const client = whirlpoolClient();
  const ctx = client.getContext();

  // https://everlastingsong.github.io/nebula/
  const devUSDC = { mint: new PublicKey('BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k'), decimals: 6 };
  const devSAMO = { mint: new PublicKey('Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa'), decimals: 9 };

  // WhirlpoolsConfig account
  // devToken ecosystem / Orca Whirlpools
  const DEVNET_WHIRLPOOLS_CONFIG = new PublicKey('FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR');

  // Get devSAMO/devUSDC whirlpool
  const tickSpacing = 64;
  const whirlpoolPubkey = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    DEVNET_WHIRLPOOLS_CONFIG,
    devSAMO.mint,
    devUSDC.mint,
    tickSpacing
  ).publicKey;
  console.log('whirlpool key:', whirlpoolPubkey.toBase58());
  const whirlpool = await whirlpoolClient().getPool(whirlpoolPubkey);

  // Get the current price of the pool
  const sqrtPriceX64 = whirlpool.getData().sqrtPrice;
  const price = PriceMath.sqrtPriceX64ToPrice(sqrtPriceX64, devSAMO.decimals, devUSDC.decimals);
  console.log('price:', price.toFixed(devUSDC.decimals));

  // Set price range, amount of tokens to deposit, and acceptable slippage
  const lowerPrice = new Decimal('0.005');
  const upperPrice = new Decimal('0.02');
  const devUSDCAmt = DecimalUtil.toBN(new Decimal('1' /* devUSDC */), devUSDC.decimals);
  const slippage = Percentage.fromFraction(10, 1000); // 1%

  // Adjust price range (not all prices can be set, only a limited number of prices are available for range specification)
  // (prices corresponding to InitializableTickIndex are available)
  const whirlpoolData = whirlpool.getData();
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();
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
    inputTokenMint: devUSDC.mint,
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
