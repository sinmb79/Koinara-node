# OpenClaw Integration

## Current Status

`Koinara-node` does not yet include a built-in OpenClaw skill package or a dedicated OpenClaw transport.

Today, the supported integration model is:

- `OpenClaw` handles agent workflow, prompt planning, and operator-side orchestration
- `Koinara-node` handles provider / verifier execution, contract calls, wallet signing, and settlement participation

In short:

- install only an OpenClaw skill if you want agent UX
- run `Koinara-node` if you want real on-chain provider / verifier participation

## Two Practical Paths

### 1. OpenClaw as a client-side operator layer

Use this when you want an OpenClaw agent to help prepare or inspect Koinara work, but the actual network participation still comes from a local node process.

Recommended shape:

- OpenClaw agent prepares prompts, job manifests, or result review notes
- `Koinara-node` runs separately as `provider`, `verifier`, or `both`
- both point to the same local or shared discovery roots

This keeps protocol participation inside the node while letting OpenClaw improve operator workflow.

### 2. OpenClaw as a provider-side inference source

Use this when you want OpenClaw to generate the underlying inference content while `Koinara-node` remains the submitting runtime.

Recommended shape:

- configure `Koinara-node` in `provider` or `both` mode
- keep `Koinara-node` responsible for:
  - job polling
  - request hash validation
  - response hash computation
  - `submitResponse`
  - verifier participation if enabled
- let OpenClaw produce or refine the textual result before the node stores the artifact and submits the response hash

This repository does not yet ship an out-of-the-box adapter for that handoff, so this is currently an operator-side composition pattern rather than a first-class built-in module.

## What OpenClaw Alone Cannot Do

OpenClaw by itself is not enough to participate as a Koinara provider or verifier.

Without a running `Koinara-node`, an OpenClaw agent does not:

- monitor Koinara job state on-chain
- compute and submit canonical `responseHash`
- call `verifySubmission`, `rejectSubmission`, `finalizePoI`, or `distributeRewards`
- manage crash recovery and duplicate suppression for node participation

## Minimal Local Architecture

```text
OpenClaw Agent
  -> prepares prompt / operator workflow
  -> optionally produces or refines inference output

Koinara-node
  -> polls jobs
  -> resolves manifests and receipts
  -> validates hashes
  -> signs on-chain transactions
  -> participates as provider / verifier
```

## Recommended Setup Today

1. Install and configure `Koinara-node`
2. Run `npm run doctor`
3. Start the node with `npm run node`
4. Use OpenClaw alongside it for:
   - prompt planning
   - response drafting
   - verifier-side human review assistance
   - operator summaries and monitoring

## Planned Direction

The clean future direction is:

- a dedicated OpenClaw skill package outside the core node runtime
- that skill can talk to a local or remote `Koinara-node`
- the node stays the execution and signing boundary

That preserves the minimal public node while still making OpenClaw integration much easier.
