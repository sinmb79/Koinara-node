# How to Earn KOIN

`Koinara-node` does not custody funds and does not intermediate rewards.

To earn `KOIN`, your node must participate directly on-chain on a deployed Koinara network.

## Provider path

1. Discover an `Open` job that matches your configured job types.
2. Resolve the off-chain job manifest.
3. Produce a valid response.
4. Submit the `responseHash` on-chain.
5. If the job reaches `Accepted` and then `Settled`, the protocol mints the provider share to your wallet.

## Verifier path

1. Discover a `Submitted` or `UnderVerification` job.
2. Resolve the job manifest and the submission receipt.
3. Verify the hashes and minimal validity checks.
4. Submit `verifySubmission` or `rejectSubmission`.
5. If the job reaches `Settled`, the protocol mints the verifier share to participating verifier wallets.

## Multichain note

`KOIN` earnings are chain-local in v1.

- A reward earned on Worldland stays on the Worldland deployment.
- A reward earned on Base stays on the Base deployment.
- `Koinara-node` can switch participation targets when a preferred network becomes unhealthy, but it does not migrate jobs or rewards across chains.

## What to monitor

- `submitResponse` transactions from your wallet
- `verifySubmission` or `rejectSubmission` transactions from your wallet
- job state transitions to `Settled`
- your wallet `KOIN` balance on each enabled network

Use:

```bash
npm run status
```

to inspect the current wallet, active network selection, native balances, `KOIN` balances, and cached participation summary.
