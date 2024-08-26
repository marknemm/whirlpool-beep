import type { SolanaToken } from '@npc/db';
import type { Selectable } from 'kysely';

/**
 * Represents a single row in the {@link SolanaToken} table.
 */
export type SolanaTokenRow = Selectable<SolanaToken>;
