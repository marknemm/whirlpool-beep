import { debug, type ConfigInitOptions } from '@npc/core';
import env from '@npc/orca/util/env/env';
import { cacheIdl, Config as SolanaConfig } from '@npc/solana';
import { ORCA_WHIRLPOOL_PROGRAM_ID, WHIRLPOOL_IDL } from '@orca-so/whirlpools-sdk';

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

    debug('-- Initialized Orca library --');
    if (!opts.suppressLogEnv) {
      debug('Environment variables loaded and validated:', { ...env }, '\n');
    }
  }

}

export default Config;
