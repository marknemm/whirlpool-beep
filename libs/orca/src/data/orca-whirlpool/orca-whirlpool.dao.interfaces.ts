import type { OrcaWhirlpool } from '@npc/core';
import type { SimplifySingleResult } from 'kysely/dist/cjs/util/type-utils';

/**
 * Represents a single row in the {@link OrcaWhirlpool} table.
 */
export type OrcaWhirlpoolRow = SimplifySingleResult<OrcaWhirlpool>;
