import type { TransactionBuilder } from '@orca-so/common-sdk';
import type { PositionBundleData } from '@orca-so/whirlpools-sdk';
import type { PublicKey } from '@solana/web3.js';

/**
 * The return type of `genOpenPositionTx` function.
 */
export interface GenOpenPositionTxReturn {

  /**
   * The {@link PublicKey} address of the new {@link Position}.
   */
  address: PublicKey;

  /**
   * The bundle index of the new {@link Position}.
   */
  bundleIndex: number;

  /**
   * The {@link PositionBundleData PositionBundle} that will contain the new {@link Position}.
   */
  positionBundle: PositionBundleData;

  /**
   * The {@link TransactionBuilder} for creating the new {@link Position}.
   */
  tx: TransactionBuilder;

}
