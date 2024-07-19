import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@/constants/whirlpool';
import { debug, info } from '@/util/log';
import { getTokenPair } from '@/util/token';
import { verifyTransaction } from '@/util/transaction';
import whirlpoolClient, { formatWhirlpool } from '@/util/whirlpool';
import { type Address, type TransactionBuilder } from '@orca-so/common-sdk';
import { PriceMath, Whirlpool } from '@orca-so/whirlpools-sdk';
import { type PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

/**
 * Creates a {@link Whirlpool}.
 *
 * @param tokenAddrA The token A {@link Address}.
 * @param tokenAddrB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @param initialPrice The initial price of token A in terms of token B.
 * @returns A {@link Promise} that resolves to the newly created {@link Whirlpool}.
 * @throws An {@link Error} if {@link Whirlpool} creation fails to complete.
 */
export async function createWhirlpool(
  tokenAddrA: Address,
  tokenAddrB: Address,
  tickSpacing: number,
  initialPrice: Decimal
): Promise<Whirlpool> {
  debug('\n-- Create Whirlpool --');

  const { poolKey, tx } = await genCreateWhirlpoolTx(tokenAddrA, tokenAddrB, tickSpacing, initialPrice);

  debug('Executing create whirlpool transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  const whirlpool = await whirlpoolClient().getPool(poolKey);
  debug('Created whirlpool:', formatWhirlpool(whirlpool));

  return whirlpool;
}

/**
 * Creates a transaction that creates a {@link Whirlpool}.
 *
 * @param tokenAddrA The token A {@link Address}.
 * @param tokenAddrB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @param initialPrice The initial price of token A in terms of token B.
 * @returns A {@link Promise} that resolves to an object containing the {@link PublicKey}
 * of the new whirlpool and the {@link TransactionBuilder}.
 */
export async function genCreateWhirlpoolTx(
  tokenAddrA: Address,
  tokenAddrB: Address,
  tickSpacing: number,
  initialPrice: Decimal
): Promise<{ poolKey: PublicKey, tx: TransactionBuilder }> {
  const [tokenA, tokenB] = await getTokenPair(tokenAddrA, tokenAddrB);

  info('Creating Tx to create Whirlpool:', `( ${tokenA.metadata.symbol} <=> ${tokenB.metadata.symbol} )`);

  const initialTick = PriceMath.priceToTickIndex(
    initialPrice,
    tokenA.mint.decimals,
    tokenB.mint.decimals
  );

  return whirlpoolClient().createPool(
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    tokenAddrA,
    tokenAddrB,
    tickSpacing,
    initialTick,
    whirlpoolClient().getContext().wallet.publicKey
  );
}
