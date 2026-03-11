# Supported Networks

`Koinara-node` separates active runtime support from future preparation.

## Active EVM runtime targets

- Worldland
- Base
- Ethereum
- BNB Smart Chain

These networks share the current EVM runtime path and can participate in:

- `priority-failover` mode
- `all-healthy` mode

## Prepared-only target

- Solana

Solana is intentionally marked as prepared-only in v1.
The repository includes:

- network config shape
- runtime type shape
- adapter boundary
- documentation path

But it does not yet include:

- Solana program deployment
- Solana verifier/provider runtime
- Solana settlement execution

## Operator guidance

Until a Koinara deployment exists on a given chain, leave its contract addresses empty or keep that network out of your `enabledNetworks` list.

The node will only actively process healthy EVM networks that are both:

- enabled in the network profile
- selected in `node.config.json`
