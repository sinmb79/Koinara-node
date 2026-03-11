# Protocol Compatibility

`Koinara-node` is pinned to:

- upstream repo: `sinmb79/koinara`
- upstream tag: `v0.1.6`

## Contracts Used

- `InferenceJobRegistry`
- `ProofOfInferenceVerifier`
- `RewardDistributor`
- `KOINToken`

## Job State Mapping

- `Created`
- `Open`
- `Submitted`
- `UnderVerification`
- `Accepted`
- `Rejected`
- `Settled`
- `Expired`

Provider nodes only act on `Open` jobs.

Verifier nodes only act on `Submitted` and `UnderVerification` jobs, and may mark overdue `Open` jobs as `Expired`.

## Quorum Model

Verifier quorum is defined by the protocol and derived from job type.

- `Simple = 1`
- `General = 3`
- `Collective = 5`

`Koinara-node` does not override quorum with local configuration.

## Known Protocol Constraints

- The protocol stores `requestHash`, `schemaHash`, and `responseHash` on-chain, not payload URIs.
- Public nodes therefore require an off-chain companion discovery format.
- There is no on-chain reputation system in `v0.1.6`.
- There is no DAG execution engine or multi-stage collective workflow in `v0.1.6`.
- `Collective` jobs are treated as a normal protocol job type in this node implementation.
