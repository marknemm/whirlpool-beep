import type { OrcaPosition } from '@npc/core';
import type { Selectable } from 'kysely';

/**
 * A single row in the `orca_position` table.
 */
export type OrcaPositionRow = Selectable<OrcaPosition>;

/**
 * The results of the `updateEmptied` data access operation.
 */
export interface UpdateEmptiedResults {

  /**
   * The ID of the fee reward transaction that was inserted into the DB.
   */
  feeRewardTxId: number | undefined;

  /**
   * The ID of the liquidity transaction that was inserted into the DB.
   */
  liquidityTxId: number | undefined;

}
