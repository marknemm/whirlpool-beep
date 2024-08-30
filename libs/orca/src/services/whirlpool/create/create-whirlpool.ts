import { expBackoff, info } from '@npc/core';
import { WHIRLPOOL_CONFIG_PUBLIC_KEY } from '@npc/orca/constants/whirlpool';
import whirlpoolClient from '@npc/orca/util/whirlpool/whirlpool';
import { getTokenPair, toPubKeyStr, TransactionContext } from '@npc/solana';
import { type Address } from '@orca-so/common-sdk';
import { PriceMath, Whirlpool } from '@orca-so/whirlpools-sdk';
import type Decimal from 'decimal.js';
import type { CreateWhirlpoolIxData } from './create-whirlpool.interfaces';

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
  const transactionCtx = new TransactionContext();
  const [tokenA, tokenB] = await getTokenPair(tokenAddrA, tokenAddrB);

  info('\n-- Create Whirlpool --\n', {
    tokenA: tokenA.metadata.symbol,
    tokenB: tokenB.metadata.symbol,
    tickSpacing,
  });

  const createWhirlpoolIxData = await genCreateWhirlpoolIxData(tokenAddrA, tokenAddrB, tickSpacing, initialPrice);
  const { whirlpoolAddress } = createWhirlpoolIxData;

  await transactionCtx
    .resetInstructionData(createWhirlpoolIxData)
    .send();

  return await expBackoff(() => whirlpoolClient().getPool(whirlpoolAddress));
}

/**
 * Creates {@link CreateWhirlpoolIxData} that creates a {@link Whirlpool}.
 *
 * @param tokenAddressA The token A {@link Address}.
 * @param tokenAddressB The token B {@link Address}.
 * @param tickSpacing The tick spacing defined for the {@link Whirlpool}.
 * @param initialPrice The initial price of token A in terms of token B.
 * @returns A {@link Promise} that resolves to the {@link CreateWhirlpoolIxData}.
 */
export async function genCreateWhirlpoolIxData(
  tokenAddressA: Address,
  tokenAddressB: Address,
  tickSpacing: number,
  initialPrice: Decimal
): Promise<CreateWhirlpoolIxData> {
  const [tokenA, tokenB] = await getTokenPair(tokenAddressA, tokenAddressB);

  info('Creating Tx to create Whirlpool:', `( ${tokenA.metadata.symbol} <=> ${tokenB.metadata.symbol} )`);

  const initialTick = PriceMath.priceToTickIndex(
    initialPrice,
    tokenA.mint.decimals,
    tokenB.mint.decimals
  );

  const { poolKey, tx } = await whirlpoolClient().createPool(
    WHIRLPOOL_CONFIG_PUBLIC_KEY,
    tokenAddressA,
    tokenAddressB,
    tickSpacing,
    initialTick,
    whirlpoolClient().getContext().wallet.publicKey
  );

  return {
    ...tx.compressIx(false),
    initialTick,
    tickSpacing,
    tokenAddressA,
    tokenAddressB,
    whirlpoolAddress: poolKey,
    debugData: {
      name: 'Create Whirlpool',
      whirlpool: toPubKeyStr(poolKey),
      tokenA: tokenA.metadata.symbol,
      tokenB: tokenB.metadata.symbol,
      tickSpacing,
    }
  };
}

export type * from './create-whirlpool.interfaces';
