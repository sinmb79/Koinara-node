# Koinara-node

`Koinara-node` is the standalone background node program for the Koinara network.

It lets an operator run as a provider, a verifier, or both with a direct Worldland RPC connection. This repository contains no hosted API, no business logic, and no deployment tooling.

## Protocol Compatibility

- Upstream protocol: [`sinmb79/koinara`](https://github.com/sinmb79/koinara)
- Pinned version: [`v0.1.6`](https://github.com/sinmb79/koinara/releases/tag/v0.1.6)
- Compatibility notes: [docs/protocol-compatibility.md](docs/protocol-compatibility.md)

## Features

- `provider`, `verifier`, or `both` roles
- `ollama` and `openai` inference backends
- direct contract interaction through `ethers v6`
- terminal-first `setup`, `doctor`, `status`, and long-running `node` commands
- local filesystem and HTTP discovery roots for off-chain manifests and submission receipts
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

- Chain profiles live in `config/chain.testnet.json` and `config/chain.mainnet.json`
- Runtime settings live in `node.config.json`
- Secrets live in `.env.local`

The example files are:

- `.env.example`
- `node.config.example.json`

## Off-chain Discovery

`koinara@v0.1.6` stores hashes on-chain, not payload URIs. `Koinara-node` therefore uses a companion discovery spec:

- `jobs/<requestHash>.json`
- `receipts/<jobId>-<responseHash>.json`

See [docs/network-spec.md](docs/network-spec.md) for the canonical format.

## Docs

- [docs/node-setup.md](docs/node-setup.md)
- [docs/operator-checklist.md](docs/operator-checklist.md)
- [docs/how-to-earn.md](docs/how-to-earn.md)
- [docs/network-spec.md](docs/network-spec.md)
- [docs/protocol-compatibility.md](docs/protocol-compatibility.md)
