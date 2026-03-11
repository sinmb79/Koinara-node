import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { FileStateStore } from "../src/state/fileStateStore.js";

test("FileStateStore records provider, verifier, and network activity", () => {
  const root = mkdtempSync(join(tmpdir(), "koinara-node-state-"));
  const store = new FileStateStore(resolve(root, "state.json"));
  const jobKey = "worldland:31337:0x0000000000000000000000000000000000000001:1";

  store.markSubmitted(jobKey, {
    networkKey: "worldland",
    txHash: "0xaaa",
    responseHash: "0xbbb",
    recordedAt: new Date().toISOString()
  });
  store.markParticipated(jobKey, {
    networkKey: "worldland",
    action: "verified",
    txHash: "0xccc",
    recordedAt: new Date().toISOString()
  });
  store.updateNetworkHealth("worldland", {
    status: "healthy",
    selectedRpcUrl: "http://127.0.0.1:8545",
    lastCheckedAt: new Date().toISOString()
  });

  assert.equal(store.hasSubmitted(jobKey), true);
  assert.equal(store.hasParticipated(jobKey), true);

  const state = store.getState();
  assert.equal(state.provider.submittedJobs[jobKey].responseHash, "0xbbb");
  assert.equal(state.verifier.participatedJobs[jobKey].action, "verified");
  assert.equal(state.networkHealth.worldland.status, "healthy");
  assert.ok(state.lastRunAt);
});
