# How to Earn KOIN

`Koinara-node` does not custody funds and does not intermediate rewards.

To earn `KOIN`, your node must participate directly on-chain.

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

## What to monitor

- `submitResponse` transactions from your wallet
- `verifySubmission` or `rejectSubmission` transactions from your wallet
- job state transitions to `Settled`
- your wallet `KOIN` balance

Use:

```bash
npm run status
```

to inspect the current wallet, native balance, `KOIN` balance, and cached participation summary.
