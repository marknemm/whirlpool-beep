import type { InstructionData } from '@/util/transaction-context/transaction-context';
import type { Address } from '@coral-xyz/anchor';
import type { Whirlpool } from '@orca-so/whirlpools-sdk';

/**
 * The {@link InstructionData} for creating a Whirlpool.
 */
export interface CreateWhirlpoolIxData extends InstructionData {

  /**
   * The initial tick index designating the initial price for the {@link Whirlpool}.
   */
  initialTick: number;

  /**
   * The tick spacing for the {@link Whirlpool}.
   */
  tickSpacing: number;

  /**
   * The {@link Address} of {@link Whirlpool} token A.
   */
  tokenAddressA: Address;

  /**
   * The {@link Address} of {@link Whirlpool} token B.
   */
  tokenAddressB: Address;

  /**
   * The {@link Address} of the new {@link Whirlpool}.
   */
  whirlpoolAddress: Address;

}
