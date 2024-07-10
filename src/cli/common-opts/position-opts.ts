/**
 * Generates common options for getting a position.
 *
 * @param action The action to perform on the position, which will be appended to the end of descriptions.
 * @returns The position options.
 */
export default function genGetPositionOpts(action = '') {
  return {
    'position': {
        alias: 'p',
        description: `The address of the position${action ? ` to ${action}` : ''}`,
        group: 'Position',
        type: 'string' as 'string' | undefined,
        conflicts: ['bundle-index', 'whirlpool', 'token-a', 'token-b', 'tick-spacing']
      },
      'bundle-index': {
        alias: 'i',
        description: `The bundle index of the position${action ? ` to ${action}` : ''}`,
        group: 'Position',
        type: 'number' as 'number' | undefined,
        conflicts: ['position', 'whirlpool', 'token-a', 'token-b', 'tick-spacing']
      }
  };
}
