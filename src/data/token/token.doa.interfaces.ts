import type { Token } from '@/util/db/db.interfaces';
import type { SimplifySingleResult } from 'kysely/dist/cjs/util/type-utils';

/**
 * Represents a single row in the {@link Token} table.
 */
export type TokenRow = SimplifySingleResult<Token>;
