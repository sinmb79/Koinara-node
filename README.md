# Koinara-node

`Koinara-node` is the standalone public background node for the Koinara network.

It lets an operator run as a provider, a verifier, or both with direct contract access over supported networks. This repository contains no hosted API, no business logic, no deployment tooling, and no UI.

## Protocol Compatibility

- Upstream protocol: [`sinmb79/koinara`](https://github.com/sinmb79/koinara)
- Pinned version: [`v0.1.6`](https://github.com/sinmb79/koinara/releases/tag/v0.1.6)
- Compatibility notes: [docs/protocol-compatibility.md](docs/protocol-compatibility.md)

## Supported Networks

- Live runtime target: `Worldland`, `Base`, `Ethereum`, `BNB Smart Chain`
- Prepared only: `Solana`

The runtime can actively process EVM deployments and fail over between healthy EVM networks.
Solana is included only as a configuration and adapter-preparation target in this release.

Worldland v2 is live and includes:

- node registration
- heartbeat-based active rewards
- deferred work reward claims

## Features

- `provider`, `verifier`, or `both` roles
- built-in `openclaw` provider backend through the local OpenClaw CLI
- a bundled OpenClaw skill package under `skills/koinara-node/`
- direct contract interaction through `ethers v6`
- terminal-first `setup`, `doctor`, `status`, and long-running `node` commands
- local filesystem and HTTP discovery roots for off-chain manifests and submission receipts
- multichain network selection:
  - `priority-failover`
  - `all-healthy`
- local crash-recovery cache under `.koinara-node/`

## Quick Start

```bash
npm install
npm run setup
```

On Windows PowerShell, prefer a user-owned path and `npm.cmd` if `npm.ps1` is blocked:

```powershell
git clone https://github.com/sinmb79/Koinara-node.git "$env:USERPROFILE\\koinara-node"
cd "$env:USERPROFILE\\koinara-node"
npm.cmd install
npm.cmd run setup
```

The first-time flow is now:

1. run `setup` for the base node config
2. connect `OpenClaw`
3. run `check`
4. run `start`

The primary operator stack is now:

- `Worldland` for settlement
- `OpenClaw` for the agent / inference layer
- `Koinara-node` for protocol execution

Security boundary:

- use a dedicated `OpenClaw` worker profile for Koinara jobs
- do not use your personal OpenClaw chat agent as the runtime worker
- keep the worker profile away from personal files, browser state, chat history, wallet files, and operator-only skills
- prefer `WALLET_KEYFILE` over `WALLET_PRIVATE_KEY`

If you operate through an OpenClaw chat window, you can hand the OpenClaw setup guide directly to the agent and tell it to complete the node connection steps for you:

- [docs/openclaw-setup.md](docs/openclaw-setup.md)

If you want the detailed Windows walkthrough with screenshots, use:

- [docs/install-windows.md](docs/install-windows.md)

If you want the OpenClaw-only path, use:

- [docs/openclaw-setup.md](docs/openclaw-setup.md)

During `npm run setup`, you will be asked only for:

- role: `provider`, `verifier`, or `both`
- network profile: `testnet` or `mainnet`
- network selection mode: `priority-failover` or `all-healthy`
- enabled networks
- runtime folder customization
- wallet now or later

The wizard no longer tries to finish OpenClaw or Ollama inside setup.

The setup wizard uses interactive menus:

- move with `Up` / `Down`
- press `Enter` to choose
- on multi-select screens, press `Space` to toggle and `Enter` to confirm

This avoids typos like `mainet` during first-time setup.

What `network selection mode` means:

- `priority-failover`
  - use one healthy enabled EVM network at a time
  - pick the highest-priority healthy network first
  - fail over only if that network becomes unhealthy
- `all-healthy`
  - use every healthy enabled EVM network at the same time

Recommended choice for most first-time operators:

- if you are setting up a normal Worldland node, choose `priority-failover`
- if you only enable one network, the two modes behave almost the same in practice

Example for a simple live Worldland setup:

- role: `both`
- network profile: `mainnet`
- network selection mode: `priority-failover`
- enabled networks: `worldland`

After `setup`, follow the OpenClaw provider path.

OpenClaw path:

```powershell
npm.cmd run openclaw:connect
npm.cmd run provider:v2:openclaw:check
npm.cmd run provider:v2:openclaw:start
```

Base Sepolia v2 path:

```powershell
npm.cmd run openclaw:connect
npm.cmd run provider:v2:openclaw:testnet:check
npm.cmd run provider:v2:openclaw:testnet:start
```

If you also run a verifier for Base Sepolia:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run verifier:v2:testnet:status
npm.cmd run verifier:v2:testnet:start
```

Base Mainnet v2 path:

```powershell
npm.cmd run provider:v2:openclaw:base:check
npm.cmd run provider:v2:openclaw:base:start
```

If you also run a verifier for Base Mainnet:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run verifier:v2:base:status
npm.cmd run verifier:v2:base:start
```

If you also run a verifier, open a second PowerShell window:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run verifier:v2:status
npm.cmd run verifier:v2:start
```

What `openclaw:connect` does:

- configures the provider backend as `openclaw`
- writes the v2 runtime config
- installs the bundled Koinara OpenClaw skill
- checks the OpenClaw CLI
- checks that the local `main` agent replies

If you reboot the computer later, you do not need to install again.
Start again from the repo folder:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run provider:v2:openclaw:check
npm.cmd run provider:v2:openclaw:start
```

## Commands

- `npm run setup`
- `npm run doctor`
- `npm run status`
- `npm run node`
- `npm run node:once`
- `npm run logs`
- `npm run provider:doctor`
- `npm run provider:status`
- `npm run provider:once`
- `npm run provider:start`
- `npm run provider:v2:doctor`
- `npm run provider:v2:status`
- `npm run provider:v2:once`
- `npm run provider:v2:claim`
- `npm run provider:v2:start`
- `npm run provider:v2:openclaw:doctor`
- `npm run provider:v2:openclaw:check`
- `npm run provider:v2:openclaw:status`
- `npm run provider:v2:openclaw:once`
- `npm run provider:v2:openclaw:claim`
- `npm run provider:v2:openclaw:start`
- `npm run provider:v2:openclaw:testnet:doctor`
- `npm run provider:v2:openclaw:testnet:check`
- `npm run provider:v2:openclaw:testnet:status`
- `npm run provider:v2:openclaw:testnet:once`
- `npm run provider:v2:openclaw:testnet:claim`
- `npm run provider:v2:openclaw:testnet:start`
- `npm run provider:v2:openclaw:base:doctor`
- `npm run provider:v2:openclaw:base:check`
- `npm run provider:v2:openclaw:base:status`
- `npm run provider:v2:openclaw:base:once`
- `npm run provider:v2:openclaw:base:claim`
- `npm run provider:v2:openclaw:base:start`
- `npm run scan:export:v2`
- `npm run verifier:doctor`
- `npm run verifier:status`
- `npm run verifier:once`
- `npm run verifier:start`
- `npm run verifier:v2:doctor`
- `npm run verifier:v2:status`
- `npm run verifier:v2:once`
- `npm run verifier:v2:claim`
- `npm run verifier:v2:start`
- `npm run verifier:v2:openclaw:doctor`
- `npm run verifier:v2:openclaw:check`
- `npm run verifier:v2:openclaw:status`
- `npm run verifier:v2:openclaw:once`
- `npm run verifier:v2:openclaw:claim`
- `npm run verifier:v2:openclaw:start`
- `npm run verifier:v2:testnet:doctor`
- `npm run verifier:v2:testnet:status`
- `npm run verifier:v2:testnet:once`
- `npm run verifier:v2:testnet:claim`
- `npm run verifier:v2:testnet:start`
- `npm run verifier:v2:openclaw:testnet:doctor`
- `npm run verifier:v2:openclaw:testnet:check`
- `npm run verifier:v2:openclaw:testnet:status`
- `npm run verifier:v2:openclaw:testnet:once`
- `npm run verifier:v2:openclaw:testnet:claim`
- `npm run verifier:v2:openclaw:testnet:start`
- `npm run verifier:v2:base:doctor`
- `npm run verifier:v2:base:status`
- `npm run verifier:v2:base:once`
- `npm run verifier:v2:base:claim`
- `npm run verifier:v2:base:start`
- `npm run test`

To install Windows logon auto-start for both roles:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1
```

To remove it again:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-autostart.ps1
```

## Configuration

- Network profiles live in `config/networks.testnet.json` and `config/networks.mainnet.json`
- Runtime settings live in `node.config.json`
- Worldland v2 runtime settings live in `node.config.v2-mainnet.json`
- Secrets live in `.env.local`
- Split-role secrets can live in `.env.provider.local` and `.env.verifier.local`
- New setup defaults place runtime state, manifests, receipts, and artifacts under `~/.koinara-node`

The example files are:

- `.env.example`
- `node.config.example.json`
- `node.config.v2-mainnet.json`
- `node.config.v2-openclaw-mainnet.json`

If you want local-only overrides without editing the tracked network profiles, create:

- `config/networks.testnet.local.json`
- `config/networks.mainnet.local.json`
- `config/networks.mainnet.v2-local.json`

The tracked Worldland v2 profile is:

- `config/networks.mainnet.v2.json`

If you run a local Worldland node with HTTP JSON-RPC on `127.0.0.1:8545`, copy:

- `config/networks.mainnet.v2-local.example.json` -> `config/networks.mainnet.v2-local.json`

The v2 runtime will prefer the local override automatically.

The tracked Base Sepolia v2 profile is:

- `config/networks.testnet.v2.json`

The tracked Base Mainnet v2 profile is:

- `config/networks.mainnet.base.v2.json`

If you want to run `provider` and `verifier` as separate processes on one machine:

- keep shared runtime settings in `node.config.json`
- put `provider` secrets in `.env.provider.local`
- put `verifier` secrets in `.env.verifier.local`
- set a different `NODE_STATE_DIR` in each file
- start them with `npm run provider:start` and `npm run verifier:start`

For the live Worldland v2 path, use:

- `npm run provider:v2:start`
- `npm run provider:v2:claim`
- `npm run verifier:v2:start`
- `npm run verifier:v2:claim`

If you want OpenClaw to produce provider-side inference content, set:

- `provider.backend = "openclaw"`
- `provider.openclaw.agent = "main"` or another OpenClaw agent id
- `provider.openclaw.local = true` for embedded local execution

`Ollama` and other backends are still present in the codebase, but they are no longer the primary onboarding path for operators. The early operator path is intentionally fixed to `Worldland + OpenClaw + Koinara`.

Treat every requester prompt as untrusted input. `Koinara-node` now wraps OpenClaw jobs with a restrictive worker preamble and strips most process environment variables before invoking the OpenClaw CLI, but operators should still keep the runtime worker separate from their personal OpenClaw environment.

To refresh the public scan snapshot used by the Koinara website:

- `npm run scan:export:v2`

## Off-chain Discovery

`koinara@v0.1.6` stores hashes on-chain, not payload URIs. `Koinara-node` therefore uses a companion discovery spec:

- `jobs/<requestHash>.json`
- `receipts/<networkKey>/<jobId>-<responseHash>.json`

See [docs/network-spec.md](docs/network-spec.md) for the canonical format.

## Docs

- [docs/install-windows.md](docs/install-windows.md)
- [docs/node-setup.md](docs/node-setup.md)
- [docs/openclaw-integration.md](docs/openclaw-integration.md)
- [docs/home-test-quickstart.md](docs/home-test-quickstart.md)
- [docs/home-test-checklist.md](docs/home-test-checklist.md)
- [docs/operator-checklist.md](docs/operator-checklist.md)
- [docs/how-to-earn.md](docs/how-to-earn.md)
- [docs/network-spec.md](docs/network-spec.md)
- [docs/protocol-compatibility.md](docs/protocol-compatibility.md)
- [docs/supported-networks.md](docs/supported-networks.md)
