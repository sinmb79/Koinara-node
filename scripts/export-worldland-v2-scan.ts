import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Contract, JsonRpcProvider, formatEther } from "ethers";

import networksFile from "../config/networks.mainnet.v2.json" with { type: "json" };
import { nodeRegistryAbi, registryAbi, rewardDistributorAbi, tokenAbi, verifierAbi } from "../src/chain/abis.js";

type NetworkConfig = {
  key: string;
  label: string;
  rpcUrls: string[];
  chainId: number;
  explorerBaseUrl: string;
  protocolVersion: string;
  contracts: {
    registry: string;
    verifier: string;
    rewardDistributor: string;
    token: string;
    nodeRegistry: string;
  };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, "../../protocol/docs/live/worldland-v2-snapshot.json");
const network = networksFile.networks[0] as NetworkConfig;
const trackedSeedAddresses = [
  "0xf95232Ae6a716862799C90239028fb590C9bB307",
  "0x59816544dcD2B96fB35e7Eac67BA26510e11B996",
  "0x26ce295f8DD8866C46d6355A7fDDe5CaEB76f3AC"
];

async function main() {
  const provider = new JsonRpcProvider(network.rpcUrls[0], network.chainId);
  const registry = new Contract(network.contracts.registry, registryAbi, provider);
  const verifier = new Contract(network.contracts.verifier, verifierAbi, provider);
  const rewardDistributor = new Contract(network.contracts.rewardDistributor, rewardDistributorAbi, provider);
  const token = new Contract(network.contracts.token, tokenAbi, provider);
  const nodeRegistry = new Contract(network.contracts.nodeRegistry, nodeRegistryAbi, provider);

  const [currentEpoch, genesisTimestamp, epochDuration, totalJobs, totalSupply] = await Promise.all([
    nodeRegistry.currentEpoch(),
    nodeRegistry.genesisTimestamp(),
    nodeRegistry.epochDuration(),
    registry.totalJobs(),
    token.totalSupply()
  ]);

  const epochNumber = Number(currentEpoch);
  const lastClosedEpoch = epochNumber > 0 ? epochNumber - 1 : null;

  const [currentActiveCount, lastClosedCount, currentActiveEmission, currentWorkEmission, lastClosedAcceptedWeight] =
    await Promise.all([
      nodeRegistry.activeNodeCount(currentEpoch),
      lastClosedEpoch === null ? Promise.resolve(0n) : nodeRegistry.activeNodeCount(lastClosedEpoch),
      rewardDistributor.activeEpochEmission(epochNumber),
      rewardDistributor.workEpochEmission(epochNumber),
      lastClosedEpoch === null ? Promise.resolve(0n) : rewardDistributor.epochAcceptedWeight(lastClosedEpoch)
    ]);

  const jobs: Record<string, unknown> = {};
  const trackedAddresses = new Set<string>(trackedSeedAddresses.map((value) => value.toLowerCase()));

  for (let jobId = 1; jobId <= Number(totalJobs); jobId += 1) {
    const [job, submission, record, approvedVerifiers] = await Promise.all([
      registry.getJob(jobId),
      registry.getSubmission(jobId),
      verifier.getRecord(jobId),
      verifier.getApprovedVerifiers(jobId)
    ]);

    let rewardBreakdown: {
      totalReward: string;
      totalRewardFormatted: string;
      providerReward: string;
      providerRewardFormatted: string;
      verifierRewardTotal: string;
      verifierRewardTotalFormatted: string;
    } | null = null;

    try {
      const reward = await rewardDistributor.getRewardBreakdown(jobId);
      rewardBreakdown = {
        totalReward: reward.totalReward.toString(),
        totalRewardFormatted: formatEther(reward.totalReward),
        providerReward: reward.providerReward.toString(),
        providerRewardFormatted: formatEther(reward.providerReward),
        verifierRewardTotal: reward.verifierRewardTotal.toString(),
        verifierRewardTotalFormatted: formatEther(reward.verifierRewardTotal)
      };
    } catch {
      rewardBreakdown = null;
    }

    trackedAddresses.add(String(job.creator).toLowerCase());

    if (submission.exists) {
      trackedAddresses.add(String(submission.provider).toLowerCase());
    }

    for (const approvedVerifier of approvedVerifiers as string[]) {
      trackedAddresses.add(approvedVerifier.toLowerCase());
    }

    jobs[String(jobId)] = {
      jobId,
      creator: String(job.creator),
      requestHash: String(job.requestHash),
      schemaHash: String(job.schemaHash),
      deadline: Number(job.deadline),
      jobType: Number(job.jobType),
      premiumReward: job.premiumReward.toString(),
      premiumRewardFormatted: formatEther(job.premiumReward),
      state: Number(job.state),
      submission: {
        provider: String(submission.provider),
        responseHash: String(submission.responseHash),
        submittedAt: Number(submission.submittedAt),
        exists: Boolean(submission.exists)
      },
      record: {
        provider: String(record.provider),
        responseHash: String(record.responseHash),
        submittedAt: Number(record.submittedAt),
        approvals: Number(record.approvals),
        quorum: Number(record.quorum),
        validJob: Boolean(record.validJob),
        withinDeadline: Boolean(record.withinDeadline),
        formatPass: Boolean(record.formatPass),
        nonEmptyResponse: Boolean(record.nonEmptyResponse),
        verificationPass: Boolean(record.verificationPass),
        rejected: Boolean(record.rejected),
        finalized: Boolean(record.finalized),
        poiHash: String(record.poiHash)
      },
      approvedVerifiers: (approvedVerifiers as string[]).map((value) => String(value)),
      rewardBreakdown
    };
  }

  const nodes: Record<string, unknown> = {};

  for (const address of trackedAddresses) {
    const [node, nativeBalance, tokenBalance] = await Promise.all([
      nodeRegistry.getNode(address),
      provider.getBalance(address),
      token.balanceOf(address)
    ]);

    const [activeCurrent, activePrevious, previousActiveCount, previousActiveEmission] = await Promise.all([
      nodeRegistry.isNodeActiveAt(address, epochNumber),
      lastClosedEpoch === null ? Promise.resolve(false) : nodeRegistry.isNodeActiveAt(address, lastClosedEpoch),
      lastClosedEpoch === null ? Promise.resolve(0n) : nodeRegistry.activeNodeCount(lastClosedEpoch),
      lastClosedEpoch === null ? Promise.resolve(0n) : rewardDistributor.activeEpochEmission(lastClosedEpoch)
    ]);

    const estimatedClosedEpochShare =
      lastClosedEpoch !== null && activePrevious && previousActiveCount > 0n
        ? previousActiveEmission / previousActiveCount
        : 0n;

    nodes[address] = {
      address,
      role: Number(node.role),
      metadataHash: String(node.metadataHash),
      registeredAt: Number(node.registeredAt),
      lastHeartbeatEpoch: Number(node.lastHeartbeatEpoch),
      active: Boolean(node.active),
      activeCurrent: Boolean(activeCurrent),
      activePrevious: Boolean(activePrevious),
      previousEpoch: lastClosedEpoch,
      nativeBalance: nativeBalance.toString(),
      nativeBalanceFormatted: formatEther(nativeBalance),
      tokenBalance: tokenBalance.toString(),
      tokenBalanceFormatted: formatEther(tokenBalance),
      estimatedClosedEpochShare: estimatedClosedEpochShare.toString(),
      estimatedClosedEpochShareFormatted: formatEther(estimatedClosedEpochShare)
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      chainId: network.chainId,
      label: network.label,
      protocolVersion: network.protocolVersion,
      rpcUrl: network.rpcUrls[0],
      explorerBaseUrl: network.explorerBaseUrl
    },
    contracts: network.contracts,
    summary: {
      currentEpoch: epochNumber,
      genesisTimestamp: Number(genesisTimestamp),
      epochDuration: Number(epochDuration),
      nextCloseTimestamp: Number(genesisTimestamp) + (epochNumber + 1) * Number(epochDuration),
      lastClosedEpoch,
      totalJobs: Number(totalJobs),
      totalSupply: totalSupply.toString(),
      totalSupplyFormatted: formatEther(totalSupply),
      currentActiveCount: Number(currentActiveCount),
      lastClosedActiveCount: Number(lastClosedCount),
      currentActiveEmission: currentActiveEmission.toString(),
      currentActiveEmissionFormatted: formatEther(currentActiveEmission),
      currentWorkEmission: currentWorkEmission.toString(),
      currentWorkEmissionFormatted: formatEther(currentWorkEmission),
      lastClosedAcceptedWeight: lastClosedAcceptedWeight.toString()
    },
    jobs,
    nodes
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote scan snapshot to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
