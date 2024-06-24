import { whirlpoolClient } from '@/util/whirlpool-client';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

export async function getPrice(): Promise<Decimal> {
  const client = whirlpoolClient();
  const ctx = client.getContext();

  console.log('endpoint:', ctx.connection.rpcEndpoint);
  console.log('wallet pubkey:', ctx.wallet.publicKey.toBase58());

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
  const whirlpool = await client.getPool(whirlpoolPubkey);

  // Get the current price of the pool
  const sqrtPriceX64 = whirlpool.getData().sqrtPrice;
  const price = PriceMath.sqrtPriceX64ToPrice(sqrtPriceX64, devSAMO.decimals, devUSDC.decimals);

  console.log('sqrt price x64:', sqrtPriceX64.toString());
  console.log('price:', price.toFixed(devUSDC.decimals));

  return price;
}
