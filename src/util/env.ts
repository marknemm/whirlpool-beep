import axios from 'axios';
import { loopWhile } from 'deasync';
import { bool, cleanEnv, num, str, url } from 'envalid';

// If running on AWS lambda, ENV vars will need to be loaded from SSM Param Store before continuing.
let _envReady = !process.env.AWS_SESSION_TOKEN;

if (!_envReady) {
  _loadSSMParams().then(() => _envReady = true);
  loopWhile(() => !_envReady); // Wait for SSM parameters to load before continuing (make sync).
}

/**
 * Preprocessed, validated, and strongly typed environment variables.
 */
const env = cleanEnv(process.env, {
  CHAIN_ID: num(),
  DB_HOST: str(),
  DB_NAME: str(),
  DB_PASSWORD: str(),
  DB_PORT: num({ default: 5432 }),
  DB_USER: str(),
  DB_SSL: bool({ default: true }),
  LOG_BREAK_LEN: num({ default: 40 }),
  LOG_COLOR: bool({ default: false }),
  LOG_DEPTH: num({ default: 3 }),
  LOG_LEVEL: str({ choices: ['debug', 'info'], default: 'info' }),
  LOG_TIMESTAMP: bool({ default: false }),
  NODE_ENV: str({ choices: ['development', 'production', 'test'] }),
  RPC_ENDPOINT: url(),
  TOKEN_LIST_API: url(),
  TOKEN_PRICE_API: url(),
  WALLET_ADDRESS: str(),
  WALLET_PRIVATE_KEY: str(),
  WHIRLPOOL_CONFIG_ADDRESS: str(),
  WHIRLPOOL_CONFIG_EXTENSION_ADDRESS: str(),
});

export default env;

/**
 * Securely loads and caches SSM parameters and secrets using the `AWS Parameters and Secrets Lambda Extension`.
 * Sets the process's environment variables ({@link process.env}) with the loaded values.
 *
 * @returns A {@link Promise} that resolves when all SSM parameters and secrets have been loaded.
 * @see https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html
 */
async function _loadSSMParams(): Promise<void> {
  const awsParamsUrl = `http://localhost:${process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? 2773}/systemsmanager/parameters/get`;
  const envParams = process.env.ENV_PARAMS?.trim()
    .split(/\s*,+\s*/)
    .filter((p) => !process.env[p]) ?? [];
  const envSecureParams = process.env.ENV_SECURE_PARAMS?.trim()
    .split(/\s*,+\s*/)
    .filter((p) => !process.env[p]) ?? [];

  const promises = envParams.concat(envSecureParams).map(async (envVarName, idx) => {
    const response = await axios.get<string>(awsParamsUrl, {
      headers: {
        'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN,
      },
      params: {
        name: encodeURIComponent(`/whirlpool-beep/${process.env.NODE_ENV}/${envVarName}`),
        withDecryption: idx >= envParams.length,
      },
    });

    if (response.status === 200 && response.data) {
      process.env[envVarName] = response.data;
    }
  });

  await Promise.all(promises);
}
