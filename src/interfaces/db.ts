import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Position {
  address: string;
  createdAt: Generated<Timestamp>;
  liquidity: Int8;
  priceLower: Numeric;
  priceUpper: Numeric;
  tickLower: number;
  tickUpper: number;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
  whirlpool: string;
}

export interface RebalanceTx {
  address: string;
  createdAt: Generated<Timestamp>;
  liquidity: Int8;
  positionNew: string;
  positionOld: string;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
  tokenFeesA: Int8;
  tokenFeesB: Int8;
}

export interface Token {
  address: string;
  decimals: number;
  name: string;
  symbol: string;
}

export interface Whirlpool {
  address: string;
  feeRate: Numeric;
  tickSpacing: number;
  tokenA: string;
  tokenB: string;
  tokenVaultA: string;
  tokenVaultB: string;
}

export interface DB {
  position: Position;
  rebalanceTx: RebalanceTx;
  token: Token;
  whirlpool: Whirlpool;
}
