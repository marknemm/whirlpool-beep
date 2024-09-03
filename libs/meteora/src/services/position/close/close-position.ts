import type { Position } from '@npc/meteora/interfaces/position';
import { getPool } from '@npc/meteora/services/pool/query/query-pool';

export async function closePosition(position: Position) {
  const pool = await getPool({ poolAddress: position.poolPublicKey });

  pool
}
