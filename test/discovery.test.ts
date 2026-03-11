import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  computeRequestHash,
  computeResponseHash,
  computeSchemaHash,
  resolveJobManifest,
  resolveSubmissionReceipt
} from "../src/storage/discovery.js";
import type { JobManifest, SubmissionReceipt } from "../src/types.js";

test("discovery resolves manifests and receipts from filesystem roots", async () => {
  const root = mkdtempSync(join(tmpdir(), "koinara-node-discovery-"));
  mkdirSync(resolve(root, "jobs"), { recursive: true });
  mkdirSync(resolve(root, "receipts"), { recursive: true });

  const manifestBody = {
    prompt: "Hello",
    contentType: "text/plain",
    schema: { type: "text" },
    metadata: { createdBy: "tester" }
  };
  const manifest: JobManifest = {
    version: "koinara-job-manifest-v1",
    requestHash: "0x",
    body: manifestBody
  };
  manifest.requestHash = computeRequestHash(manifest);

  const receipt: SubmissionReceipt = {
    version: "koinara-submission-receipt-v1",
    jobId: 1,
    responseHash: "0x",
    provider: "0x0000000000000000000000000000000000000009",
    body: {
      contentType: "application/json",
      output: { text: "World" },
      metadata: { backend: "ollama" }
    }
  };
  receipt.responseHash = computeResponseHash(receipt);

  writeFileSync(resolve(root, "jobs", `${manifest.requestHash}.json`), JSON.stringify(manifest), "utf8");
  writeFileSync(
    resolve(root, "receipts", `1-${receipt.responseHash}.json`),
    JSON.stringify(receipt),
    "utf8"
  );

  const resolvedManifest = await resolveJobManifest([root], manifest.requestHash);
  const resolvedReceipt = await resolveSubmissionReceipt([root], 1, receipt.responseHash);

  assert.ok(resolvedManifest);
  assert.ok(resolvedReceipt);
  assert.equal(computeSchemaHash(resolvedManifest!), computeSchemaHash(manifest));
  assert.equal(resolvedReceipt!.provider, receipt.provider);
});

test("discovery resolves manifests from HTTP roots", async () => {
  const manifest: JobManifest = {
    version: "koinara-job-manifest-v1",
    requestHash: "0x",
    body: {
      prompt: "HTTP",
      contentType: "text/plain",
      schema: { type: "text" },
      metadata: { createdBy: "tester" }
    }
  };
  manifest.requestHash = computeRequestHash(manifest);

  const server = createServer((req, res) => {
    if (req.url === `/jobs/${manifest.requestHash}.json`) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(manifest));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolvePromise) => server.listen(0, resolvePromise));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const resolvedManifest = await resolveJobManifest([`http://127.0.0.1:${port}`], manifest.requestHash);
    assert.ok(resolvedManifest);
    assert.equal(resolvedManifest!.requestHash, manifest.requestHash);
  } finally {
    await new Promise<void>((resolvePromise, rejectPromise) =>
      server.close((error) => (error ? rejectPromise(error) : resolvePromise()))
    );
  }
});
