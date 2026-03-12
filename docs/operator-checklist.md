# Operator Checklist

This checklist is for a real node operator preparing `Koinara-node` for multichain participation.

It is written to minimize guesswork and to separate:

- one-time setup
- per-machine setup
- preflight verification
- live operation

## 1. One-time Preparation

- Confirm the target protocol deployment is `sinmb79/koinara@v0.1.6`
- Fill the correct values in:
  - `config/networks.testnet.json`
  - `config/networks.mainnet.json`
- Set the deployed contract addresses on each network you plan to enable:
  - `registry`
  - `verifier`
  - `rewardDistributor`
  - `token`
- Decide which machine will run which role:
  - provider
  - verifier
  - both
- Decide which EVM networks should be:
  - primary
  - failover
  - disabled
- Decide the shared discovery root strategy:
  - local shared folder
  - synced folder
  - static HTTP host

## 2. Wallet and Backend Readiness

- Fund the wallet with enough native token for gas on every enabled EVM network
- Keep a gas buffer above `recommendedGasBufferNative`
- If using `ollama`:
  - install Ollama
  - pull the target model
  - confirm the local endpoint responds
- If using `openai`:
  - confirm the API key is valid
  - confirm the selected model is accessible
- If using `openclaw`:
  - on Windows PowerShell, confirm `openclaw.cmd --agent main --local --json --message "Reply with OK"` succeeds
  - on macOS / Linux, confirm `openclaw agent --agent main --local --json --message "Reply with OK"` succeeds
  - confirm the selected OpenClaw agent id is available
  - confirm OpenClaw can reach the intended local model provider

## 3. Local Setup

Run:

```bash
npm install
npm run setup
```

During setup:

- choose `provider`, `verifier`, or `both`
- choose `testnet` or `mainnet`
- choose `priority-failover` or `all-healthy`
- choose enabled network keys
- choose `ollama` or `openai` if provider is enabled
- choose `openclaw` if you want the provider output to come from an OpenClaw agent
- set supported job types
- set discovery roots
- set the artifact output path
- provide either:
  - a private key
  - or a keyfile path

Expected files after setup:

- `.env.local`
- `node.config.json`

If `provider` and `verifier` will run as separate processes on one machine, also prepare:

- `.env.provider.local`
- `.env.verifier.local`

Set a unique `NODE_STATE_DIR` in each file.

## 4. Preflight Check

Run:

```bash
npm run doctor
```

If roles are split, run:

```bash
npm run provider:doctor
npm run verifier:doctor
```

For Worldland v2 claim-only settlement, also verify:

```bash
npm run provider:v2:status
npm run verifier:v2:status
```

Do not proceed until these are true:

- at least one selected EVM network is healthy
- contract addresses are filled for the networks you selected
- wallet resolves correctly
- provider config exists when provider role is enabled
- verifier config exists when verifier role is enabled
- `OPENAI_API_KEY` exists when OpenAI backend is configured

Recommended extra check:

```bash
npm run status
```

Verify:

- wallet address is the intended wallet
- native balances are sufficient
- `KOIN` balances read correctly on reachable networks
- the selected runtime targets are the intended networks

## 5. Discovery Root Check

Before live operation, make sure the node can actually discover off-chain job documents.

The node expects:

- `jobs/<requestHash>.json`
- `receipts/<networkKey>/<jobId>-<responseHash>.json`

Verify that:

- the configured discovery root exists
- the machine can read it
- provider machines can write receipts and result artifacts
- verifier machines can read the same manifests and receipts

If provider and verifier are on different machines, test the shared root manually before starting the node.

## 6. First Run

Start a single-pass dry check first:

```bash
npm run node:once
```

If roles are split, run:

```bash
npm run provider:once
npm run verifier:once
```

This is useful to confirm:

- config loads
- selected network health is evaluated
- wallet signs normally
- discovery paths resolve
- no immediate runtime exceptions occur

If that looks healthy, start the continuous loop:

```bash
npm run node
```

You can also use:

```bash
npm run logs
```

for the same long-running stdout stream.

If roles are split, start one process per role:

```bash
npm run provider:start
npm run verifier:start
```

## 7. Canary Operation

Before relying on the node in production conditions, run one canary job.

Recommended order:

1. Start with a `Simple` job
2. Make sure the manifest is available under the discovery root
3. Let the provider submit
4. Let the verifier participate
5. Confirm the job reaches `Settled`
6. Confirm `KOIN` arrives in the participant wallet

Success criteria:

- provider sends `submitResponse`
- verifier sends `registerSubmission` and `verifySubmission` or `rejectSubmission`
- accepted path reaches `finalizePoI`
- settlement path reaches `recordAcceptedJob`
- after the epoch closes, `npm run provider:v2:claim` and `npm run verifier:v2:claim` succeed
- wallet `KOIN` balance increases after claim

## 8. Ongoing Operations

Check periodically with:

```bash
npm run status
```

Watch for:

- native balance dropping too low on active networks
- repeated `submitResponse` failures
- repeated verifier participation failures
- missing manifests
- missing receipts
- stuck jobs that never move beyond `Submitted` or `UnderVerification`
- primary network health degradation that triggers failover

Runtime artifacts are stored under:

- `.koinara-node/`

Important local files:

- `.koinara-node/state.json`
- `.koinara-node/artifacts/`

For split-role operation, expect separate state files such as:

- `.koinara-node/provider/state.json`
- `.koinara-node/verifier/state.json`

## 9. Safe Recovery

If the process crashes:

1. Inspect the last logs
2. Confirm the wallet still has gas on enabled networks
3. Confirm the shared discovery root is still readable
4. Restart with:

```bash
npm run node
```

The local state cache is only a recovery hint.
Correctness is still chain-derived, so the node should skip jobs already submitted or already participated in by the same wallet.

If the machine reboots and you are using an OpenClaw-backed provider, restart with:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run provider:v2:openclaw:check
npm.cmd run provider:v2:openclaw:start
```

## 10. Mainnet Readiness Gate

Only move to unattended mainnet operation when all of the following are true:

- local or test rehearsal has already completed
- the selected RPCs are stable
- the wallet is funded
- contract addresses are correct
- discovery roots are working across machines
- one canary `Simple` job has already completed end-to-end in a non-production environment

If any of these are uncertain, stop and fix them before leaving the node running unattended.
