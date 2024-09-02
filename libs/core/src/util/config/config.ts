import { migrateDB } from '@npc/core/util/db/db';
import env from '@npc/core/util/env/env';
import { addLogTransformer, debug } from '@npc/core/util/log/log';
import { numericToNumber } from '@npc/core/util/numeric/numeric';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import type { ConfigInitOptions } from './config.interfaces';

/**
 * Configuration specific to the Core library.
 */
export class Config {

  protected constructor() {} // Pure static class

  /**
   * Initializes the Core library.
   *
   * @param opts The {@link ConfigInitOptions} to use for initialization.
   */
  static async init(opts: ConfigInitOptions = {}) {
    if (env.DB_MIGRATE) {
      await migrateDB();
    }

    addLogTransformer((message) => {
      if (message instanceof BN || message instanceof Decimal || typeof message === 'bigint') {
        try {
          return numericToNumber(message);
        } catch (err) {
          return message.toString();
        }
      }
      return message;
    });

    debug('-- Initialized Core library --');
    if (!opts.suppressLogEnv) {
      debug('Environment variables loaded and validated:', { ...env }, '\n');
    }
  }

}

export type * from './config.interfaces';
export default Config;
