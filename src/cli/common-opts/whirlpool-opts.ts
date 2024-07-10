/**
 * Generates the whirlpool options.
 *
 * @param action The action to perform on the whirlpool, which will be appended to the end of descriptions.
 * @returns The whirlpool options.
 */
export default function genGetWhirlpoolOpts(action = '') {
  return {
    'whirlpool': {
      alias: 'w',
      description: `Address of the whirlpool${action ? ` to ${action}` : ''}`,
      group: 'Whirlpool',
      type: 'string' as 'string' | undefined,
      conflicts: ['token-a', 'token-b', 'tick-spacing'],
    },
    'token-a': {
      alias: 'a',
      description: 'Token A mint address or symbol',
      group: 'Whirlpool PDA',
      type: 'string' as 'string' | undefined,
      implies: ['token-b', 'tick-spacing'],
      conflicts: ['whirlpool'],
    },
    'token-b': {
      alias: 'b',
      description: 'Token B mint address or symbol',
      group: 'Whirlpool PDA',
      type: 'string' as 'string' | undefined,
      implies: ['token-a', 'tick-spacing'],
      conflicts: ['whirlpool'],
    },
    'tick-spacing': {
      alias: 't',
      description: 'Tick spacing',
      group: 'Whirlpool PDA',
      type: 'number' as 'number' | undefined,
      implies: ['token-a', 'token-b'],
      conflicts: ['whirlpool'],
    },
  };
}
