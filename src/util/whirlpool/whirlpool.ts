import type { Null } from '@/interfaces/nullable.interfaces';
import { info } from '@/util/log/log';
import rpc from '@/util/rpc/rpc';
import wallet from '@/util/wallet/wallet';
import { AnchorProvider } from '@coral-xyz/anchor';
import { buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PriceMath, WhirlpoolContext, type Whirlpool, type WhirlpoolClient, type WhirlpoolData } from '@orca-so/whirlpools-sdk';
import { getTokenPair } from '../token/token';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import type Decimal from 'decimal.js';

let _whirlpoolClient: WhirlpoolClient;

/**
 * Gets the singleton {@link WhirlpoolClient}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link WhirlpoolClient} singleton.
 */
export default function whirlpoolClient(): WhirlpoolClient {
  if (!_whirlpoolClient) {
    const anchor = new AnchorProvider(rpc(), wallet(), AnchorProvider.defaultOptions());
    const ctx = WhirlpoolContext.withProvider(anchor, ORCA_WHIRLPOOL_PROGRAM_ID);

    _whirlpoolClient = buildWhirlpoolClient(ctx);

    info('-- Initialized Whirlpool Client --');
  }

  return _whirlpoolClient;
}

/**
 * Formats a {@link Whirlpool} or {@link WhirlpoolData} into a human-readable log ID.
 *
 * @param whirlpool The {@link Whirlpool} or {@link WhirlpoolData} to format.
 * @returns A {@link Promise} that resolves to the formatted log ID. Returns an empty string if the whirlpool is `null`.
 */
export async function formatWhirlpool(whirlpool: Whirlpool | WhirlpoolData | Null): Promise<string> {
  if (!whirlpool) return '';

  const whirlpoolData = toWhirlpoolData(whirlpool);
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);
  const address = (whirlpool as Whirlpool).getAddress?.().toBase58() ?? '';

  return (address ? `${address} -- ` : '')
    + `${tokenA.metadata.symbol} / ${tokenB.metadata.symbol} -- spacing: ${whirlpoolData.tickSpacing}`.trim();
}

/**
 * Gets the price of a given {@link Whirlpool}.
 *
 * The price is the value of token A in terms of token B.
 *
 * @param whirlpool The {@link Whirlpool} to get the price of.
 * @returns The {@link Decimal} price of the {@link Whirlpool}.
 */
export async function getWhirlpoolPrice(whirlpool: Whirlpool | WhirlpoolData): Promise<Decimal> {
  const whirlpoolData = toWhirlpoolData(whirlpool);
  const { sqrtPrice } = whirlpoolData;
  const [tokenA, tokenB] = await getTokenPair(whirlpoolData.tokenMintA, whirlpoolData.tokenMintB);

  return PriceMath.sqrtPriceX64ToPrice(sqrtPrice, tokenA.mint.decimals, tokenB.mint.decimals);
}

/**
 * Fetches a pair of tokens based off of the token info found in a given {@link whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool} or {@link WhirlpoolData} to fetch the token pair for.
 * @returns A {@link Promise} that resolves to an array filled with a pair of token {@link DigitalAsset}s.
 * @throws An {@link Error} if the GET request fails or either token could not be retrieved.
 * @see https://github.com/solflare-wallet/utl-api?tab=readme-ov-file#search-by-content API for querying tokens.
 */
export async function getWhirlpoolTokenPair(
  whirlpool: Whirlpool | WhirlpoolData
): Promise<[DigitalAsset, DigitalAsset]> {
  const whirlpoolData = toWhirlpoolData(whirlpool);

  return getTokenPair(
    whirlpoolData.tokenMintA,
    whirlpoolData.tokenMintB
  );
}

/**
 * Converts a {@link Whirlpool} or {@link WhirlpoolData} into a {@link WhirlpoolData}.
 *
 * @param whirlpool The {@link Whirlpool} or {@link WhirlpoolData} to convert.
 * @returns The {@link WhirlpoolData} representation of the whirlpool.
 */
export function toWhirlpoolData(whirlpool: Whirlpool | WhirlpoolData): WhirlpoolData {
  return (whirlpool as Whirlpool)?.getData?.() ?? whirlpool;
}
