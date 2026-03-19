import { id } from "ethers";
import { FileStateStore } from "../state/fileStateStore.js";
import type { HealthyEvmNetwork, RuntimeConfig } from "../types.js";
import type { KoinaraContracts } from "../chain/client.js";

export async function runV3Maintenance(
  config: RuntimeConfig,
  activeNetwork: HealthyEvmNetwork,
  contracts: KoinaraContracts,
  stateStore: FileStateStore
): Promise<"ok" | "paused" | "not-staked"> {
  if (contracts.protocolVersion !== "v3" || !contracts.nodeRegistry || !contracts.nodeStaking) {
    return "ok";
  }

  if (await isProtocolPaused(contracts)) {
    console.warn(`${activeNetwork.key}: protocol is paused, skipping v3 work`);
    return "paused";
  }

  const isStaked = await contracts.nodeStaking.isStaked(contracts.wallet.address);
  if (!isStaked) {
    const minBond = await contracts.nodeStaking.minBond();
    console.warn(
      `${activeNetwork.key}: node is not staked. Minimum bond: ${minBond} wei. Run setup before operating.`
    );
    return "not-staked";
  }

  const currentEpoch = Number(await contracts.nodeRegistry.currentEpoch());
  const node = await contracts.nodeRegistry.getNode(contracts.wallet.address);
  const registeredAt = Number(node.registeredAt ?? 0n);
  const lastHeartbeatEpoch = Number(node.lastHeartbeatEpoch ?? 0n);

  if (!node.active || registeredAt === 0) {
    try {
      const tx = await contracts.nodeRegistry.registerNode(
        roleToNodeRegistryRole(config.role),
        id(`${config.role}:${activeNetwork.key}:${contracts.wallet.address}`)
      );
      const receipt = await tx.wait();
      console.log(`${activeNetwork.key}: v3 node registered`);
      stateStore.touch();
      if (currentEpoch > 0) {
        markActiveClaimIfApplicable(
          config,
          activeNetwork,
          stateStore,
          currentEpoch - 1,
          receipt?.hash ?? tx.hash
        );
      }
    } catch (error) {
      console.warn(`${activeNetwork.key}: v3 registerNode skipped: ${formatError(error)}`);
    }
  } else if (lastHeartbeatEpoch < currentEpoch) {
    try {
      const tx = await contracts.nodeRegistry.heartbeat();
      await tx.wait();
      console.log(`${activeNetwork.key}: v3 heartbeat recorded for epoch ${currentEpoch}`);
    } catch (error) {
      console.warn(`${activeNetwork.key}: v3 heartbeat skipped: ${formatError(error)}`);
    }
  }

  if (currentEpoch === 0) {
    return "ok";
  }

  await tryClaimActiveRewards(config, activeNetwork, contracts, stateStore, currentEpoch - 1);
  await tryClaimProviderWorkRewards(activeNetwork, contracts, stateStore);
  await tryClaimVerifierWorkRewards(activeNetwork, contracts, stateStore);
  return "ok";
}

async function isProtocolPaused(contracts: KoinaraContracts): Promise<boolean> {
  const pausedStates = await Promise.all([
    contracts.nodeRegistry?.paused?.() ?? false,
    contracts.nodeStaking?.paused?.() ?? false,
    contracts.verifier.paused?.() ?? false,
    contracts.rewardDistributor.paused?.() ?? false
  ]);
  return pausedStates.some(Boolean);
}

function roleToNodeRegistryRole(role: RuntimeConfig["role"]): number {
  if (role === "provider") {
    return 0;
  }
  if (role === "verifier") {
    return 1;
  }
  return 2;
}

function activeEpochKey(activeNetwork: HealthyEvmNetwork, epoch: number): string {
  return `${activeNetwork.key}:${activeNetwork.network.chainId}:${epoch}`;
}

function markActiveClaimIfApplicable(
  config: RuntimeConfig,
  activeNetwork: HealthyEvmNetwork,
  stateStore: FileStateStore,
  epoch: number,
  txHash: string
): void {
  const key = activeEpochKey(activeNetwork, epoch);
  const entry = {
    networkKey: activeNetwork.key,
    txHash,
    recordedAt: new Date().toISOString()
  };

  if (config.role === "provider" || config.role === "both") {
    stateStore.markProviderActiveEpochClaim(key, entry);
  }
  if (config.role === "verifier" || config.role === "both") {
    stateStore.markVerifierActiveEpochClaim(key, entry);
  }
}

async function tryClaimActiveRewards(
  config: RuntimeConfig,
  activeNetwork: HealthyEvmNetwork,
  contracts: KoinaraContracts,
  stateStore: FileStateStore,
  latestClaimableEpoch: number
): Promise<void> {
  for (let epoch = 0; epoch <= latestClaimableEpoch; epoch += 1) {
    const key = activeEpochKey(activeNetwork, epoch);
    const alreadyClaimed =
      config.role === "provider"
        ? stateStore.hasProviderActiveEpochClaim(key)
        : config.role === "verifier"
          ? stateStore.hasVerifierActiveEpochClaim(key)
          : stateStore.hasProviderActiveEpochClaim(key) || stateStore.hasVerifierActiveEpochClaim(key);

    if (alreadyClaimed) {
      continue;
    }

    const isActive = await contracts.nodeRegistry!.isNodeActiveAt(contracts.wallet.address, epoch);
    if (!isActive) {
      continue;
    }

    try {
      const tx = await contracts.rewardDistributor.claimActiveReward(epoch);
      const receipt = await tx.wait();
      markActiveClaimIfApplicable(config, activeNetwork, stateStore, epoch, receipt?.hash ?? tx.hash);
      console.log(`${activeNetwork.key}: v3 active reward claimed for epoch ${epoch}`);
    } catch {
      // Another node may have already claimed or the epoch may still be settling.
    }
  }
}

async function tryClaimProviderWorkRewards(
  activeNetwork: HealthyEvmNetwork,
  contracts: KoinaraContracts,
  stateStore: FileStateStore
): Promise<void> {
  const state = stateStore.getState();
  for (const [jobKey, entry] of Object.entries(state.provider.submittedJobs)) {
    if (entry.networkKey !== activeNetwork.key || stateStore.hasProviderWorkRewardClaim(jobKey)) {
      continue;
    }

    const jobId = Number(jobKey.split(":").at(-1));
    if (!Number.isFinite(jobId)) {
      continue;
    }

    try {
      const tx = await contracts.rewardDistributor.claimProviderWorkReward(jobId);
      const receipt = await tx.wait();
      stateStore.markProviderWorkRewardClaim(jobKey, {
        networkKey: activeNetwork.key,
        txHash: receipt?.hash ?? tx.hash,
        recordedAt: new Date().toISOString()
      });
      console.log(`${activeNetwork.key}: v3 provider reward claimed for job ${jobId}`);
    } catch {
      // Claims can fail until the epoch closes or the job is recorded on-chain.
    }
  }
}

async function tryClaimVerifierWorkRewards(
  activeNetwork: HealthyEvmNetwork,
  contracts: KoinaraContracts,
  stateStore: FileStateStore
): Promise<void> {
  const state = stateStore.getState();
  for (const [jobKey, entry] of Object.entries(state.verifier.participatedJobs)) {
    if (entry.networkKey !== activeNetwork.key || stateStore.hasVerifierWorkRewardClaim(jobKey)) {
      continue;
    }
    if (entry.action.startsWith("rejected")) {
      continue;
    }

    const jobId = Number(jobKey.split(":").at(-1));
    if (!Number.isFinite(jobId)) {
      continue;
    }

    try {
      const tx = await contracts.rewardDistributor.claimVerifierWorkReward(jobId);
      const receipt = await tx.wait();
      stateStore.markVerifierWorkRewardClaim(jobKey, {
        networkKey: activeNetwork.key,
        txHash: receipt?.hash ?? tx.hash,
        recordedAt: new Date().toISOString()
      });
      console.log(`${activeNetwork.key}: v3 verifier reward claimed for job ${jobId}`);
    } catch {
      // Claims can fail until the epoch closes or the job is recorded on-chain.
    }
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
