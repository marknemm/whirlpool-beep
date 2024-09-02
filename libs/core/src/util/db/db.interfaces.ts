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

export interface MeteoraFee {
  id: Generated<number>;
  position: number;
  tokenAmountX: Int8;
  tokenAmountY: Int8;
  tx: number;
  usd: Numeric;
}

export interface MeteoraLiquidity {
  id: Generated<number>;
  liquidity: Int8;
  liquidityUnit: string;
  position: number;
  tokenAmountX: Int8;
  tokenAmountY: Int8;
  tx: number;
  usd: Numeric;
}

export interface MeteoraPool {
  address: string;
  baseFeePercentage: Numeric;
  binStep: number;
  id: Generated<number>;
  maxFeePercentage: Numeric;
  reserveX: string;
  reserveY: string;
  tokenX: number;
  tokenY: number;
}

export interface MeteoraPosition {
  address: string;
  closeTx: number | null;
  id: Generated<number>;
  maxBinId: number;
  minBinId: number;
  openTx: number;
  pool: number;
  priceLower: Int8;
  priceMargin: number;
  priceOrigin: Int8;
  priceUpper: Int8;
}

export interface MeteoraRebalance {
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  positionNew: number;
  positionOld: number;
}

export interface OrcaFee {
  id: Generated<number>;
  position: number;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
  tx: number;
  usd: Numeric;
}

export interface OrcaLiquidity {
  id: Generated<number>;
  liquidity: Int8;
  liquidityUnit: string;
  position: number;
  slippage: Numeric;
  tokenAmountA: Int8;
  tokenAmountB: Int8;
  tx: number;
  usd: Numeric;
}

export interface OrcaPosition {
  address: string;
  closeTx: number | null;
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  openTx: number;
  priceLower: Int8;
  priceMargin: number;
  priceOrigin: Int8;
  priceUpper: Int8;
  tickLowerIndex: number;
  tickUpperIndex: number;
  whirlpool: number;
}

export interface OrcaRebalance {
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  positionNew: number;
  positionOld: number;
}

export interface OrcaWhirlpool {
  address: string;
  feeRate: number;
  id: Generated<number>;
  tickSpacing: number;
  tokenA: number;
  tokenB: number;
  tokenVaultA: string;
  tokenVaultB: string;
}

export interface SolanaComputeBudget {
  computeUnitLimit: number | null;
  id: Generated<number>;
  priority: string | null;
  priorityFee: number | null;
  solanaTx: number | null;
}

export interface SolanaInnerIx {
  data: Json | null;
  id: Generated<number>;
  name: string;
  programId: string;
  programName: string;
  solanaIx: number | null;
}

export interface SolanaIx {
  data: Json | null;
  id: Generated<number>;
  programId: string;
  programName: string;
  solanaTx: number | null;
}

export interface SolanaToken {
  address: string;
  decimals: number;
  id: Generated<number>;
  name: string | null;
  symbol: string | null;
}

export interface SolanaTx {
  computeUnitsConsumed: number | null;
  createdAt: Generated<Timestamp>;
  fee: number;
  id: Generated<number>;
  signature: string | null;
  size: number;
}

export interface SolanaTxError {
  code: number | null;
  error: Json;
  id: Generated<number>;
  message: string;
  solanaTx: number | null;
}

export interface SolanaTxTransfer {
  amount: Int8 | null;
  destination: string | null;
  destinationOwner: string | null;
  id: Generated<number>;
  solanaToken: number | null;
  solanaTx: number | null;
  source: string | null;
  sourceOwner: string | null;
}

export interface DB {
  meteoraFee: MeteoraFee;
  meteoraLiquidity: MeteoraLiquidity;
  meteoraPool: MeteoraPool;
  meteoraPosition: MeteoraPosition;
  meteoraRebalance: MeteoraRebalance;
  orcaFee: OrcaFee;
  orcaLiquidity: OrcaLiquidity;
  orcaPosition: OrcaPosition;
  orcaRebalance: OrcaRebalance;
  orcaWhirlpool: OrcaWhirlpool;
  solanaComputeBudget: SolanaComputeBudget;
  solanaInnerIx: SolanaInnerIx;
  solanaIx: SolanaIx;
  solanaToken: SolanaToken;
  solanaTx: SolanaTx;
  solanaTxError: SolanaTxError;
  solanaTxTransfer: SolanaTxTransfer;
}
