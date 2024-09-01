import { IDL, LBCLMM_PROGRAM_IDS, } from '@meteora-ag/dlmm';
import { debug, type ConfigInitOptions } from '@npc/core';
import env from '@npc/meteora/util/env/env';
import { cacheIdl, Config as SolanaConfig } from '@npc/solana';

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

    env.NODE_ENV === 'production'
      ? cacheIdl(LBCLMM_PROGRAM_IDS['mainnet-beta'], IDL)
      : cacheIdl(LBCLMM_PROGRAM_IDS['devnet'], IDL);

    debug('-- Initialized Orca library --');
    if (!opts.suppressLogEnv) {
      debug('Environment variables loaded and validated:', { ...env }, '\n');
    }
  }

}

export default Config;
