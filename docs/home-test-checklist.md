# Home Test Checklist

This document is the detailed at-home test list for `Koinara-node`.

Use it after cloning from GitHub on your home computer.
It is meant to answer two questions:

- what to run
- what to verify

Do not commit secrets while testing.

## 1. Local-only files to prepare

Before running any node process, fill these locally:

- `config/networks.testnet.json` or `config/networks.mainnet.json`
- `.env.local`
- `node.config.json`

Never commit:

- wallet private keys
- keyfiles
- private RPC endpoints
- API secrets

## 2. Install and setup

Run:

```bash
npm install
npm run setup
```

Verify:

- `node.config.json` was created
- `.env.local` was created
- your selected role is correct
- your selected `networkProfile` is correct
- your `enabledNetworks` list is correct
- your `selectionMode` is correct

## 3. Preflight test

Run:

```bash
npm run doctor
npm run status
```

Verify:

- the wallet address shown is the one you intended to use
- at least one enabled EVM network is `healthy`
- Solana appears only as prepared or unsupported, not as an active runtime target
- the contract addresses are filled for networks you intend to use
- native balance is enough for gas
- `KOIN` balance reads successfully on reachable networks
- `OPENAI_API_KEY` is present if you selected `openai`

## 4. Config and path sanity

Check these manually:

- the manifest root exists
- the receipt root exists
- the artifact output directory exists or is creatable
- the wallet keyfile path is valid if you used `WALLET_KEYFILE`
- the selected model exists if you use `ollama`

## 5. Single-pass runtime test

Run:

```bash
npm run node:once
```

Verify:

- config loads without exceptions
- network selection runs
- the node does not attempt to use an unhealthy network
- no immediate signing or RPC errors occur
- no missing module or path errors occur

## 6. Provider-only test

If you plan to run as provider, test provider mode explicitly.

Suggested local config:

- `NODE_ROLE=provider`
- provider config enabled
- verifier config absent or ignored

Run:

```bash
npm run node
```

Verify:

- the node scans `Open` jobs only
- a matching job manifest can be resolved
- schema hash validation passes
- a result artifact is written under `.koinara-node/artifacts/<networkKey>/`
- a receipt is written under `receipts/<networkKey>/`
- `submitResponse` is sent only once per job by the same wallet

## 7. Verifier-only test

If you plan to run as verifier, test verifier mode explicitly.

Suggested local config:

- `NODE_ROLE=verifier`
- verifier config enabled
- provider config absent or ignored

Run:

```bash
npm run node
```

Verify:

- the node scans `Submitted` and `UnderVerification` jobs
- overdue `Open` jobs may be marked `Expired`
- `registerSubmission` is attempted when needed
- the verifier reads the manifest and receipt correctly
- hash checks pass before `verifySubmission`
- the same wallet does not participate twice in the same job
- `finalizePoI` and `distributeRewards` are attempted only after on-chain conditions allow it

## 8. Both-role test

If you plan to run as `both`, test that combined mode behaves correctly.

Run:

```bash
npm run node
```

Verify:

- provider and verifier loops both start
- provider activity does not break verifier flow
- verifier state cache remains separate from provider submission cache
- no duplicate submission or duplicate participation appears in `.koinara-node/state.json`

## 9. Multichain failover test

This is the most important new runtime behavior.

Suggested setup:

- enable at least two EVM networks
- set `selectionMode` to `priority-failover`
- make the highest-priority network unavailable or wrong

Run:

```bash
npm run doctor
npm run status
npm run node:once
```

Verify:

- the unhealthy higher-priority network is reported as `unhealthy`
- the next healthy EVM network is selected
- no attempt is made to run against Solana
- receipts and artifacts are written under the selected network key

Then test:

- restore the primary network
- rerun `npm run status`

Verify:

- the preferred healthy network becomes the selected target again

## 10. All-healthy mode test

Suggested setup:

- enable two or more healthy EVM networks
- set `selectionMode` to `all-healthy`

Run:

```bash
npm run node:once
```

Verify:

- each healthy enabled EVM network appears as selected
- the node processes passes across each selected EVM network
- state entries are stored with network-scoped job keys

## 11. Receipt compatibility test

If you already have older receipt files, check legacy compatibility.

Verify:

- new receipts are written to `receipts/<networkKey>/<jobId>-<responseHash>.json`
- older flat receipts at `receipts/<jobId>-<responseHash>.json` still resolve when present

## 12. Crash recovery test

Start the node, let it process at least one job, then stop it and restart it.

Verify:

- `.koinara-node/state.json` is preserved
- already submitted jobs are not resubmitted by the same wallet
- already participated jobs are not re-verified by the same wallet
- network health cache is updated again after restart

## 13. Earning confirmation test

When a full successful path occurs, verify all of these:

- provider wallet sent `submitResponse`
- verifier wallet sent `verifySubmission` or `rejectSubmission`
- accepted jobs reached `Settled`
- `KOIN` balance increased on the participating network

Run again:

```bash
npm run status
```

Verify:

- the selected networks are shown correctly
- cached participation counts increased
- the local state file still looks sane

## 14. Failure checklist

If a test fails, check these in order:

- wrong `networkProfile`
- wrong or empty contract addresses
- no healthy EVM RPC
- low native balance
- bad private key or keyfile path
- wrong discovery root
- missing job manifest
- missing submission receipt
- missing `OPENAI_API_KEY`
- Ollama not running or wrong model name

## 15. Minimum success bar

Your home test is good enough to move forward when all of these are true:

- `doctor` passes with no blocking failures
- `status` shows at least one healthy selected EVM network
- `node:once` runs without runtime exceptions
- provider and/or verifier behavior matches your intended role
- failover works when the preferred network is unhealthy
- at least one real or canary job reaches `Settled`
- `KOIN` appears in the operator wallet on the network where the job settled
