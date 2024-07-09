/**
 * Makes a type both nullable and undefinable.
 *
 * @template T The type to make nullable and undefinable.
 */
export type Nullable<T> = T | Null;

/**
 * A union of `null` | `undefined`.
 */
export type Null = null | undefined;
