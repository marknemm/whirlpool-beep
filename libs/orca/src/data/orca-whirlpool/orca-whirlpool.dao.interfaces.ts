import type { OrcaWhirlpool } from '@npc/core';
import type { Selectable } from 'kysely';

/**
 * Represents a single row in the {@link OrcaWhirlpool} table.
 */
export type OrcaWhirlpoolRow = Selectable<OrcaWhirlpool>;
