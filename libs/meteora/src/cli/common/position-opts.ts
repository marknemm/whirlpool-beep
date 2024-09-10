import type { CliArgs, CliOpts } from '@npc/core';
import deepmerge from 'deepmerge';
import type { DeepPartial } from 'utility-types';

const _getPositionCliOpts = {
  'position': {
    alias: 'p',
    description: 'The address of the position to get',
    group: 'Position',
    type: 'string' as const,
    conflicts: ['pool', 'token-x', 'token-y', 'bin-step', 'base-fee'],
  }
};

const _liquidityCliOpts = {
  'liquidity': {
    alias: 'l',
    description: 'The amount of liquidity',
    group: 'Liquidity',
    type: 'number' as const,
  },
  'liquidity-unit': {
    alias: 'u',
    description: 'The unit to use for the liquidity amount',
    defaultDescription: 'usd',
    group: 'Liquidity',
    type: 'string' as const,
    implies: ['liquidity'],
  }
};

/**
 * Common arguments for getting a position.
 */
export type GetPositionCliArgs = CliArgs<typeof _getPositionCliOpts>;

/**
 * Common options for getting a position.
 */
export type GetPositionCliOpts = CliOpts<typeof _getPositionCliOpts>;

/**
 * Common arguments for position liquidity.
 */
export type LiquidityCliArgs = CliArgs<typeof _liquidityCliOpts>;

/**
 * Common options for position liquidity.
 */
export type LiquidityCliOpts = CliOpts<typeof _liquidityCliOpts>;

/**
 * Generates the {@link GetPositionCliOpts}.
 *
 * @param overrides The override {@link GetPositionCliOpts} to merge into the default options.
 * @returns The {@link GetPositionCliOpts}.
 */
export function genGetPositionCliOpts<
  T extends DeepPartial<GetPositionCliOpts>
>(overrides?: T): typeof _getPositionCliOpts & T {
  return overrides
    ? deepmerge(_getPositionCliOpts, overrides) as typeof _getPositionCliOpts & T
    : _getPositionCliOpts as typeof _getPositionCliOpts & T;
}

/**
 * Generates the {@link LiquidityCliOpts}.
 *
 * @param overrides The override {@link LiquidityCliOpts} to merge into the default options.
 * @returns The {@link LiquidityCliOpts}.
 */
export function genLiquidityCliOpts<
  T extends DeepPartial<LiquidityCliOpts>
>(overrides?: T): typeof _liquidityCliOpts & T {
  return overrides
    ? deepmerge(_liquidityCliOpts, overrides) as typeof _liquidityCliOpts & T
    : _liquidityCliOpts as typeof _liquidityCliOpts & T;
}
