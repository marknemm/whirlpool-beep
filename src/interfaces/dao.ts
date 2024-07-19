import { Token, Whirlpool } from '@/interfaces/db';
import { SimplifySingleResult } from 'kysely/dist/cjs/util/type-utils';

/**
 * Options for inserting into the DAO.
 *
 * @augments DAOOptions
 */
export interface DAOInsertOptions extends DAOOptions {

  /**
   * Whether to ignore duplicates when inserting.
   *
   * @default false
   */
  ignoreDuplicates?: boolean;

}

/**
 * Options for the DAO operations.
 */
export interface DAOOptions {

  /**
   * Whether to catch errors, log them, and continue processing.
   *
   * @default false
   */
  catchErrors?: boolean;

}

/**
 * Represents a single row in the {@link Token} table.
 */
export type TokenRow = SimplifySingleResult<Token>;

/**
 * Represents a single row in the {@link Whirlpool} table.
 */
export type WhirlpoolRow = SimplifySingleResult<Whirlpool>;
