import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { FileStateStore } from "../src/state/fileStateStore.js";

test("FileStateStore records provider and verifier activity", () => {
  const root = mkdtempSync(join(tmpdir(), "koinara-node-state-"));
  const store = new FileStateStore(resolve(root, "state.json"));

  store.markSubmitted(1, {
    txHash: "0xaaa",
    responseHash: "0xbbb",
    recordedAt: new Date().toISOString()
  });
  store.markParticipated(1, {
    action: "verified",
    txHash: "0xccc",
    recordedAt: new Date().toISOString()
  });

  assert.equal(store.hasSubmitted(1), true);
  assert.equal(store.hasParticipated(1), true);

  const state = store.getState();
  assert.equal(state.provider.submittedJobs["1"].responseHash, "0xbbb");
  assert.equal(state.verifier.participatedJobs["1"].action, "verified");
  assert.ok(state.lastRunAt);
});
