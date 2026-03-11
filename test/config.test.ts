import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadRuntimeConfig } from "../src/config/loadConfig.js";

test("loadRuntimeConfig resolves repo-local config and inline wallet", () => {
  delete process.env.WALLET_PRIVATE_KEY;
  delete process.env.WALLET_KEYFILE;
  delete process.env.NODE_ROLE;
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-config-"));
  mkdirSync(resolve(repoRoot, "config"), { recursive: true });

  writeFileSync(
    resolve(repoRoot, "config", "chain.testnet.json"),
    JSON.stringify({
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:8545",
      backupRpcUrls: [],
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
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, "node.config.json"),
    JSON.stringify({
      chainProfile: "testnet",
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
  writeFileSync(resolve(repoRoot, ".env.local"), "WALLET_PRIVATE_KEY=0x1234\nNODE_ROLE=provider\n", "utf8");

  const config = loadRuntimeConfig({ repoRoot });
  assert.equal(config.chain.chainId, 31337);
  assert.equal(config.walletPrivateKey, "0x1234");
  assert.equal(config.walletSource, "env");
  assert.equal(config.rpcCandidates[0], "http://127.0.0.1:8545");
  assert.equal(config.manifestRoots[0], resolve(repoRoot, ".koinara-node", "network"));
});

test("loadRuntimeConfig resolves keyfile wallet", () => {
  delete process.env.WALLET_PRIVATE_KEY;
  delete process.env.WALLET_KEYFILE;
  delete process.env.NODE_ROLE;
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-keyfile-"));
  mkdirSync(resolve(repoRoot, "config"), { recursive: true });

  writeFileSync(
    resolve(repoRoot, "config", "chain.testnet.json"),
    JSON.stringify({
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:8545",
      backupRpcUrls: [],
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
    }),
    "utf8"
  );
  writeFileSync(
    resolve(repoRoot, "node.config.json"),
    JSON.stringify({
      chainProfile: "testnet",
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
  writeFileSync(resolve(repoRoot, ".env.local"), "WALLET_KEYFILE=./wallet.txt\nNODE_ROLE=verifier\n", "utf8");

  const config = loadRuntimeConfig({ repoRoot });
  assert.equal(config.walletPrivateKey, "0xabcd");
  assert.equal(config.walletSource, "keyfile");
});
