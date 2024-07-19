import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Collect {
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  position: number;
  signature: string;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
}

export interface Liquidity {
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  position: number;
  quote: Json | null;
  signature: string;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
  usd: Numeric;
}

export interface Position {
  address: string;
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  priceLower: Int8;
  priceMargin: number;
  priceOrigin: Int8;
  priceUpper: Int8;
  status: Generated<string>;
  tickLowerIndex: number;
  tickUpperIndex: number;
  whirlpool: number;
}

export interface Rebalance {
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  liquidity: Int8;
  positionNew: number;
  positionOld: number;
  signature: string;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
  tokenFeesA: Int8;
  tokenFeesB: Int8;
}

export interface Token {
  address: string;
  decimals: number;
  id: Generated<number>;
  name: string;
  symbol: string;
}

export interface Whirlpool {
  address: string;
  feeRate: Numeric;
  id: Generated<number>;
  tickSpacing: number;
  tokenA: number;
  tokenB: number;
  tokenVaultA: string;
  tokenVaultB: string;
}

export interface DB {
  collect: Collect;
  liquidity: Liquidity;
  position: Position;
  rebalance: Rebalance;
  token: Token;
  whirlpool: Whirlpool;
}
