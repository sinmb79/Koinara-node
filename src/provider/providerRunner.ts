import { makeScopedJobKey, networkReceiptPrefix } from "../chain/networkSelection.js";
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
import type { HealthyEvmNetwork, RuntimeConfig, SubmissionReceipt } from "../types.js";

export async function runProviderPass(
  config: RuntimeConfig,
  activeNetwork: HealthyEvmNetwork,
  contracts: KoinaraContracts,
  stateStore: FileStateStore
): Promise<void> {
  if (!config.provider) {
    return;
  }

  const backend = createInferenceBackend(config.provider, config.openAiApiKey);
  const totalJobs = Number(await contracts.registry.totalJobs());

  for (let jobId = 1; jobId <= totalJobs; jobId += 1) {
    const scopedJobKey = makeScopedJobKey(activeNetwork, jobId);
    if (stateStore.hasSubmitted(scopedJobKey)) {
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

    const manifest = await resolveJobManifest(activeNetwork.network.manifestRoots, job.requestHash);
    if (!manifest) {
      continue;
    }

    if (computeSchemaHash(manifest).toLowerCase() !== String(job.schemaHash).toLowerCase()) {
      console.warn(`${activeNetwork.key}: provider schema hash mismatch for job ${jobId}`);
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
        metadata: {
          ...inference.metadata,
          networkKey: activeNetwork.key
        }
      }
    };

    const responseHash = computeResponseHash(draftReceipt);
    const receipt: SubmissionReceipt = {
      ...draftReceipt,
      responseHash
    };

    await writeResultArtifact(
      activeNetwork.network.artifactOutputDir,
      activeNetwork.key,
      jobId,
      responseHash,
      receipt.body.output
    );
    await writeSubmissionReceipt(
      activeNetwork.network.receiptRoots,
      networkReceiptPrefix(activeNetwork),
      receipt
    );

    try {
      const tx = await contracts.registry.submitResponse(jobId, responseHash);
      const txReceipt = await tx.wait();
      stateStore.markSubmitted(scopedJobKey, {
        networkKey: activeNetwork.key,
        txHash: txReceipt?.hash ?? tx.hash,
        responseHash,
        recordedAt: new Date().toISOString()
      });
      console.log(
        `${activeNetwork.key}: provider submitted response for job ${jobId} (${responseHash})`
      );
    } catch (error) {
      console.warn(
        `${activeNetwork.key}: provider submitResponse failed for job ${jobId}: ${formatError(error)}`
      );
    }
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
