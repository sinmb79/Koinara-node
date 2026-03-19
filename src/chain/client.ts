import { Contract, JsonRpcProvider, NonceManager, Wallet } from "ethers";
import type {
  EvmRuntimeNetworkConfig,
  JobStateName,
  JobTypeName,
  ProtocolVersionName,
  OnChainJob,
  OnChainSubmission,
  VerificationRecord
} from "../types.js";
import {
  nodeRegistryAbi,
  nodeStakingAbi,
  registryAbi,
  rewardDistributorV1Abi,
  rewardDistributorV2Abi,
  rewardDistributorV3Abi,
  tokenAbi,
  verifierV2Abi,
  verifierV3Abi
} from "./abis.js";

export const jobTypeToNumber: Record<JobTypeName, number> = {
  Simple: 0,
  General: 1,
  Collective: 2
};

export const jobStateNames: JobStateName[] = [
  "Created",
  "Open",
  "Submitted",
  "UnderVerification",
  "Accepted",
  "Rejected",
  "Settled",
  "Expired"
];

export function jobTypeNameFromValue(value: bigint): JobTypeName {
  if (value === 0n) {
    return "Simple";
  }
  if (value === 1n) {
    return "General";
  }
  return "Collective";
}

export function jobStateNameFromValue(value: bigint): JobStateName {
  return jobStateNames[Number(value)] ?? "Created";
}

export interface KoinaraContracts {
  provider: JsonRpcProvider;
  wallet: Wallet;
  protocolVersion: ProtocolVersionName;
  registry: Contract;
  verifier: Contract;
  rewardDistributor: Contract;
  token: Contract;
  nodeRegistry?: Contract;
  nodeStaking?: Contract;
}

export function buildContracts(
  rpcUrl: string,
  chain: EvmRuntimeNetworkConfig,
  walletPrivateKey: string
): KoinaraContracts {
  const provider = new JsonRpcProvider(rpcUrl, chain.chainId || undefined);
  const wallet = new Wallet(walletPrivateKey, provider);
  const signer = new NonceManager(wallet);
  const version: ProtocolVersionName =
    chain.protocolVersion ??
    (chain.contracts.nodeStaking ? "v3" : chain.contracts.nodeRegistry ? "v2" : "v1");

  return {
    provider,
    wallet,
    protocolVersion: version,
    registry: new Contract(chain.contracts.registry, registryAbi, signer),
    verifier: new Contract(chain.contracts.verifier, version === "v3" ? verifierV3Abi : verifierV2Abi, signer),
    rewardDistributor: new Contract(
      chain.contracts.rewardDistributor,
      version === "v3"
        ? rewardDistributorV3Abi
        : version === "v2"
          ? rewardDistributorV2Abi
          : rewardDistributorV1Abi,
      signer
    ),
    token: new Contract(chain.contracts.token, tokenAbi, signer),
    ...(chain.contracts.nodeRegistry
      ? {
          nodeRegistry: new Contract(chain.contracts.nodeRegistry, nodeRegistryAbi, signer)
        }
      : {}),
    ...(chain.contracts.nodeStaking
      ? {
          nodeStaking: new Contract(chain.contracts.nodeStaking, nodeStakingAbi, signer)
        }
      : {})
  };
}

export function asJob(job: OnChainJob): OnChainJob {
  return job;
}

export function asSubmission(submission: OnChainSubmission): OnChainSubmission {
  return submission;
}

export function asRecord(record: VerificationRecord): VerificationRecord {
  return {
    ...record,
    finalizedAt: typeof record.finalizedAt === "bigint" ? record.finalizedAt : 0n
  };
}
