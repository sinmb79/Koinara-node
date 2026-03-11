import assert from "node:assert/strict";
import test from "node:test";
import { inspectNetworks, selectedHealthyNetworks } from "../src/chain/networkSelection.js";
import type { RuntimeConfig } from "../src/types.js";

test("inspectNetworks marks Solana as prepared-only when selected", async () => {
  const config = {
    repoRoot: ".",
    role: "provider",
    walletPrivateKey: "",
    walletSource: "missing",
    networkProfile: "testnet",
    selectionMode: "priority-failover",
    pollIntervalMs: 1000,
    stateDir: ".koinara-node",
    statePath: ".koinara-node/state.json",
    networks: [
      {
        key: "solana",
        label: "Solana Devnet",
        kind: "solana",
        enabled: true,
        priority: 10,
        cluster: "devnet",
        explorerBaseUrl: "",
        confirmationsRequired: 1,
        recommendedGasBufferNative: "0.05",
        nativeToken: {
          type: "native",
          symbol: "SOL"
        },
        manifestRoots: [],
        receiptRoots: [],
        artifactOutputDir: ".koinara-node/artifacts/solana",
        rpcCandidates: [],
        programIds: {
          registry: "",
          verifier: "",
          rewardDistributor: "",
          tokenMint: ""
        }
      }
    ]
  } satisfies RuntimeConfig;

  const reports = await inspectNetworks(config);
  assert.equal(reports[0]?.status, "unsupported");
  assert.equal(selectedHealthyNetworks(reports).length, 0);
});
