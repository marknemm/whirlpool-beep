import { addLogTransformer, debug, type ConfigInitOptions } from '@npc/core';
import env from '@npc/orca/util/env/env';
import { cacheIdl, Config as SolanaConfig } from '@npc/solana';
import { Percentage } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, Position, Whirlpool, WHIRLPOOL_IDL } from '@orca-so/whirlpools-sdk';
import { formatPosition } from '../position/position';
import { formatWhirlpool } from '../whirlpool/whirlpool';

/**
 * Configuration specific to the Orca library.
 *
 * @augments Config {@link SolanaConfig Config} from `@npc/solana`
 */
export class Config extends SolanaConfig {

  /**
   * Initializes the Orca library.
   *
   * @param opts The {@link ConfigInitOptions} to use for initialization.
   */
  static async init(opts: ConfigInitOptions = {}) {
    await super.init({ suppressLogEnv: true });

    cacheIdl(ORCA_WHIRLPOOL_PROGRAM_ID, WHIRLPOOL_IDL);

    addLogTransformer((message) => {
      if (message instanceof Percentage) {
        return `${message.toString()}%`;
      }

      // Attempt to summarize Whirlpool or Position objects
      if (message instanceof Object) {
        if ('openPosition' in message || ('tickSpacing' in message && 'feeRate' in message)) {
          return formatWhirlpool(message as Whirlpool);
        }

        if ('collectFees' in message && 'collectRewards' in message) {
          return formatPosition(message as Position);
        }
      }

      return message;
    });

    debug('-- Initialized Orca library --');
    if (!opts.suppressLogEnv) {
      debug('Environment variables loaded and validated:', { ...env }, '\n');
    }
  }

}

export default Config;
