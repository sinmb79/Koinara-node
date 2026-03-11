import { keccak256, toUtf8Bytes } from "ethers";
import type { JobManifest, SubmissionReceipt } from "../types.js";
import type { DiscoveryAdapter } from "./adapter.js";
import { FilesystemAdapter } from "./filesystemAdapter.js";
import { HttpAdapter } from "./httpAdapter.js";

const adapters: DiscoveryAdapter[] = [new FilesystemAdapter(), new HttpAdapter()];

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function computeRequestHash(manifest: JobManifest): string {
  return keccak256(toUtf8Bytes(canonicalJson(manifest.body)));
}

export function computeSchemaHash(manifest: JobManifest): string {
  return keccak256(toUtf8Bytes(canonicalJson(manifest.body.schema)));
}

export function computeResponseHash(receipt: SubmissionReceipt): string {
  return keccak256(toUtf8Bytes(canonicalJson(receipt.body)));
}

export async function resolveJobManifest(
  roots: string[],
  requestHash: string
): Promise<JobManifest | null> {
  for (const root of roots) {
    const candidate = await readJsonMaybe<JobManifest>(root, ["jobs", `${requestHash}.json`]);
    if (!candidate) {
      continue;
    }
    if (candidate.version !== "koinara-job-manifest-v1") {
      continue;
    }
    if (candidate.requestHash.toLowerCase() !== requestHash.toLowerCase()) {
      continue;
    }
    if (computeRequestHash(candidate).toLowerCase() !== requestHash.toLowerCase()) {
      continue;
    }
    return candidate;
  }

  return null;
}

export async function resolveSubmissionReceipt(
  roots: string[],
  jobId: number,
  responseHash: string
): Promise<SubmissionReceipt | null> {
  for (const root of roots) {
    const candidate = await readJsonMaybe<SubmissionReceipt>(root, [
      "receipts",
      `${jobId}-${responseHash}.json`
    ]);
    if (!candidate) {
      continue;
    }
    if (candidate.version !== "koinara-submission-receipt-v1") {
      continue;
    }
    if (candidate.jobId !== jobId) {
      continue;
    }
    if (candidate.responseHash.toLowerCase() !== responseHash.toLowerCase()) {
      continue;
    }
    if (computeResponseHash(candidate).toLowerCase() !== responseHash.toLowerCase()) {
      continue;
    }
    return candidate;
  }

  return null;
}

export async function writeSubmissionReceipt(
  roots: string[],
  receipt: SubmissionReceipt
): Promise<string> {
  const localRoot = roots.find((entry) => adapters.some((adapter) => adapter.name === "filesystem" && adapter.canHandle(entry)));
  if (!localRoot) {
    throw new Error("At least one local receipt root is required for writes");
  }

  return writeJson(localRoot, ["receipts", `${receipt.jobId}-${receipt.responseHash}.json`], receipt);
}

export async function writeResultArtifact(
  artifactRoot: string,
  jobId: number,
  responseHash: string,
  output: unknown
): Promise<string> {
  return writeJson(artifactRoot, ["results", `${jobId}-${responseHash}.json`], output);
}

async function readJsonMaybe<T>(root: string, pathParts: string[]): Promise<T | null> {
  const adapter = adapters.find((entry) => entry.canHandle(root));
  if (!adapter) {
    return null;
  }
  return adapter.readJson<T>(root, pathParts);
}

async function writeJson<T>(root: string, pathParts: string[], value: T): Promise<string> {
  const adapter = adapters.find((entry) => entry.writeJson && entry.canHandle(root));
  if (!adapter?.writeJson) {
    throw new Error(`No writable adapter available for ${root}`);
  }
  return adapter.writeJson(root, pathParts, value);
}
