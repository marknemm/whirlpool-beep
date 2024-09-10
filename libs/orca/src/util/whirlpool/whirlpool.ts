import { type Address } from '@coral-xyz/anchor';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { debug, type Null } from '@npc/core';
import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@npc/orca/constants/whirlpool';
import { anchor, getTokenPair, isAddress } from '@npc/solana';
import { buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath, WhirlpoolContext, type Whirlpool, type WhirlpoolClient, type WhirlpoolData } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';
import type { GetWhirlpoolArgs, GetWhirlpoolKeyArgs } from './whirlpool.interfaces';

let _whirlpoolClient: WhirlpoolClient;

/**
 * Gets the singleton {@link WhirlpoolClient}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link WhirlpoolClient} singleton.
 */
export function whirlpoolClient(): WhirlpoolClient {
  if (!_whirlpoolClient) {
    const ctx = WhirlpoolContext.withProvider(anchor(), ORCA_WHIRLPOOL_PROGRAM_ID);

    _whirlpoolClient = buildWhirlpoolClient(ctx);

    debug('-- Initialized Whirlpool Client --');
  }

  return _whirlpoolClient;
}

/**
 * Formats a {@link Whirlpool} or {@link WhirlpoolData} into a human-readable log ID.
 *
 * @param whirlpool The {@link Whirlpool}, {@link WhirlpoolData}, or {@link Address} of the {@link Whirlpool} to format.
 * @returns A {@link Promise} that resolves to the formatted log ID. Returns an empty string if the whirlpool is `null`.
 */
export async function formatWhirlpool(whirlpool: Whirlpool | WhirlpoolData | Address | Null): Promise<string> {
  if (!whirlpool) return '';
  whirlpool = await resolveWhirlpool(whirlpool);

  const address = whirlpool.getAddress().toBase58();
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
  const [symbolA, symbolB] = [tokenA.metadata.symbol, tokenB.metadata.symbol];
  const { tickSpacing } = whirlpool.getData();

  return `${address} -- ${symbolA} / ${symbolB} / ${tickSpacing}`;
}

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param args The {@link GetWhirlpoolArgs} to use when fetching the {@link Whirlpool}.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getWhirlpool(args: GetWhirlpoolArgs): Promise<Whirlpool> {
  const { tickSpacing, tokenA, tokenB, whirlpoolAddress } = args;

  if (!whirlpoolAddress && !(tokenA && tokenB && tickSpacing)) {
    throw new Error('Must provide either a whirlpool address or token A, token B, and tick spacing.');
  }

  const whirlpoolKey = whirlpoolAddress ?? await getWhirlpoolKey(args as GetWhirlpoolKeyArgs);

  return whirlpoolClient().getPool(whirlpoolKey, args);
}

/**
 * Gets the {@link PublicKey} (address) for a {@link Whirlpool} via PDA.
 *
 * @param args The {@link WhirlpoolPDAOpts} to use when fetching the {@link Whirlpool} key.
 * @returns The {@link PublicKey} (address) of the {@link Whirlpool}.
 */
export async function getWhirlpoolKey(args: GetWhirlpoolKeyArgs): Promise<PublicKey> {
  const { tokenA, tokenB, tickSpacing } = args;
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
  const whirlpoolData = toWhirlpoolData(whirlpool);

  const { sqrtPrice } = whirlpoolData;
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);
  const [decimalsA, decimalsB] = [tokenA.mint.decimals, tokenB.mint.decimals];

  return PriceMath.sqrtPriceX64ToPrice(sqrtPrice, decimalsA, decimalsB);
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
 * Resolves a {@link Whirlpool} or {@link WhirlpoolData} to a {@link Whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool}, {@link WhirlpoolData}, or {@link Whirlpool} {@link Address} to resolve.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 * @throws An {@link Error} if the {@link Whirlpool} could not be resolved.
 */
export async function resolveWhirlpool(whirlpool: Whirlpool | WhirlpoolData | Address): Promise<Whirlpool> {
  if (isAddress(whirlpool)) {
    whirlpool = await getWhirlpool({ whirlpoolAddress: whirlpool });
  }

  return ('getData' in whirlpool)
    ? whirlpool
    : await getWhirlpool({
      tokenA: whirlpool.tokenMintA,
      tokenB: whirlpool.tokenMintB,
      tickSpacing: whirlpool.tickSpacing
    });
}

/**
 * Converts a {@link Whirlpool} or {@link WhirlpoolData} into a {@link WhirlpoolData}.
 *
 * @param whirlpool The {@link Whirlpool} or {@link WhirlpoolData} to convert.
 * @returns The {@link WhirlpoolData} representation of the {@link Whirlpool}.
 */
export function toWhirlpoolData(whirlpool: Whirlpool | WhirlpoolData): WhirlpoolData {
  return (whirlpool as Whirlpool)?.getData?.() ?? whirlpool;
}

export type * from './whirlpool.interfaces';
export default whirlpoolClient;
