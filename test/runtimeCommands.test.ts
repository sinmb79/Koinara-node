import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeCommands } from "../src/config/runtimeCommands.js";

test("resolveRuntimeCommands uses OpenClaw v2 mainnet commands for provider", () => {
  const commands = resolveRuntimeCommands({
    role: "provider",
    config: {
      networkProfile: "mainnet",
      provider: {
        backend: "openclaw",
        supportedJobTypes: ["Simple"],
        openclaw: {
          agent: "main",
          local: true,
          thinking: "low",
          timeoutSeconds: 120
        }
      }
    }
  });

  assert.deepEqual(commands, {
    doctor: "provider:v2:openclaw:doctor",
    check: "provider:v2:openclaw:check",
    status: "provider:v2:openclaw:status",
    start: "provider:v2:openclaw:start",
    claim: "provider:v2:openclaw:claim"
  });
});

test("resolveRuntimeCommands uses OpenClaw v2 mainnet commands for verifier", () => {
  const commands = resolveRuntimeCommands({
    role: "verifier",
    config: {
      networkProfile: "mainnet",
      provider: {
        backend: "openclaw",
        supportedJobTypes: ["Simple"]
      }
    }
  });

  assert.deepEqual(commands, {
    doctor: "verifier:v2:openclaw:doctor",
    check: "verifier:v2:openclaw:check",
    status: "verifier:v2:openclaw:status",
    start: "verifier:v2:openclaw:start",
    claim: "verifier:v2:openclaw:claim"
  });
});

test("resolveRuntimeCommands falls back to generic v2 commands for ollama provider", () => {
  const commands = resolveRuntimeCommands({
    role: "provider",
    config: {
      networkProfile: "mainnet",
      provider: {
        backend: "ollama",
        supportedJobTypes: ["Simple"],
        ollama: {
          baseUrl: "http://127.0.0.1:11434",
          model: "llama3.1"
        }
      }
    }
  });

  assert.deepEqual(commands, {
    doctor: "provider:v2:doctor",
    check: undefined,
    status: "provider:v2:status",
    start: "provider:v2:start",
    claim: "provider:v2:claim"
  });
});

test("resolveRuntimeCommands selects Base commands when state dir hints at base mainnet", () => {
  const commands = resolveRuntimeCommands({
    role: "provider",
    stateDirHint: "C:\\Users\\sinmb\\.koinara-node-v2-openclaw-base-mainnet\\provider",
    config: {
      networkProfile: "mainnet",
      provider: {
        backend: "openclaw",
        supportedJobTypes: ["Simple"]
      }
    }
  });

  assert.deepEqual(commands, {
    doctor: "provider:v2:openclaw:base:doctor",
    check: "provider:v2:openclaw:base:check",
    status: "provider:v2:openclaw:base:status",
    start: "provider:v2:openclaw:base:start",
    claim: "provider:v2:openclaw:base:claim"
  });
});
