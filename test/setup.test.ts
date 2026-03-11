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
    openAiEnabled: false,
    walletInput: "0x1234"
  });

  assert.equal(env.NODE_ROLE, "provider");
  assert.equal(env.WALLET_PRIVATE_KEY, "0x1234");
  assert.equal(env.WALLET_KEYFILE, undefined);
});

test("buildEnvTemplate enables OpenAI key when needed", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "koinara-node-setup-"));
  const env = buildEnvTemplate({
    repoRoot,
    role: "both",
    openAiEnabled: true,
    walletInput: ""
  });

  assert.equal(env.NODE_ROLE, "both");
  assert.equal(env.WALLET_PRIVATE_KEY, "");
  assert.equal(env.WALLET_KEYFILE, "");
  assert.equal(env.OPENAI_API_KEY, "");
});
