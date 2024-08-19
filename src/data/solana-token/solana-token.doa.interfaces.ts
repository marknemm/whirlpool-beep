import type { SolanaToken } from '@/util/db/db.interfaces';
import type { SimplifySingleResult } from 'kysely/dist/cjs/util/type-utils';

/**
 * Represents a single row in the {@link SolanaToken} table.
 */
export type SolanaTokenRow = SimplifySingleResult<SolanaToken>;
