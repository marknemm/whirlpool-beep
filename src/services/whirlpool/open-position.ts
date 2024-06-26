import type { WhirlpoolArgs } from '@/interfaces/whirlpool';
import { getPrice } from '@/services/whirlpool/get-price';
import { logPositionRange, logPrice } from '@/util/log';
import { whirlpoolClient } from '@/util/whirlpool-client';
import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, PriceMath, TokenExtensionUtil, buildDefaultAccountFetcher, increaseLiquidityQuoteByInputTokenWithParams } from '@orca-so/whirlpools-sdk';
import { type RpcResponseAndContext, type SignatureResult } from '@solana/web3.js';
import Decimal from 'decimal.js';

/**
 * Opens a position in a {@link Whirlpool}.
 * The position is opened with a price range and a specified amount of liquidity.
 *
 * @param whirlpoolArgs The {@link WhirlpoolArgs} to use for retrieving the {@link Whirlpool} to open a position in.
 * @returns A {@link Promise} that resolves to an {@link RpcResponseAndContext} containing the {@link SignatureResult} of the transaction.
 */
export async function openPosition(whirlpoolArgs: WhirlpoolArgs): Promise<RpcResponseAndContext<SignatureResult>> {
  const client = whirlpoolClient();
  const rpc = client.getContext().connection;

  const tokenPriceData = await getPrice(whirlpoolArgs);
  logPrice(tokenPriceData);

  const { tokenA, tokenB, whirlpool } = tokenPriceData;
  const whirlpoolData = whirlpool.getData();

  // Set price range, amount of tokens to deposit, and acceptable slippage
  const lowerPrice = new Decimal('0.005');
  const upperPrice = new Decimal('0.02');

  // Adjust price range (not all prices can be set, only a limited number of prices are available for range specification)
  // (prices corresponding to InitializableTickIndex are available)
  const lowerTickIdx = PriceMath.priceToInitializableTickIndex(lowerPrice, tokenA.decimals, tokenB.decimals, whirlpoolData.tickSpacing);
  const upperTickIdx = PriceMath.priceToInitializableTickIndex(upperPrice, tokenA.decimals, tokenB.decimals, whirlpoolData.tickSpacing);
  logPositionRange(lowerTickIdx, upperTickIdx, tokenA, tokenB);

  const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
    await buildDefaultAccountFetcher(rpc),
    whirlpoolData,
    IGNORE_CACHE
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
    inputTokenMint: tokenB.mint,
    inputTokenAmount: DecimalUtil.toBN(new Decimal('1' /* devUSDC */), tokenB.decimals),
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(10, 1000) // 1%,
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
  const latestBlockhash = await rpc.getLatestBlockhash();
  return rpc.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');
}
