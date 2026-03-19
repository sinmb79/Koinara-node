import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildContracts } from "./chain/client.js";
import { inspectNetworks, selectedHealthyNetworks, summarizeSelection } from "./chain/networkSelection.js";
import { loadRuntimeConfig } from "./config/loadConfig.js";
import { runProviderPass } from "./provider/providerRunner.js";
import { FileStateStore } from "./state/fileStateStore.js";
import { runVerifierPass } from "./verifier/verifierRunner.js";
import { runV2Maintenance } from "./v2/maintenance.js";
import { runV3Maintenance } from "./v3/maintenance.js";

export async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  mkdirSync(resolve(config.stateDir), { recursive: true });
  const stateStore = new FileStateStore(config.statePath);
  const runOnce = process.argv.includes("--once") || process.env.NODE_RUN_ONCE === "1";
  const claimsOnly =
    process.argv.includes("--claims-only") || process.env.NODE_CLAIMS_ONLY === "1";

  console.log(`Starting Koinara node as ${config.role}`);
  console.log(`Network profile: ${config.networkProfile}`);
  console.log(`Selection mode: ${config.selectionMode}`);
  console.log(`Wallet source: ${config.walletSource}`);
  if (claimsOnly) {
    console.log("Mode: claims-only");
  }
  stateStore.touch();

  if (runOnce) {
    await runPasses(config, stateStore, { claimsOnly });
    return;
  }

  await loop(config.pollIntervalMs, () => runPasses(config, stateStore, { claimsOnly }));
}

async function runPasses(
  config: ReturnType<typeof loadRuntimeConfig>,
  stateStore: FileStateStore,
  options?: {
    claimsOnly?: boolean;
  }
): Promise<void> {
  const reports = await inspectNetworks(config);
  const activeNetworks = selectedHealthyNetworks(reports);

  for (const report of reports) {
    stateStore.updateNetworkHealth(report.key, {
      status: report.status,
      selectedRpcUrl: report.selectedRpcUrl,
      lastCheckedAt: new Date().toISOString(),
      lastError: report.reason
    });
  }

  if (activeNetworks.length === 0) {
    const configuredTargets = reports
      .filter((report) => report.enabled)
      .map((report) => report.label)
      .join(", ");
    console.warn(
      `No healthy EVM networks selected for ${config.selectionMode}. Configured targets: ${configuredTargets || summarizeSelection(reports)}`
    );
    return;
  }

  for (const activeNetwork of activeNetworks) {
    const contracts = buildContracts(
      activeNetwork.selectedRpcUrl,
      activeNetwork.network,
      config.walletPrivateKey
    );

    console.log(
      `Running pass on ${activeNetwork.label} (${activeNetwork.selectedRpcUrl}) as ${contracts.wallet.address}`
    );

    if (contracts.protocolVersion === "v3") {
      const status = await runV3Maintenance(config, activeNetwork, contracts, stateStore);
      if (status === "paused" || status === "not-staked") {
        continue;
      }
    } else if (contracts.protocolVersion === "v2") {
      await runV2Maintenance(config, activeNetwork, contracts, stateStore);
    }

    if (options?.claimsOnly) {
      continue;
    }

    if (config.role === "provider" || config.role === "both") {
      await runProviderPass(config, activeNetwork, contracts, stateStore);
    }
    if (config.role === "verifier" || config.role === "both") {
      await runVerifierPass(config, activeNetwork, contracts, stateStore);
    }
  }
}

async function loop(intervalMs: number, fn: () => Promise<void>): Promise<void> {
  // Keep the runtime simple and reevaluate network health every cycle.
  do {
    try {
      await fn();
    } catch (error) {
      console.error("runtime: pass failed", error);
    }
    await sleep(intervalMs);
  } while (true);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

void main();
