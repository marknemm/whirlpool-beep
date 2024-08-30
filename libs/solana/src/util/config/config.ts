import { addLogTransformer, Config as CoreConfig, debug, type ConfigInitOptions } from '@npc/core';
import env from '@npc/solana/util/env/env';
import { PublicKey } from '@solana/web3.js';

/**
 * Configuration specific to the Solana library.
 *
 * @augments Config {@link CoreConfig Config} from `@npc/core`
 */
export class Config extends CoreConfig {

  /**
   * Initializes the Solana library.
   *
   * @param opts The {@link ConfigInitOptions}.
   */
  static async init(opts: ConfigInitOptions = {}) {
    await super.init({ suppressLogEnv: true });

    addLogTransformer((message) =>
      message instanceof PublicKey
        ? message.toBase58()
        : message
    );

    debug('-- Initialized Solana library --');
    if (!opts.suppressLogEnv) {
      debug('Environment variables loaded and validated:', { ...env }, '\n');
    }
  }

}

export default Config;
