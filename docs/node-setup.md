# Node Setup

## Prerequisites

- Node.js 20+
- A funded wallet on at least one enabled EVM network
- Access to a manifest root and a receipt root
- One inference backend:
  - Ollama for local inference
  - OpenAI for hosted inference

## Setup

```bash
npm install
npm run setup
```

The setup wizard creates:

- `node.config.json`
- `.env.local`

During setup you choose:

- role: `provider`, `verifier`, or `both`
- network profile: `testnet` or `mainnet`
- selection mode: `priority-failover` or `all-healthy`
- enabled networks by key
- provider backend when provider mode is enabled

If you do not want to paste a private key directly, you can leave it blank during setup and later fill either:

- `WALLET_PRIVATE_KEY`
- `WALLET_KEYFILE`

## Start the Node

```bash
npm run doctor
npm run node
```

The role comes from `NODE_ROLE=provider|verifier|both`.

## Verify Participation

- Provider:
  - watch for `submitResponse` transactions from your wallet
- Verifier:
  - watch for `verifySubmission` or `rejectSubmission` from your wallet
- Both:
  - watch the job state move to `Settled`
  - confirm KOIN appears in your wallet

## Status and Logs

```bash
npm run status
npm run logs
```

- `status` prints network health, selected runtime targets, wallet balances, and cached participation summary
- `logs` runs the long-lived node loop and streams job activity to stdout

## Shared Manifest Roots

If your provider and verifier run on different machines, point them to a shared discovery root.
The node uses the hash-addressed rules from [docs/network-spec.md](./network-spec.md).
