import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import type { Null } from '@/interfaces/nullable';
import type { TokenQuery } from '@/interfaces/token';
import { info } from '@/util/log';
import rpc from '@/util/rpc';
import { getTokenPair } from '@/util/token';
import wallet from '@/util/wallet';
import { AnchorProvider, type Address } from '@coral-xyz/anchor';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath, WhirlpoolAccountFetchOptions, WhirlpoolContext, type Whirlpool, type WhirlpoolClient, type WhirlpoolData } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
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
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param tokenA The token A {@link Address}.
 * @param tokenB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @param opts The {@link WhirlpoolAccountFetchOptions} to use when fetching the {@link Whirlpool}.
 * Defaults to {@link IGNORE_CACHE}.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getWhirlpool(
  tokenA: TokenQuery,
  tokenB: TokenQuery,
  tickSpacing: number,
  opts?: WhirlpoolAccountFetchOptions
): Promise<Whirlpool> {
  const whirlpoolKey = await getWhirlpoolKey(tokenA, tokenB, tickSpacing);
  return whirlpoolClient().getPool(whirlpoolKey, opts);
}

/**
 * Gets the {@link PublicKey} (address) for a {@link Whirlpool} via PDA.
 *
 * @param tokenA The token A {@link Address}.
 * @param tokenB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @returns The {@link PublicKey} (address) of the {@link Whirlpool}.
 */
export async function getWhirlpoolKey(
  tokenA: Address,
  tokenB: Address,
  tickSpacing: number
): Promise<PublicKey> {
  const [{ mint: mintA }, { mint: mintB }] = await getTokenPair(tokenA, tokenB);

  return PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    new PublicKey(mintA.publicKey),
    new PublicKey(mintB.publicKey),
    tickSpacing
  ).publicKey;
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
  const whirlpoolData = _toWhirlpoolData(whirlpool);
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
  const whirlpoolData = _toWhirlpoolData(whirlpool);

  return getTokenPair(
    whirlpoolData.tokenMintA,
    whirlpoolData.tokenMintB
  );
}

/**
 * Formats a {@link Whirlpool} or {@link WhirlpoolData} into a human-readable log ID.
 *
 * @param whirlpool The {@link Whirlpool} or {@link WhirlpoolData} to format.
 * @returns A {@link Promise} that resolves to the formatted log ID. Returns an empty string if the whirlpool is `null`.
 */
export async function formatWhirlpool(whirlpool: Whirlpool | WhirlpoolData | Null): Promise<string> {
  if (!whirlpool) return '';

  const whirlpoolData = _toWhirlpoolData(whirlpool);
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);

  return `${_getWhirlpoolAddress(whirlpool)} ( ${tokenA.metadata.symbol} <-> ${tokenB.metadata.symbol} )`.trim();
}

function _toWhirlpoolData(whirlpool: Whirlpool | WhirlpoolData): WhirlpoolData {
  return (whirlpool as Whirlpool)?.getData?.() ?? whirlpool;
}

function _getWhirlpoolAddress(whirlpool: Whirlpool | WhirlpoolData): string {
  return (whirlpool as Whirlpool).getAddress?.().toBase58() ?? '';
}
