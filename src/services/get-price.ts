import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { whirlpoolClient } from '@/util/whirlpool-client';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

export async function getPrice(): Promise<Decimal> {
  const client = whirlpoolClient();

  // https://everlastingsong.github.io/nebula/
  const devUSDC = { mint: new PublicKey('BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k'), decimals: 6 };
  const devSAMO = { mint: new PublicKey('Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa'), decimals: 9 };

  // Get devSAMO/devUSDC whirlpool
  const tickSpacing = 64;
  const whirlpoolPublicKey = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    devSAMO.mint,
    devUSDC.mint,
    tickSpacing
  ).publicKey;
  console.log('whirlpool key:', whirlpoolPublicKey.toBase58());
  const whirlpool = await client.getPool(whirlpoolPublicKey);

  // Get the current price of the pool
  const sqrtPriceX64 = whirlpool.getData().sqrtPrice;
  const price = PriceMath.sqrtPriceX64ToPrice(sqrtPriceX64, devSAMO.decimals, devUSDC.decimals);

  console.log('sqrt price x64:', sqrtPriceX64.toString());
  console.log('price:', price.toFixed(devUSDC.decimals));

  return price;
}
