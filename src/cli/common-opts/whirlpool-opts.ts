/**
 * Generates the whirlpool options.
 *
 * @param description The description of the whirlpool. Defaults to `Address of whirlpool`.
 * @returns The whirlpool options.
 */
export default function genWhirlpoolOpts(description = 'Address of whirlpool') {
  return {
    'whirlpool': {
      alias: 'w',
      description,
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
