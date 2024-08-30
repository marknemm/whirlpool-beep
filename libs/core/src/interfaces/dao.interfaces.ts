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
