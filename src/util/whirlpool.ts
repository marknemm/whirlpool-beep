import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import anchor from '@/util/anchor';
import { debug, info } from '@/util/log';
import rpc from '@/util/rpc';
import { Address, type TransactionBuilder } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath, TokenInfo, WhirlpoolContext, buildWhirlpoolClient, type Whirlpool, type WhirlpoolClient } from '@orca-so/whirlpools-sdk';
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
    const ctx = WhirlpoolContext.withProvider(anchor(), ORCA_WHIRLPOOL_PROGRAM_ID);

    _whirlpoolClient = buildWhirlpoolClient(ctx);

    info('-- Initialized Whirlpool Client --');
  }

  return _whirlpoolClient;
}

/**
 * Gets the price of a given {@link Whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool} to get the price of.
 * @returns The {@link Decimal} price of the {@link Whirlpool}.
 */
export function getPrice(whirlpool: Whirlpool): Decimal {
  const { sqrtPrice } = whirlpool.getData();
  const [tokenInfoA, tokenInfoB] = getTokenInfoPair(whirlpool);

  return PriceMath.sqrtPriceX64ToPrice(sqrtPrice, tokenInfoA.decimals, tokenInfoB.decimals);
}

/**
 * Gets the token info pair for a {@link Whirlpool}.
 *
 * @param whirlpool The {@link Whirlpool} to get the token info pair for.
 * @returns The token info pair for the {@link Whirlpool}.
 */
export function getTokenInfoPair(whirlpool: Whirlpool): [TokenInfo, TokenInfo] {
  const tokenInfoA = whirlpool.getTokenAInfo();
  const tokenInfoB = whirlpool.getTokenBInfo();

  return [tokenInfoA, tokenInfoB];
}

/**
 * Gets a {@link Whirlpool} via a Program Derived Address (PDA).
 *
 * @param tokenA The token A {@link Address}.
 * @param tokenB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @returns A {@link Promise} that resolves to the {@link Whirlpool}.
 */
export async function getWhirlpool(tokenA: Address, tokenB: Address, tickSpacing: number): Promise<Whirlpool> {
  debug('Whirlpool args:', { tokenA, tokenB, tickSpacing });

  const whirlpoolPDA = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    new PublicKey(tokenA),
    new PublicKey(tokenB),
    tickSpacing
  );

  const whirlpool = await whirlpoolClient().getPool(whirlpoolPDA.publicKey);
  info('Retrieved whirlpool with public key:', whirlpool.getAddress().toBase58());

  return whirlpool;
}

/**
 * Signs a transaction payload with the {@link WhirlpoolClient}'s {@link AnchorProvider}, and sends it out.
 *
 * @param tx The {@link TransactionBuilder} containing the transaction instructions to send.
 * @returns A {@link Promise} that resolves once the transaction is complete.
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function sendTx(tx: TransactionBuilder): Promise<void> {
  // Sign and send transaction
  const signature = await tx.buildAndExecute();
  debug('Tx Signature:', signature);

  // Wait for the transaction to complete
  const latestBlockhash = await rpc().getLatestBlockhash();
  const confirmResponse = await rpc().confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

  if (confirmResponse.value.err) {
    throw new Error(confirmResponse.value.err.toString());
  }
}
