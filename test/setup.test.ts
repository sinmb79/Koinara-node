import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildEnvTemplate } from "../src/setup/setup.js";

test("buildEnvTemplate supports inline private keys", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-setup-"));
  const env = buildEnvTemplate({
    repoRoot,
    role: "provider",
    networkProfile: "testnet",
    walletInput: "0x1234",
    stateDir: join(repoRoot, ".koinara-node", "state")
  });

  assert.equal(env.NODE_ROLE, "provider");
  assert.equal(env.NETWORK_PROFILE, "testnet");
  assert.equal(env.NODE_STATE_DIR, join(repoRoot, ".koinara-node", "state"));
  assert.equal(env.WALLET_PRIVATE_KEY, "0x1234");
  assert.equal(env.WALLET_KEYFILE, undefined);
});

test("buildEnvTemplate keeps only the keyfile placeholder when setup skips the wallet", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-setup-"));
  const env = buildEnvTemplate({
    repoRoot,
    role: "both",
    networkProfile: "mainnet",
    walletInput: "",
    stateDir: join(repoRoot, ".koinara-node", "state")
  });

  assert.equal(env.NODE_ROLE, "both");
  assert.equal(env.NETWORK_PROFILE, "mainnet");
  assert.equal(env.NODE_STATE_DIR, join(repoRoot, ".koinara-node", "state"));
  assert.equal(env.WALLET_PRIVATE_KEY, undefined);
  assert.equal(env.WALLET_KEYFILE, "");
});
