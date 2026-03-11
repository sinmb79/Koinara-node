export const registryAbi = [
  "function totalJobs() view returns (uint256)",
  "function getJob(uint256 jobId) view returns ((uint256 jobId,address creator,bytes32 requestHash,bytes32 schemaHash,uint64 deadline,uint8 jobType,uint256 premiumReward,uint8 state))",
  "function getSubmission(uint256 jobId) view returns ((address provider,bytes32 responseHash,uint64 submittedAt,bool exists))",
  "function submitResponse(uint256 jobId, bytes32 responseHash)",
  "function markExpired(uint256 jobId)"
] as const;

export const verifierAbi = [
  "function registerSubmission(uint256 jobId)",
  "function verifySubmission(uint256 jobId)",
  "function rejectSubmission(uint256 jobId, string reason)",
  "function finalizePoI(uint256 jobId) returns (bytes32)",
  "function getRecord(uint256 jobId) view returns ((address provider,bytes32 responseHash,uint64 submittedAt,uint256 approvals,uint256 quorum,bool validJob,bool withinDeadline,bool formatPass,bool nonEmptyResponse,bool verificationPass,bool rejected,bool finalized,bytes32 poiHash))",
  "function hasParticipated(uint256 jobId, address verifier) view returns (bool)",
  "function getApprovedVerifiers(uint256 jobId) view returns (address[])"
] as const;

export const rewardDistributorAbi = [
  "function distributeRewards(uint256 jobId, address provider)",
  "function rewardsDistributed(uint256 jobId) view returns (bool)"
] as const;

export const tokenAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
] as const;
