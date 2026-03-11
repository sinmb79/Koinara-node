# Operator Checklist

This checklist is for a real node operator preparing `Koinara-node` for Worldland participation.

It is written to minimize guesswork and to separate:

- one-time setup
- per-machine setup
- preflight verification
- live operation

## 1. One-time Preparation

- Confirm the target protocol deployment is `sinmb79/koinara@v0.1.6`
- Fill the correct Worldland values in:
  - `config/chain.testnet.json`
  - `config/chain.mainnet.json`
- Set the deployed contract addresses in the selected chain profile:
  - `registry`
  - `verifier`
  - `rewardDistributor`
  - `token`
- Decide which machine will run which role:
  - provider
  - verifier
  - both
- Decide the shared discovery root strategy:
  - local shared folder
  - synced folder
  - static HTTP host

## 2. Wallet and Backend Readiness

- Fund the wallet with enough native token for gas
- Keep a gas buffer above `recommendedGasBufferNative`
- If using `ollama`:
  - install Ollama
  - pull the target model
  - confirm the local endpoint responds
- If using `openai`:
  - confirm the API key is valid
  - confirm the selected model is accessible

## 3. Local Setup

Run:

```bash
npm install
npm run setup
```

During setup:

- choose `provider`, `verifier`, or `both`
- choose `testnet` or `mainnet`
- choose `ollama` or `openai` if provider is enabled
- set supported job types
- set discovery roots
- set the artifact output path
- provide either:
  - a private key
  - or a keyfile path

Expected files after setup:

- `.env.local`
- `node.config.json`

## 4. Preflight Check

Run:

```bash
npm run doctor
```

Do not proceed until these are true:

- RPC is reachable
- `chainId` matches the selected profile
- contract addresses are filled
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
- native balance is sufficient
- `KOIN` balance reads correctly
- the selected RPC is the intended endpoint

## 5. Discovery Root Check

Before live operation, make sure the node can actually discover off-chain job documents.

The node expects:

- `jobs/<requestHash>.json`
- `receipts/<jobId>-<responseHash>.json`

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

This is useful to confirm:

- config loads
- RPC connects
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
- settlement path reaches `distributeRewards`
- wallet `KOIN` balance increases

## 8. Ongoing Operations

Check periodically with:

```bash
npm run status
```

Watch for:

- native balance dropping too low
- repeated `submitResponse` failures
- repeated verifier participation failures
- missing manifests
- missing receipts
- stuck jobs that never move beyond `Submitted` or `UnderVerification`

Runtime artifacts are stored under:

- `.koinara-node/`

Important local files:

- `.koinara-node/state.json`
- `.koinara-node/artifacts/`

## 9. Safe Recovery

If the process crashes:

1. Inspect the last logs
2. Confirm the wallet still has gas
3. Confirm the shared discovery root is still readable
4. Restart with:

```bash
npm run node
```

The local state cache is only a recovery hint.
Correctness is still chain-derived, so the node should skip jobs already submitted or already participated in by the same wallet.

## 10. Mainnet Readiness Gate

Only move to mainnet operation when all of the following are true:

- testnet or local rehearsal has already completed
- the selected RPC is stable
- the wallet is funded
- contract addresses are correct
- discovery roots are working across machines
- one canary `Simple` job has already completed end-to-end in a non-production environment

If any of these are uncertain, stop and fix them before leaving the node running unattended.
