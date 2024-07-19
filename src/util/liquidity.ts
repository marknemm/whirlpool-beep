import type { Liquidity } from '@/interfaces/liquidity';
import { timeout } from '@/util/async';
import { info } from '@/util/log';
import { toNum, toStr, toUSD } from '@/util/number-conversion';
import rpc from '@/util/rpc';
import { getTokenPrice } from '@/util/token';
import wallet from '@/util/wallet';
import { getWhirlpoolTokenPair } from '@/util/whirlpool';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { type DecreaseLiquidityQuote, type IncreaseLiquidityQuote, type Position } from '@orca-so/whirlpools-sdk';
import { type TokenBalance } from '@solana/web3.js';
import BN from 'bn.js';
import { green } from 'colors';

/**
 * Generates {@link Liquidity} delta data.
 *
 * @param position The {@link Position} to get the {@link Liquidity} delta for.
 * @param signature The signature of the transaction that changed the liquidity.
 * @param quote The {@link DecreaseLiquidityQuote} or {@link IncreaseLiquidityQuote} for the transaction.
 * @returns A {@link Promise} that resolves to the {@link Liquidity} delta.
 */
export async function genLiquidityDelta(
  position: Position,
  signature: string,
  quote?: DecreaseLiquidityQuote | IncreaseLiquidityQuote
): Promise<Liquidity> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());

  let transaction = await rpc().getTransaction(signature, { maxSupportedTransactionVersion: 0 });
  while (!transaction?.meta?.preTokenBalances || ! transaction.meta.postTokenBalances) {
    await timeout(1000);
    transaction = await rpc().getTransaction(signature, { maxSupportedTransactionVersion: 0 });
  }

  const liquidityDelta: Liquidity = {
    position,
    quote,
    signature,
    tokenAmountA: new BN(0),
    tokenAmountB: new BN(0),
    usd: 0,
  };

  for (let i = 0; i < transaction.meta.preTokenBalances.length; i++) {
    const preBalance = transaction.meta.preTokenBalances[i];
    const postBalance = transaction.meta.postTokenBalances[i];

    if (preBalance.mint === tokenA.mint.publicKey) {
      liquidityDelta.tokenAmountA = _calcDelta(preBalance, postBalance);
    } else if (preBalance.mint === tokenB.mint.publicKey) {
      liquidityDelta.tokenAmountB = _calcDelta(preBalance, postBalance);
    }
  }

  const tokenPriceB = await getTokenPrice(tokenB);
  if (!tokenPriceB) throw new Error(`Token price not found for: ${tokenB.metadata.symbol}`);
  liquidityDelta.usd = toNum(toUSD(liquidityDelta.tokenAmountB, tokenPriceB, tokenB.mint.decimals), 2);

  _logLiquidityDelta(liquidityDelta, tokenA, tokenB);
  return liquidityDelta;
}

function _calcDelta(preBalance: TokenBalance, postBalance: TokenBalance): BN {
  return (preBalance.owner !== wallet().publicKey.toBase58())
    ? new BN(postBalance.uiTokenAmount.amount).sub(new BN(preBalance.uiTokenAmount.amount))
    : new BN(preBalance.uiTokenAmount.amount).sub(new BN(postBalance.uiTokenAmount.amount));
}

function _logLiquidityDelta(liquidityDelta: Liquidity, tokenA: DigitalAsset, tokenB: DigitalAsset): void {
  const logVerb = liquidityDelta.usd > 0 ? 'Deposited' : 'Withdrew';

  info(`${logVerb} ${green(`'${tokenA.metadata.symbol}'`)} liquidity:`,
    toStr(liquidityDelta.tokenAmountA.abs(), tokenA.mint.decimals));

  info(`${logVerb} ${green(`'${tokenB.metadata.symbol}'`)} liquidity:`,
    toStr(liquidityDelta.tokenAmountB.abs(), tokenB.mint.decimals));
}
