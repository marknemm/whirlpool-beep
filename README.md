# Whirlpool Beep

***Beep-boop-bop** I'm a bot* 🤖

A **TS Node** project that automates interaction with the **Orca Whirlpool** smart contract.

Consists of the following executables:

- **CLI**: Execute commands locally to query and manage assets.
- **λ Functions**: Deploy automated tasks to a serverless cloud provider.

## Quickstart

1) Install [Node.js](https://nodejs.org/en/download/package-manager) and [Docker](https://docs.docker.com/engine/install/).
2) Run `npm install` to install [node_modules](node_modules) dependencies.
3) copy [.env.example](.env.example) to a file named [.env](.env). Optionally:
    - Copy [.env.development](.env.development) to a file named [.env.development.local](.env.development.local) to override development specific config.
    - Copy [.env.production](.env.production) to a file named [.env.production.local](.env.production.local) to override production specific config.
4) Fill in missing env variables within the new [.env](.env) file(s).
5) Run `npm run [dev | prod]` to run the **CLI** program against **[devnet | mainnet]**.

## NPM Scripts

- `build`: Compile all TS under [src](src) for both **CLI** and **λ Functions**.
- `build:cli`: Compile all TS under [src](src) for **CLI** and output to [dist](dist).
- `build:fn`: Compile all TS under [src](src) for **λ Functions** and package under [.serverless](.serverless).
- `clean`: Clean standard build and package output.
- `clean:all`: Clean standard build and package output, log output, and [node_modules](node_modules) dependencies.
- `clean:deps`: Clean [node_modules](node_modules) dependencies.
- `clean:logs`: Clean log output.
- `dev`: Run the **CLI** in interactive mode against **devnet**.
- `dev:cli`: Run the **CLI** in non-interactive mode against **devnet**. E.g. `npm run dev:cli util.ts`.
- `dev:deploy`: Package & deploy **λ Functions** to cloud provider for **devnet**.
- `dev:env`: Setup dev env for running **CLI** locally against **devnet**.
- `dev:kysely`: Run **kysely** CLI for dev **Postgres** database migration management.
- `dev:kysely:codegen`: Run **kysely-codegen** CLI for **TS** interface generation using the dev **Postgres** database. Outputs to file [db.ts](src/interfaces/db.ts).
- `dev:kysely:migrate`: Run **kysely** CLI for dev **Postgres** database to migrate to the latest migration. Then, run **kysely-codegen** CLI for **TS** interface generation using the dev **Postgres** database. Outputs to file [db.ts](src/interfaces/db.ts).
- `dev:package`: Package **λ Functions** for **devnet** and output artifacts under [.serverless](.serverless).
- `dev:sls`: Run **λ Functions** against **devnet** using a local simulated cloud provider.
- `lint`: Run **eslint** against TS files under [src](src).
- `node:ts`: Run node with TS config.
- `node:cli`: Run node with TS config from within the [src/cli](src/cli) directory.
- `prod`: Run the **CLI** in interactive mode against **mainnet**.
- `prod:cli`: Run the **CLI** in non-interactive mode against **mainnet**. E.g. `npm run prod:cli util.ts`.
- `prod:deploy`: Package & deploy **λ Functions** to cloud provider for **mainnet**.
- `prod:env`: Setup prod env for running **CLI** locally against **mainnet**.
- `prod:kysely`: Run **kysely** CLI for prod **Postgres** database migration management. Migrations are found under [migrations](migrations).
- `prod:kysely:codegen`: Run **kysely-codegen** CLI for **TS** interface generation using the prod **Postgres** database. Outputs to file [db.ts](src/interfaces/db.ts).
- `prod:kysely:migrate`: Run **kysely** CLI for prod **Postgres** database to migrate to the latest migration. Then, run **kysely-codegen** CLI for **TS** interface generation using the prod **Postgres** database. Outputs to file [db.ts](src/interfaces/db.ts).
- `prod:package`: Package **λ Functions** for **mainnet** and output artifacts under [.serverless](.serverless).
- `prod:sls`: Run **λ Functions** against **mainnet** using a local simulated cloud provider.
- `start`: Run **CLI** JS program with entrypoint [dist/index.js](dist/index.js).
- `start:ts`: Run **CLI** TS program with entrypoint [src/index.ts](src/index.ts).
- `test`: Run unit tests.

## VSCode Extensions

- SQLTools
- Docker
- ESLint
- DotENV

## Dev Sample Data

All sample data addresses can be viewed here: https://everlastingsong.github.io/nebula/

Use the following to airdrop dev SOL: https://faucet.solana.com/

### Dev Tokens

Symbol | Address | Decimals |
:---: | :---: | :---: |
SOL | So11111111111111111111111111111111111111112 | 9 |
devUSDC | BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k | 6 |
devUSDT | H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm | 6 |
devSAMO | Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa | 9 |
devTMAC | Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6 | 6 |

### Dev Whirlpools

Token A | Token B | Tick Spacing |
:---: | :---: | :---: |
SOL | BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k | 64 |
BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k | H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm | 1 |
Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa | BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k | 64 |
 Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6 | BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k | 64 |

### Sample CLI arguments for Dev Whirlpools

- SOL / devUSDC

        -a SOL -b BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k -t 64

- devUSDC / devUSDT

        -a BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k -b H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPm -t 1

- devSAMO / devUSDC

        -a Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa -b BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k -t 64

- devTMAC / devUSDC

        -a Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6 -b BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k -t 64

## Misc Resources

- https://www.orca.so/pools
- https://orca-so.gitbook.io/orca-developer-portal
- https://github.com/everlastingsong/tour-de-whirlpool
- https://solana.com/docs/intro/overview
- https://explorer.solana.com/
- https://dexscreener.com/
