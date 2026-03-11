import { existsSync } from "node:fs";
import { formatEther } from "ethers";
import { buildContracts } from "./chain/client.js";
import { inspectNetworks, selectedHealthyNetworks } from "./chain/networkSelection.js";
import { loadRuntimeConfig } from "./config/loadConfig.js";
import { FileStateStore } from "./state/fileStateStore.js";
import type { StoredNodeState } from "./types.js";

async function main(): Promise<void> {
  const config = loadRuntimeConfig({ allowMissingWallet: true });
  const stateStore = new FileStateStore(config.statePath);
  const state = stateStore.getState();
  const reports = await inspectNetworks(config);
  const selectedNetworks = selectedHealthyNetworks(reports);

  console.log(`Role: ${config.role}`);
  console.log(`Network profile: ${config.networkProfile}`);
  console.log(`Selection mode: ${config.selectionMode}`);
  console.log(`Wallet source: ${config.walletSource}`);
  console.log(`Last local activity: ${state.lastRunAt ?? "n/a"}`);

  printNetworkSummary(reports);

  if (!config.walletPrivateKey) {
    console.log("Wallet is not configured yet.");
    return;
  }

  for (const activeNetwork of selectedNetworks) {
    const contracts = buildContracts(
      activeNetwork.selectedRpcUrl,
      activeNetwork.network,
      config.walletPrivateKey
    );
    const nativeBalance = await contracts.provider.getBalance(contracts.wallet.address);
    const tokenBalance = await contracts.token.balanceOf(contracts.wallet.address);

    console.log(`\n${activeNetwork.label}`);
    console.log(`- Wallet: ${contracts.wallet.address}`);
    console.log(`- RPC: ${activeNetwork.selectedRpcUrl}`);
    console.log(
      `- Native balance: ${formatEther(nativeBalance)} ${activeNetwork.network.nativeToken.symbol}`
    );
    console.log(`- KOIN balance: ${formatEther(tokenBalance)} KOIN`);
  }

  console.log("\nCached participation summary:");
  printParticipationSummary("Provider submissions", state.provider.submittedJobs);
  printParticipationSummary("Verifier participations", state.verifier.participatedJobs);
  console.log(`State file present: ${existsSync(config.statePath) ? "yes" : "no"}`);
}

function printNetworkSummary(
  reports: Awaited<ReturnType<typeof inspectNetworks>>
): void {
  console.log("Configured networks:");
  for (const report of reports) {
    const parts = [`- ${report.label}`, `[${report.kind}]`, `status=${report.status}`];
    if (report.selected) {
      parts.push("selected");
    }
    if (report.selectedRpcUrl) {
      parts.push(report.selectedRpcUrl);
    }
    if (report.reason) {
      parts.push(`reason=${report.reason}`);
    }
    console.log(parts.join(" "));
  }
}

function printParticipationSummary(
  label: string,
  records: StoredNodeState["provider"]["submittedJobs"] | StoredNodeState["verifier"]["participatedJobs"]
): void {
  const byNetwork = Object.entries(records).reduce<Record<string, string[]>>((acc, [, entry]) => {
    const networkKey = entry.networkKey || "legacy";
    acc[networkKey] = acc[networkKey] ?? [];
    acc[networkKey].push(entry.recordedAt);
    return acc;
  }, {});

  if (Object.keys(byNetwork).length === 0) {
    console.log(`- ${label}: none yet`);
    return;
  }

  for (const [networkKey, recordedAtValues] of Object.entries(byNetwork).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const summary = summarizeWindow(recordedAtValues);
    console.log(
      `- ${label} on ${networkKey}: today=${summary.today}, week=${summary.week}, all=${summary.all}`
    );
  }
}

function summarizeWindow(recordedAtValues: string[]): { today: number; week: number; all: number } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  let today = 0;
  let week = 0;
  for (const value of recordedAtValues) {
    const delta = now - new Date(value).getTime();
    if (delta <= dayMs) {
      today += 1;
    }
    if (delta <= weekMs) {
      week += 1;
    }
  }

  return {
    today,
    week,
    all: recordedAtValues.length
  };
}

void main();
