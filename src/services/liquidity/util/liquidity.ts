import type { Null } from '@/interfaces/nullable.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import { info } from '@/util/log/log';
import { toStr } from '@/util/number-conversion/number-conversion';
import { getTransactionSummary, getTransactionTransferTotals } from '@/util/transaction/transaction';
import { formatWhirlpool, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { type DecreaseLiquidityQuote, type IncreaseLiquidityQuote, type Position } from '@orca-so/whirlpools-sdk';
import BN from 'bn.js';

/**
 * Generates {@link LiquidityTxSummary}.
 *
 * @param position The {@link Position} to get the {@link LiquidityTxSummary} for.
 * @param signature The signature of the transaction that changed the liquidity.
 * @param quote The {@link DecreaseLiquidityQuote} or {@link IncreaseLiquidityQuote} for the transaction.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 */
export async function genLiquidityTxSummary(
  position: Position,
  signature: string,
  quote?: DecreaseLiquidityQuote | IncreaseLiquidityQuote | Null
): Promise<LiquidityTxSummary> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());

  const txSummary = await getTransactionSummary(signature);

  const liquidityIx = txSummary.decodedIxs.find(
    (ix) => ix.name.toLowerCase().includes('liquidity')
  );
  if (!liquidityIx) throw new Error('No liquidity instruction found in transaction');
  const { tokenTotals, usd } = await getTransactionTransferTotals([liquidityIx]);

  const liquidityTxSummary: LiquidityTxSummary = {
    fee: txSummary.fee,
    position,
    quote,
    signature,
    tokenAmountA: tokenTotals.get(tokenA.mint.publicKey)?.neg() ?? new BN(0),
    tokenAmountB: tokenTotals.get(tokenB.mint.publicKey)?.neg() ?? new BN(0),
    usd: usd * -1, // Tx data is in relationship to wallet, so negate to get flow in/out of pool
  };

  info(`${liquidityTxSummary.usd > 0 ? 'Increased' : 'Decreased'} liquidity:`, {
    whirlpool: await formatWhirlpool(liquidityTxSummary.position.getWhirlpoolData()),
    position: liquidityTxSummary.position.getAddress().toBase58(),
    signature: liquidityTxSummary.signature,
    [tokenA.metadata.symbol]: toStr(liquidityTxSummary.tokenAmountA.abs(), tokenA.mint.decimals),
    [tokenB.metadata.symbol]: toStr(liquidityTxSummary.tokenAmountB.abs(), tokenB.mint.decimals),
    usd: `$${Math.abs(liquidityTxSummary.usd)}`,
    fee: toStr(liquidityTxSummary.fee),
  });

  return liquidityTxSummary;
}
