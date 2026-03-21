import { existsSync } from "node:fs";
import { formatEther } from "ethers";
import { buildContracts } from "./chain/client.js";
import { hasActiveRewardClaimed } from "./chain/claimStatus.js";
import { inspectNetworks, selectedHealthyNetworks } from "./chain/networkSelection.js";
import { loadRuntimeConfig } from "./config/loadConfig.js";
import { FileStateStore } from "./state/fileStateStore.js";
import type { HealthyEvmNetwork, StoredNodeState } from "./types.js";

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

    if (contracts.protocolVersion === "v2" && contracts.nodeRegistry) {
      await printV2RewardStatus(config.role, activeNetwork, contracts, stateStore, state);
    }
  }

  console.log("\nCached participation summary:");
  printParticipationSummary("Provider submissions", state.provider.submittedJobs);
  printParticipationSummary("Verifier participations", state.verifier.participatedJobs);
  printRecentProviderActivity(state);
  printRecentVerifierActivity(state);
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

async function printV2RewardStatus(
  role: "provider" | "verifier" | "both",
  activeNetwork: HealthyEvmNetwork,
  contracts: ReturnType<typeof buildContracts>,
  stateStore: FileStateStore,
  state: StoredNodeState
): Promise<void> {
  const wallet = contracts.wallet.address;
  const currentEpoch = Number(await contracts.nodeRegistry!.currentEpoch());
  const genesisTimestamp = Number(await contracts.nodeRegistry!.genesisTimestamp());
  const epochDuration = Number(await contracts.nodeRegistry!.epochDuration());
  const currentEpochActive = await contracts.nodeRegistry!.isNodeActiveAt(wallet, currentEpoch);
  const nextEpochClose = genesisTimestamp + (currentEpoch + 1) * epochDuration;

  console.log(`- Current epoch: ${currentEpoch}`);
  console.log(`- Next epoch close: ${formatUnixSeconds(nextEpochClose)}`);
  console.log(`- Active in current epoch: ${currentEpochActive ? "yes" : "no"}`);

  if (currentEpoch === 0) {
    console.log("- Claimable protocol rewards now: none yet (first epoch is still open)");
    return;
  }

  const latestClosedEpoch = currentEpoch - 1;
  const latestClosedActive = await contracts.nodeRegistry!.isNodeActiveAt(wallet, latestClosedEpoch);
  console.log(`- Latest closed epoch: ${latestClosedEpoch}`);
  console.log(`- Active in latest closed epoch: ${latestClosedActive ? "yes" : "no"}`);

  const activeClaims = await estimateActiveClaims(
    activeNetwork,
    contracts,
    latestClosedEpoch
  );
  if (activeClaims.epochs > 0) {
    console.log(
      `- Claimable active rewards: ${activeClaims.epochs} epoch(s), estimated ${formatEther(activeClaims.reward)} KOIN`
    );
  } else {
    console.log("- Claimable active rewards: none");
  }

  if (role === "provider" || role === "both") {
    const providerClaims = await estimateProviderWorkClaims(activeNetwork, contracts, stateStore, state);
    if (providerClaims.jobs > 0) {
      console.log(
        `- Claimable provider work rewards: ${providerClaims.jobs} job(s), estimated ${formatEther(providerClaims.reward)} KOIN`
      );
    } else {
      console.log("- Claimable provider work rewards: none");
    }
  }

  if (role === "verifier" || role === "both") {
    const verifierClaims = await estimateVerifierWorkClaims(activeNetwork, contracts, stateStore, state);
    if (verifierClaims.jobs > 0) {
      console.log(
        `- Claimable verifier work rewards: ${verifierClaims.jobs} job(s), estimated ${formatEther(verifierClaims.reward)} KOIN`
      );
    } else {
      console.log("- Claimable verifier work rewards: none");
    }
  }

  console.log("- Claim shortcut: npm run " + (role === "verifier" ? "verifier:v2:claim" : "provider:v2:claim"));
}

async function estimateActiveClaims(
  activeNetwork: HealthyEvmNetwork,
  contracts: ReturnType<typeof buildContracts>,
  latestClosedEpoch: number
): Promise<{ epochs: number; reward: bigint }> {
  let epochs = 0;
  let reward = 0n;

  for (let epoch = 0; epoch <= latestClosedEpoch; epoch += 1) {
    const alreadyClaimedOnChain = await hasActiveRewardClaimed(
      contracts.rewardDistributor,
      epoch,
      contracts.wallet.address
    );
    if (alreadyClaimedOnChain) {
      continue;
    }

    const active = await contracts.nodeRegistry!.isNodeActiveAt(contracts.wallet.address, epoch);
    if (!active) {
      continue;
    }

    const activeCount = BigInt(await contracts.nodeRegistry!.activeNodeCount(epoch));
    if (activeCount === 0n) {
      continue;
    }

    const emission = BigInt(await contracts.rewardDistributor.activeEpochEmission(epoch));
    reward += emission / activeCount;
    epochs += 1;
  }

  return { epochs, reward };
}

async function estimateProviderWorkClaims(
  activeNetwork: HealthyEvmNetwork,
  contracts: ReturnType<typeof buildContracts>,
  stateStore: FileStateStore,
  state: StoredNodeState
): Promise<{ jobs: number; reward: bigint }> {
  let jobs = 0;
  let reward = 0n;

  for (const [jobKey, entry] of Object.entries(state.provider.submittedJobs)) {
    if (entry.networkKey !== activeNetwork.key || stateStore.hasProviderWorkRewardClaim(jobKey)) {
      continue;
    }

    const jobId = parseJobId(jobKey);
    if (jobId === null) {
      continue;
    }

    try {
      const [, providerReward] = await contracts.rewardDistributor.getRewardBreakdown(jobId);
      reward += BigInt(providerReward);
      jobs += 1;
    } catch {
      // Not yet claimable or not yet recorded on-chain.
    }
  }

  return { jobs, reward };
}

async function estimateVerifierWorkClaims(
  activeNetwork: HealthyEvmNetwork,
  contracts: ReturnType<typeof buildContracts>,
  stateStore: FileStateStore,
  state: StoredNodeState
): Promise<{ jobs: number; reward: bigint }> {
  let jobs = 0;
  let reward = 0n;

  for (const [jobKey, entry] of Object.entries(state.verifier.participatedJobs)) {
    if (
      entry.networkKey !== activeNetwork.key ||
      entry.action.startsWith("rejected") ||
      stateStore.hasVerifierWorkRewardClaim(jobKey)
    ) {
      continue;
    }

    const jobId = parseJobId(jobKey);
    if (jobId === null) {
      continue;
    }

    try {
      const [, , verifierRewardTotal] = await contracts.rewardDistributor.getRewardBreakdown(jobId);
      const approvedVerifiers = (await contracts.verifier.getApprovedVerifiers(jobId)) as string[];
      if (approvedVerifiers.length === 0) {
        continue;
      }
      reward += BigInt(verifierRewardTotal) / BigInt(approvedVerifiers.length);
      jobs += 1;
    } catch {
      // Not yet claimable or not yet recorded on-chain.
    }
  }

  return { jobs, reward };
}

function parseJobId(jobKey: string): number | null {
  const value = Number(jobKey.split(":").at(-1));
  return Number.isFinite(value) ? value : null;
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

function printRecentProviderActivity(state: StoredNodeState): void {
  const entries = Object.entries(state.provider.submittedJobs)
    .sort(([, left], [, right]) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
    .slice(0, 5);

  if (entries.length === 0) {
    console.log("- Recent provider jobs: none yet");
    return;
  }

  console.log("- Recent provider jobs:");
  for (const [jobKey, entry] of entries) {
    const jobId = parseJobId(jobKey);
    console.log(
      `  - ${entry.networkKey} job ${jobId ?? "unknown"} at ${formatIso(entry.recordedAt)} tx=${entry.txHash}`
    );
  }
}

function printRecentVerifierActivity(state: StoredNodeState): void {
  const entries = Object.entries(state.verifier.participatedJobs)
    .sort(([, left], [, right]) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
    .slice(0, 5);

  if (entries.length === 0) {
    console.log("- Recent verifier actions: none yet");
    return;
  }

  console.log("- Recent verifier actions:");
  for (const [jobKey, entry] of entries) {
    const jobId = parseJobId(jobKey);
    console.log(
      `  - ${entry.networkKey} job ${jobId ?? "unknown"} action=${entry.action} at ${formatIso(entry.recordedAt)} tx=${entry.txHash}`
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

function formatUnixSeconds(value: number): string {
  return new Date(value * 1000).toLocaleString();
}

function formatIso(value: string): string {
  return new Date(value).toLocaleString();
}

void main();
