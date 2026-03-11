import { jobStateNameFromValue, jobTypeNameFromValue, type KoinaraContracts } from "../chain/client.js";
import { createInferenceBackend } from "../inference/inference.js";
import {
  computeResponseHash,
  computeSchemaHash,
  resolveJobManifest,
  writeResultArtifact,
  writeSubmissionReceipt
} from "../storage/discovery.js";
import { FileStateStore } from "../state/fileStateStore.js";
import type { RuntimeConfig, SubmissionReceipt } from "../types.js";

export async function runProviderPass(
  config: RuntimeConfig,
  contracts: KoinaraContracts,
  stateStore: FileStateStore
): Promise<void> {
  if (!config.provider) {
    return;
  }

  const backend = createInferenceBackend(config.provider, config.openAiApiKey);
  const totalJobs = Number(await contracts.registry.totalJobs());

  for (let jobId = 1; jobId <= totalJobs; jobId += 1) {
    if (stateStore.hasSubmitted(jobId)) {
      continue;
    }

    const job = await contracts.registry.getJob(jobId);
    const stateName = jobStateNameFromValue(job.state);
    const jobTypeName = jobTypeNameFromValue(job.jobType);

    if (stateName !== "Open") {
      continue;
    }
    if (!config.provider.supportedJobTypes.includes(jobTypeName)) {
      continue;
    }

    const manifest = await resolveJobManifest(config.manifestRoots, job.requestHash);
    if (!manifest) {
      continue;
    }

    if (computeSchemaHash(manifest).toLowerCase() !== String(job.schemaHash).toLowerCase()) {
      console.warn(`provider: schema hash mismatch for job ${jobId}`);
      continue;
    }

    const inference = await backend.infer(manifest);
    const draftReceipt: SubmissionReceipt = {
      version: "koinara-submission-receipt-v1",
      jobId,
      responseHash: "0x",
      provider: contracts.wallet.address,
      body: {
        contentType: inference.contentType,
        output: inference.output,
        metadata: inference.metadata
      }
    };

    const responseHash = computeResponseHash(draftReceipt);
    const receipt: SubmissionReceipt = {
      ...draftReceipt,
      responseHash
    };

    await writeResultArtifact(config.artifactOutputDir, jobId, responseHash, receipt.body.output);
    await writeSubmissionReceipt(config.receiptRoots, receipt);

    try {
      const tx = await contracts.registry.submitResponse(jobId, responseHash);
      const txReceipt = await tx.wait();
      stateStore.markSubmitted(jobId, {
        txHash: txReceipt?.hash ?? tx.hash,
        responseHash,
        recordedAt: new Date().toISOString()
      });
      console.log(`provider: submitted response for job ${jobId} (${responseHash})`);
    } catch (error) {
      console.warn(`provider: submitResponse failed for job ${jobId}: ${formatError(error)}`);
    }
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
