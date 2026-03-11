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

## Multichain Runtime Model

`Koinara-node` supports multiple deployed Koinara instances.

- The runtime can process `Worldland`, `Base`, `Ethereum`, and `BNB` as independent EVM deployments.
- It can either:
  - select the highest-priority healthy network
  - run across all healthy EVM networks
- It does not move an existing job from one chain to another.
- It does not bridge KOIN or merge rewards across chains.

## Solana Scope

This release includes Solana preparation only.

- config schema for a future Solana deployment
- adapter boundary for future runtime support
- documentation for the planned expansion path

It does not yet include a runnable Solana chain adapter or Solana program deployment.

## Known Protocol Constraints

- The protocol stores `requestHash`, `schemaHash`, and `responseHash` on-chain, not payload URIs.
- Public nodes therefore require an off-chain companion discovery format.
- There is no on-chain reputation system in `v0.1.6`.
- There is no DAG execution engine or multi-stage collective workflow in `v0.1.6`.
- `Collective` jobs are treated as a normal protocol job type in this node implementation.
