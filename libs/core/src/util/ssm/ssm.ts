import axios from 'axios';
import type { SSMParamResponse } from './ssm.interfaces';

/**
 * Securely loads and caches SSM parameters and secrets using the `AWS Parameters and Secrets Lambda Extension`.
 * Sets the process's environment variables ({@link process.env}) with the loaded values.
 *
 * @returns A {@link Promise} that resolves when all SSM parameters and secrets have been loaded.
 * @see https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html
 */
export async function loadSSMParams(): Promise<void> {
  if (!process.env.AWS_SESSION_TOKEN) return; // If running locally, use .env file(s) instead.

  const awsParamsUrl = `http://localhost:${process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? 2773}/systemsmanager/parameters/get`;

  // Load ENV context paths in order of precedence (highest to lowest)
  const envCtxBase = `/npc/${process.env.NODE_ENV}`;
  const envCtxs = process.env.ENV_CONTEXTS?.trim()
    .split(/\s*,+\s*/)
    .map((envCtx) => `${envCtxBase}/${envCtx}`) ?? [];
  envCtxs.push(`${envCtxBase}`); // Add the base context last (lowest precedence)

  const envParams = process.env.ENV_PARAMS?.trim()
    .split(/\s*,+\s*/)
    .filter((p) => !process.env[p]) ?? [];
  const envSecureParams = process.env.ENV_SECURE_PARAMS?.trim()
    .split(/\s*,+\s*/)
    .filter((p) => !process.env[p]) ?? [];

  console.log('Loading SSM parameters:', envParams, envSecureParams); // eslint-disable-line no-console
  const promises = envParams.concat(envSecureParams).map(async (envVarName, idx) => {
    console.log('Loading SSM parameter:', envVarName); // eslint-disable-line no-console

    for (const envCtx of envCtxs) {
      try {
        const response = await axios.get<SSMParamResponse>(awsParamsUrl, {
          headers: {
            'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN,
          },
          params: {
            name: encodeURIComponent(`${envCtx}/${envVarName}`),
            withDecryption: idx >= envParams.length,
          },
        });

        console.log(`Loaded SSM parameter (${envCtx}/):`, envVarName); // eslint-disable-line no-console
        if (response.status === 200 && response.data) {
          process.env[envVarName] = response.data.Parameter.Value;
          break; // Found in context, no need to look at lower precedence contexts
        }
      } catch (err) {} // Do nothing if the parameter is not found (log below)
    }

    if (process.env[envVarName] === undefined) {
      console.warn('Failed to load SSM parameter:', envVarName); // eslint-disable-line no-console
    }
  });

  await Promise.all(promises);
}

export type * from './ssm.interfaces';
