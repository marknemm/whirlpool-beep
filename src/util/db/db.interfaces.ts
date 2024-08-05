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

export interface FeeRewardTx {
  createdAt: Generated<Timestamp>;
  fee: Int8;
  id: Generated<number>;
  position: number;
  signature: string;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
  usd: Numeric;
}

export interface LiquidityTx {
  createdAt: Generated<Timestamp>;
  fee: Int8;
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
  closeFee: Generated<Int8>;
  closeTx: string | null;
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  openFee: Int8;
  openTx: string;
  priceLower: Int8;
  priceMargin: number;
  priceOrigin: Int8;
  priceUpper: Int8;
  tickLowerIndex: number;
  tickUpperIndex: number;
  whirlpool: number;
}

export interface RebalanceTx {
  createdAt: Generated<Timestamp>;
  fee: Int8;
  id: Generated<number>;
  positionNew: number;
  positionOld: number;
  signature: string;
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
  feeRewardTx: FeeRewardTx;
  liquidityTx: LiquidityTx;
  position: Position;
  rebalanceTx: RebalanceTx;
  token: Token;
  whirlpool: Whirlpool;
}
