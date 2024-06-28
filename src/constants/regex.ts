import { env } from '@/util/env';

/**
 * {@link RegExp} to detect secret (private key) strings.
 */
export const SECRETS_REGEX = new RegExp(`[1-9A-HJ-NP-Za-km-z]{80,}|${env.WALLET_PRIVATE_KEY}`, 'g');
