import type { OrcaWhirlpool } from '@npc/db';
import type { Selectable } from 'kysely';

/**
 * Represents a single row in the {@link OrcaWhirlpool} table.
 */
export type OrcaWhirlpoolRow = Selectable<OrcaWhirlpool>;
