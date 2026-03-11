import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadRuntimeConfig } from "../src/config/loadConfig.js";

function resetConfigEnv(): void {
  delete process.env.WALLET_PRIVATE_KEY;
  delete process.env.WALLET_KEYFILE;
  delete process.env.NODE_ROLE;
  delete process.env.NETWORK_PROFILE;
  delete process.env.NODE_ENV_FILE;
  delete process.env.NODE_STATE_DIR;
}

test("loadRuntimeConfig resolves multichain config and inline wallet", () => {
  resetConfigEnv();
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-config-"));
  mkdirSync(resolve(repoRoot, "config"), { recursive: true });

  writeFileSync(
    resolve(repoRoot, "config", "networks.testnet.json"),
    JSON.stringify({
      networks: [
        {
          key: "worldland",
          label: "Worldland Testnet",
          kind: "evm",
          enabled: true,
          priority: 1,
          rpcUrls: ["http://127.0.0.1:8545"],
          chainId: 31337,
          explorerBaseUrl: "",
          confirmationsRequired: 1,
          recommendedGasBufferNative: "0.05",
          nativeToken: { type: "native", symbol: "WLC" },
          contracts: {
            registry: "0x0000000000000000000000000000000000000001",
            verifier: "0x0000000000000000000000000000000000000002",
            rewardDistributor: "0x0000000000000000000000000000000000000003",
            token: "0x0000000000000000000000000000000000000004"
          }
        },
        {
          key: "solana",
          label: "Solana Devnet",
          kind: "solana",
          enabled: true,
          priority: 9,
          rpcUrls: [],
          cluster: "devnet",
          explorerBaseUrl: "",
          confirmationsRequired: 1,
          recommendedGasBufferNative: "0.05",
          nativeToken: { type: "native", symbol: "SOL" },
          programIds: {
            registry: "",
            verifier: "",
            rewardDistributor: "",
            tokenMint: ""
          }
        }
      ]
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, "node.config.json"),
    JSON.stringify({
      networkProfile: "testnet",
      selectionMode: "priority-failover",
      enabledNetworks: ["worldland", "solana"],
      pollIntervalMs: 5000,
      manifestRoots: ["./.koinara-node/network"],
      receiptRoots: ["./.koinara-node/network"],
      artifactOutputDir: "./.koinara-node/artifacts",
      provider: {
        backend: "ollama",
        supportedJobTypes: ["Simple"],
        ollama: {
          baseUrl: "http://127.0.0.1:11434",
          model: "llama3.1"
        }
      }
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, ".env.local"),
    "WALLET_PRIVATE_KEY=0x1234\nNODE_ROLE=provider\n",
    "utf8"
  );

  const config = loadRuntimeConfig({ repoRoot });
  assert.equal(config.networkProfile, "testnet");
  assert.equal(config.walletPrivateKey, "0x1234");
  assert.equal(config.walletSource, "env");
  assert.equal(config.networks.length, 2);
  assert.equal(config.networks[0]?.kind, "evm");
  assert.equal(config.networks[0]?.rpcCandidates[0], "http://127.0.0.1:8545");
  assert.equal(
    config.networks[0]?.manifestRoots[0],
    resolve(repoRoot, ".koinara-node", "network")
  );
  assert.equal(
    config.networks[0]?.artifactOutputDir,
    resolve(repoRoot, ".koinara-node", "artifacts", "worldland")
  );
});

test("loadRuntimeConfig resolves keyfile wallet", () => {
  resetConfigEnv();
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-keyfile-"));
  mkdirSync(resolve(repoRoot, "config"), { recursive: true });

  writeFileSync(
    resolve(repoRoot, "config", "networks.testnet.json"),
    JSON.stringify({
      networks: [
        {
          key: "worldland",
          label: "Worldland Testnet",
          kind: "evm",
          enabled: true,
          priority: 1,
          rpcUrls: ["http://127.0.0.1:8545"],
          chainId: 31337,
          explorerBaseUrl: "",
          confirmationsRequired: 1,
          recommendedGasBufferNative: "0.05",
          nativeToken: { type: "native", symbol: "WLC" },
          contracts: {
            registry: "0x0000000000000000000000000000000000000001",
            verifier: "0x0000000000000000000000000000000000000002",
            rewardDistributor: "0x0000000000000000000000000000000000000003",
            token: "0x0000000000000000000000000000000000000004"
          }
        }
      ]
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, "node.config.json"),
    JSON.stringify({
      networkProfile: "testnet",
      selectionMode: "priority-failover",
      enabledNetworks: ["worldland"],
      pollIntervalMs: 5000,
      manifestRoots: ["./.koinara-node/network"],
      receiptRoots: ["./.koinara-node/network"],
      artifactOutputDir: "./.koinara-node/artifacts",
      verifier: {
        supportedJobTypes: ["Simple"],
        supportedSchemaHashes: []
      }
    }),
    "utf8"
  );
  writeFileSync(resolve(repoRoot, "wallet.txt"), "0xabcd\n", "utf8");
  writeFileSync(
    resolve(repoRoot, ".env.local"),
    "WALLET_KEYFILE=./wallet.txt\nNODE_ROLE=verifier\n",
    "utf8"
  );

  const config = loadRuntimeConfig({ repoRoot });
  assert.equal(config.walletPrivateKey, "0xabcd");
  assert.equal(config.walletSource, "keyfile");
});

test("loadRuntimeConfig prefers local network profile overrides", () => {
  resetConfigEnv();
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-local-profile-"));
  mkdirSync(resolve(repoRoot, "config"), { recursive: true });

  writeFileSync(
    resolve(repoRoot, "config", "networks.testnet.json"),
    JSON.stringify({
      networks: [
        {
          key: "worldland",
          label: "Worldland Testnet",
          kind: "evm",
          enabled: true,
          priority: 1,
          rpcUrls: ["https://gwangju.worldland.foundation/"],
          chainId: 10395,
          explorerBaseUrl: "",
          confirmationsRequired: 2,
          recommendedGasBufferNative: "0.05",
          nativeToken: { type: "native", symbol: "WLC" },
          contracts: {
            registry: "0x0000000000000000000000000000000000000001",
            verifier: "0x0000000000000000000000000000000000000002",
            rewardDistributor: "0x0000000000000000000000000000000000000003",
            token: "0x0000000000000000000000000000000000000004"
          }
        }
      ]
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, "config", "networks.testnet.local.json"),
    JSON.stringify({
      networks: [
        {
          key: "worldland",
          label: "Worldland Local Anvil",
          kind: "evm",
          enabled: true,
          priority: 1,
          rpcUrls: ["http://127.0.0.1:8545"],
          chainId: 31337,
          explorerBaseUrl: "",
          confirmationsRequired: 1,
          recommendedGasBufferNative: "0.05",
          nativeToken: { type: "native", symbol: "WLC" },
          contracts: {
            registry: "0x0000000000000000000000000000000000000001",
            verifier: "0x0000000000000000000000000000000000000002",
            rewardDistributor: "0x0000000000000000000000000000000000000003",
            token: "0x0000000000000000000000000000000000000004"
          }
        }
      ]
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, "node.config.json"),
    JSON.stringify({
      networkProfile: "testnet",
      selectionMode: "priority-failover",
      enabledNetworks: ["worldland"],
      pollIntervalMs: 5000,
      manifestRoots: ["./.koinara-node/network"],
      receiptRoots: ["./.koinara-node/network"],
      artifactOutputDir: "./.koinara-node/artifacts",
      verifier: {
        supportedJobTypes: ["Simple"],
        supportedSchemaHashes: []
      }
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, ".env.local"),
    "WALLET_PRIVATE_KEY=0xbeef\nNODE_ROLE=verifier\n",
    "utf8"
  );

  const config = loadRuntimeConfig({ repoRoot });
  assert.equal(config.networks[0]?.kind, "evm");
  assert.equal(config.networks[0]?.chainId, 31337);
  assert.equal(config.networks[0]?.rpcCandidates[0], "http://127.0.0.1:8545");
});

test("loadRuntimeConfig honors explicit env file and state dir overrides", () => {
  resetConfigEnv();
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-role-env-"));
  mkdirSync(resolve(repoRoot, "config"), { recursive: true });

  writeFileSync(
    resolve(repoRoot, "config", "networks.mainnet.json"),
    JSON.stringify({
      networks: [
        {
          key: "worldland",
          label: "Worldland Mainnet",
          kind: "evm",
          enabled: true,
          priority: 1,
          rpcUrls: ["https://seoul.worldland.foundation/"],
          chainId: 103,
          explorerBaseUrl: "",
          confirmationsRequired: 2,
          recommendedGasBufferNative: "0.05",
          nativeToken: { type: "native", symbol: "WLC" },
          contracts: {
            registry: "0x0000000000000000000000000000000000000001",
            verifier: "0x0000000000000000000000000000000000000002",
            rewardDistributor: "0x0000000000000000000000000000000000000003",
            token: "0x0000000000000000000000000000000000000004"
          }
        }
      ]
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, "node.config.json"),
    JSON.stringify({
      networkProfile: "mainnet",
      selectionMode: "priority-failover",
      enabledNetworks: ["worldland"],
      pollIntervalMs: 5000,
      manifestRoots: ["./.koinara-node/network"],
      receiptRoots: ["./.koinara-node/network"],
      artifactOutputDir: "./.koinara-node/artifacts",
      verifier: {
        supportedJobTypes: ["Simple"],
        supportedSchemaHashes: []
      }
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, ".env.local"),
    "WALLET_PRIVATE_KEY=0xlocal\nNODE_ROLE=provider\n",
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, ".env.verifier.local"),
    "WALLET_PRIVATE_KEY=0xrole\nNODE_ROLE=verifier\nNODE_STATE_DIR=./.koinara-node/verifier\n",
    "utf8"
  );

  process.env.NODE_ENV_FILE = "./.env.verifier.local";
  const config = loadRuntimeConfig({ repoRoot });

  assert.equal(config.walletPrivateKey, "0xrole");
  assert.equal(config.role, "verifier");
  assert.equal(config.stateDir, resolve(repoRoot, ".koinara-node", "verifier"));
  assert.equal(config.statePath, resolve(repoRoot, ".koinara-node", "verifier", "state.json"));
});
