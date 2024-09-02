import type { MeteoraPool } from '@npc/core';
import type { Selectable } from 'kysely';

/**
 * Represents a single row in the {@link MeteoraPool} table.
 */
export type MeteoraPoolRow = Selectable<MeteoraPool>;
