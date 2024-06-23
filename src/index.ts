import 'dotenv/config'; // This import block MUST come before any other imports.
import 'module-alias/register';

import { validatePrivateKey } from '@/util/wallet-keys';

/**
 * Main entry point.
 */
async function main() {
  try {
    await validatePrivateKey();
    console.log('WALLET_PRIVATE_KEY is valid');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
