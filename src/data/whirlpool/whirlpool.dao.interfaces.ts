import type { Whirlpool } from '@/util/db/db.interfaces';
import type { SimplifySingleResult } from 'kysely/dist/cjs/util/type-utils';

/**
 * Represents a single row in the {@link Whirlpool} table.
 */
export type WhirlpoolRow = SimplifySingleResult<Whirlpool>;
