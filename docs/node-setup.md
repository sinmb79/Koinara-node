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

If you plan to run `provider` and `verifier` as separate processes on one machine, you can keep
shared settings in `node.config.json` and create:

- `.env.provider.local`
- `.env.verifier.local`

Set a different `NODE_STATE_DIR` in each file so the two processes do not share one state cache.

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

For split-role operation on one machine, use:

```bash
npm run provider:doctor
npm run provider:start
npm run verifier:doctor
npm run verifier:start
```

For the live Worldland v2 path, use:

```bash
npm run provider:v2:doctor
npm run provider:v2:start
npm run verifier:v2:doctor
npm run verifier:v2:start
```

If you want both roles to start automatically when you log into Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1
```

This creates two scheduled tasks:

- `Koinara Provider Autostart`
- `Koinara Verifier Autostart`

## Verify Participation

- Provider:
  - watch for `submitResponse` transactions from your wallet
- Verifier:
  - watch for `verifySubmission` or `rejectSubmission` from your wallet
- Both:
  - watch the job state move to `Settled`
  - on v2, confirm the accepted job is recorded and wait for the next epoch before claiming `active` / `work` rewards

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

## OpenClaw

If you want to drive Koinara from an OpenClaw agent, see [docs/openclaw-integration.md](./openclaw-integration.md).
The current supported path is:

- OpenClaw for agent workflow and prompt orchestration
- `Koinara-node` for actual provider / verifier participation and on-chain transactions

The node does not yet ship a built-in OpenClaw skill package in this repository.
