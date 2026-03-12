# Node Setup

If you want the detailed Windows walkthrough with screenshots, use
[docs/install-windows.md](./install-windows.md).

## Prerequisites

- Node.js 20+
- A funded wallet on at least one enabled EVM network
- Access to a manifest root and a receipt root
- One inference backend:
  - Ollama for local inference
  - OpenAI for hosted inference
  - OpenClaw for agent-driven local inference through the OpenClaw CLI

## Setup

```bash
npm install
npm run setup
```

On Windows PowerShell, use a user-owned path and `npm.cmd` if PowerShell blocks `npm.ps1`:

```powershell
git clone https://github.com/sinmb79/Koinara-node.git "$env:USERPROFILE\\koinara-node"
cd "$env:USERPROFILE\\koinara-node"
npm.cmd install
npm.cmd run setup
```

Or use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-windows.ps1
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

Selection mode means:

- `priority-failover`
  - the node uses the highest-priority healthy enabled EVM network
  - if that network fails, it switches to the next healthy one
- `all-healthy`
  - the node uses every healthy enabled EVM network at once

For a simple Worldland-only setup, choose `priority-failover`.
If you only enable one network, the two modes are almost equivalent in practice.

By default, setup now places runtime state, manifests, receipts, and artifacts under
`~/.koinara-node` so they do not depend on where the repository was cloned.

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
npm run provider:v2:claim
npm run verifier:v2:doctor
npm run verifier:v2:start
npm run verifier:v2:claim
```

For the built-in OpenClaw provider path, use:

```bash
npm run provider:v2:openclaw:doctor
npm run provider:v2:openclaw:start
npm run provider:v2:openclaw:claim
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
- on v2, `status` also prints current epoch, next close time, and estimated claimable rewards
- `logs` runs the long-lived node loop and streams job activity to stdout

## Shared Manifest Roots

If your provider and verifier run on different machines, point them to a shared discovery root.
The node uses the hash-addressed rules from [docs/network-spec.md](./network-spec.md).

## OpenClaw

If you want to drive Koinara from an OpenClaw agent, see [docs/openclaw-integration.md](./openclaw-integration.md).
The current supported paths are:

- OpenClaw for agent workflow and prompt orchestration
- OpenClaw as a built-in provider backend through `provider.backend = "openclaw"`
- `Koinara-node` for actual provider / verifier participation and on-chain transactions

What still does not exist in this repository is a first-class OpenClaw skill package that manages the node for you.
