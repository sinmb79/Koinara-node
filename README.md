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
- `ollama` and `openai` inference backends
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
npm run doctor
npm run node
```

On Windows PowerShell, prefer a user-owned path and `npm.cmd` if `npm.ps1` is blocked:

```powershell
git clone https://github.com/sinmb79/Koinara-node.git "$env:USERPROFILE\\koinara-node"
cd "$env:USERPROFILE\\koinara-node"
npm.cmd install
npm.cmd run setup
```

You can also use the built-in bootstrap helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-windows.ps1
```

For a single pass instead of a daemon loop:

```bash
npm run node:once
```

If you want to install the bundled OpenClaw skill globally:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-openclaw-skill.ps1
```

If you want the detailed Windows walkthrough with screenshots, use:

- [docs/install-windows.md](docs/install-windows.md)

During `npm run setup`, you will be asked for:

- role: `provider`, `verifier`, or `both`
- network profile: `testnet` or `mainnet`
- network selection mode: `priority-failover` or `all-healthy`
- enabled networks
- provider inference source: `openclaw` or local LLM via `ollama` when provider mode is enabled
- supported job types: `Simple`, `General`, `Collective`

The first-time wizard keeps runtime folders and polling on standard defaults unless you explicitly choose to customize advanced settings. It also lets you skip wallet entry and fill it later before starting the node.

The setup wizard now uses interactive menus.

- move with `Up` / `Down`
- press `Enter` to choose
- on multi-select screens, press `Space` to toggle and `Enter` to confirm

This avoids typos like `mainet` during first-time setup.

For most first-time operators:

- choose `OpenClaw agent` if you want Koinara to use OpenClaw on this same computer
- choose `local LLM (Ollama)` if you want Koinara to use Ollama on this same computer
- after you choose one, setup applies the normal default local settings automatically
- if you choose `OpenClaw agent`, setup also tries to install the bundled Koinara OpenClaw skill automatically
- on Windows PowerShell, the safer OpenClaw command is usually `openclaw.cmd`

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
- provider inference source: choose either `OpenClaw agent` or `local LLM (Ollama)`

After setup, the most useful first command is:

```powershell
npm.cmd run provider:v2:openclaw:check
```

It shows:

- whether the node can read its config
- whether the provider path is connected
- current epoch
- next epoch close time
- recent provider jobs
- recent verifier actions
- claimable reward estimates

If you choose `OpenClaw agent` during setup:

- the node stores an OpenClaw-backed provider config
- on Windows PowerShell it uses `openclaw.cmd`
- on macOS / Linux it uses `openclaw`
- it uses the default agent id `main`
- it runs a quick OpenClaw connection check before saving the config
- it tries to install the bundled OpenClaw skill automatically
- it keeps the normal runtime folders and polling defaults unless you choose to customize them

Manual OpenClaw check command:

```powershell
openclaw.cmd agent --agent main --local --json --thinking low --timeout 120 --message "Reply with exactly OK"
```

What a good first-time result looks like after `npm.cmd run setup`:

- `Provider connection check: ready`
- `Wallet for on-chain actions: configured` or `not configured yet`
- `Setup saved the config files, but the node is not running yet.`
- a short list of next commands including `check`, `start`, and `claim`

What `Provider connection check: not ready` means:

- the bundled Koinara OpenClaw skill may already be installed
- but the OpenClaw CLI is still not available from this PowerShell session
- the config was saved, but OpenClaw itself is not ready yet

If that happens, run these in order:

```powershell
cd $env:USERPROFILE\koinara-node
openclaw.cmd --help
openclaw.cmd agent --agent main --local --json --thinking low --timeout 120 --message "Reply with exactly OK"
npm.cmd run provider:v2:openclaw:check
```

What those three commands tell you:

- `openclaw.cmd --help`
  - whether this computer can launch the OpenClaw CLI at all
- `openclaw.cmd agent ...`
  - whether the local OpenClaw agent actually answers
- `npm.cmd run provider:v2:openclaw:check`
  - whether Koinara-node is configured, which epoch is active, when the next epoch closes, what recent jobs were seen, and what rewards are currently claimable

If you choose `local LLM (Ollama)` during setup:

- the node stores an Ollama-backed provider config
- it uses the normal default base URL `http://127.0.0.1:11434`
- it uses the default model `llama3.1`
- it runs a quick Ollama connection check before saving the config

What `supported job types` means:

- `Simple`
  - fast, smaller jobs
  - easiest starting point for a new operator
- `General`
  - normal multi-step jobs
  - broader participation than `Simple`
- `Collective`
  - harder jobs that benefit from wider participation and stronger consensus

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

The tracked Worldland v2 profile is:

- `config/networks.mainnet.v2.json`

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
