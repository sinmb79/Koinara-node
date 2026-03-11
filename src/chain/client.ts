import { Contract, JsonRpcProvider, Wallet } from "ethers";
import type {
  ChainConfig,
  JobStateName,
  JobTypeName,
  OnChainJob,
  OnChainSubmission,
  VerificationRecord
} from "../types.js";
import { registryAbi, rewardDistributorAbi, tokenAbi, verifierAbi } from "./abis.js";

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
  registry: Contract;
  verifier: Contract;
  rewardDistributor: Contract;
  token: Contract;
}

export function buildContracts(
  rpcUrl: string,
  chain: ChainConfig,
  walletPrivateKey: string
): KoinaraContracts {
  const provider = new JsonRpcProvider(rpcUrl, chain.chainId || undefined);
  const wallet = new Wallet(walletPrivateKey, provider);

  return {
    provider,
    wallet,
    registry: new Contract(chain.contracts.registry, registryAbi, wallet),
    verifier: new Contract(chain.contracts.verifier, verifierAbi, wallet),
    rewardDistributor: new Contract(chain.contracts.rewardDistributor, rewardDistributorAbi, wallet),
    token: new Contract(chain.contracts.token, tokenAbi, wallet)
  };
}

export function asJob(job: OnChainJob): OnChainJob {
  return job;
}

export function asSubmission(submission: OnChainSubmission): OnChainSubmission {
  return submission;
}

export function asRecord(record: VerificationRecord): VerificationRecord {
  return record;
}
