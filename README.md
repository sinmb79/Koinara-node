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

The v1 runtime can actively process EVM deployments and fail over between healthy EVM networks.
Solana is included only as a configuration and adapter-preparation target in this release.

## Features

- `provider`, `verifier`, or `both` roles
- `ollama` and `openai` inference backends
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

For a single pass instead of a daemon loop:

```bash
npm run node:once
```

## Commands

- `npm run setup`
- `npm run doctor`
- `npm run status`
- `npm run node`
- `npm run node:once`
- `npm run logs`
- `npm run test`

## Configuration

- Network profiles live in `config/networks.testnet.json` and `config/networks.mainnet.json`
- Runtime settings live in `node.config.json`
- Secrets live in `.env.local`

The example files are:

- `.env.example`
- `node.config.example.json`

## Off-chain Discovery

`koinara@v0.1.6` stores hashes on-chain, not payload URIs. `Koinara-node` therefore uses a companion discovery spec:

- `jobs/<requestHash>.json`
- `receipts/<networkKey>/<jobId>-<responseHash>.json`

See [docs/network-spec.md](docs/network-spec.md) for the canonical format.

## Docs

- [docs/node-setup.md](docs/node-setup.md)
- [docs/openclaw-integration.md](docs/openclaw-integration.md)
- [docs/home-test-quickstart.md](docs/home-test-quickstart.md)
- [docs/home-test-checklist.md](docs/home-test-checklist.md)
- [docs/operator-checklist.md](docs/operator-checklist.md)
- [docs/how-to-earn.md](docs/how-to-earn.md)
- [docs/network-spec.md](docs/network-spec.md)
- [docs/protocol-compatibility.md](docs/protocol-compatibility.md)
- [docs/supported-networks.md](docs/supported-networks.md)
