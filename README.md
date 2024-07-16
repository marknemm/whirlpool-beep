# Whirlpool Beep

***Beep-boop-bop** I'm a bot* 🤖

A **TS Node** project that automates interaction with the **Orca Whirlpool** smart contract.

Consists of the following executables:

- **CLI**: Execute commands locally to query and manage assets.
- **λ Functions**: Deploy automated tasks to a serverless cloud provider.

## Quickstart

1) Run `npm install` to install [node_modules](node_modules) dependencies.
2) copy [.env.example](.env.example) to a file named [.env](.env). Optionally:
    - Copy [.env.development](.env.development) to a file named [.env.development.local](.env.development.local) to override development specific config.
    - Copy [.env.production](.env.production) to a file named [.env.production.local](.env.production.local) to override production specific config.
3) Fill in missing env variables within the new [.env](.env) file(s).
4) Run `npm run [dev | prod]` to run the **CLI** program against **[devnet | mainnet]**.

## NPM Scripts

- `build`: Compile all TS under [src](src) for both **CLI** and **λ Functions**.
- `build:cli`: Compile all TS under [src](src) for **CLI** and output to [dist](dist).
- `build:fn`: Compile all TS under [src](src) for **λ Functions** and package under [.serverless](.serverless).
- `clean`: Clean standard build and package output.
- `clean:all`: Clean standard build and package output as well as [node_modules](node_modules) dependencies.
- `dev`: Run the **CLI** in interactive mode against **devnet**.
- `dev:cli`: Run the **CLI** in non-interactive mode against **devnet**.
- `dev:dbg`: Run the **CLI** in interactive mode with debugger against **devnet**.
- `dev:deploy`: Package & deploy **λ Functions** to cloud provider for **devnet**.
- `dev:env`: Setup dev env for running **CLI** locally against **devnet**.
- `dev:package`: Package **λ Functions** for **devnet** and output artifacts under [.serverless](.serverless).
- `dev:sls`: Run **λ Functions** against **devnet** using a local simulated cloud provider.
- `lint`: Run **eslint** against TS files under [src](src).
- `node:ts`: Run node with TS config.
- `node:dbg`: Run node with TS config in debug mode.
- `prod`: Run the **CLI** in interactive mode against **mainnet**.
- `prod:cli`: Run the **CLI** in non-interactive mode against **mainnet**.
- `prod:dbg`: Run the **CLI** in interactive mode with debugger against **mainnet**.
- `prod:deploy`: Package & deploy **λ Functions** to cloud provider for **mainnet**.
- `prod:env`: Setup prod env for running **CLI** locally against **mainnet**.
- `prod:package`: Package **λ Functions** for **mainnet** and output artifacts under [.serverless](.serverless).
- `prod:sls`: Run **λ Functions** against **mainnet** using a local simulated cloud provider.
- `start`: Run **CLI** JS program with entrypoint [dist/index.js](dist/index.js).
- `start:ts`: Run **CLI** TS program with entrypoint [src/index.ts](src/index.ts).
- `start:dbg`: Run **CLI** TS program in debug mode with entrypoint [src/index.ts](src/index.ts).
- `test`: Run unit tests.
