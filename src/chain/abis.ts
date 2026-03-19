export const registryAbi = [
  "function totalJobs() view returns (uint256)",
  "function getJob(uint256 jobId) view returns ((uint256 jobId,address creator,bytes32 requestHash,bytes32 schemaHash,uint64 deadline,uint8 jobType,uint256 premiumReward,uint8 state))",
  "function getSubmission(uint256 jobId) view returns ((address provider,bytes32 responseHash,uint64 submittedAt,bool exists))",
  "function submitResponse(uint256 jobId, bytes32 responseHash)",
  "function markExpired(uint256 jobId)"
] as const;

export const verifierV2Abi = [
  "function registerSubmission(uint256 jobId)",
  "function verifySubmission(uint256 jobId)",
  "function rejectSubmission(uint256 jobId, string reason)",
  "function finalizePoI(uint256 jobId) returns (bytes32)",
  "function getRecord(uint256 jobId) view returns ((address provider,bytes32 responseHash,uint64 submittedAt,uint256 approvals,uint256 quorum,bool validJob,bool withinDeadline,bool formatPass,bool nonEmptyResponse,bool verificationPass,bool rejected,bool finalized,bytes32 poiHash))",
  "function hasParticipated(uint256 jobId, address verifier) view returns (bool)",
  "function getApprovedVerifiers(uint256 jobId) view returns (address[])"
] as const;

export const verifierV3Abi = [
  "function registerSubmission(uint256 jobId)",
  "function verifySubmission(uint256 jobId)",
  "function rejectSubmission(uint256 jobId, string reason)",
  "function finalizePoI(uint256 jobId) returns (bytes32)",
  "function getRecord(uint256 jobId) view returns ((address provider,bytes32 responseHash,uint64 submittedAt,uint64 finalizedAt,uint256 approvals,uint256 quorum,bool validJob,bool withinDeadline,bool formatPass,bool nonEmptyResponse,bool verificationPass,bool rejected,bool finalized,bytes32 poiHash))",
  "function hasParticipated(uint256 jobId, address verifier) view returns (bool)",
  "function getApprovedVerifiers(uint256 jobId) view returns (address[])",
  "function paused() view returns (bool)"
] as const;

export const verifierAbi = verifierV2Abi;

export const rewardDistributorV1Abi = [
  "function distributeRewards(uint256 jobId, address provider)",
  "function rewardsDistributed(uint256 jobId) view returns (bool)",
  "function currentEpoch() view returns (uint256)",
  "function epochEmission(uint256 epoch) view returns (uint256)",
  "function calculateJobReward(uint256 jobId) view returns (uint256)",
  "function getRewardBreakdown(uint256 jobId) view returns (uint256 totalReward, uint256 providerReward, uint256 verifierRewardTotal)"
] as const;

export const rewardDistributorV2Abi = [
  "function currentEpoch() view returns (uint256)",
  "function epochEmission(uint256 epoch) view returns (uint256)",
  "function activeEpochEmission(uint256 epoch) view returns (uint256)",
  "function workEpochEmission(uint256 epoch) view returns (uint256)",
  "function epochAcceptedWeight(uint256 epoch) view returns (uint256)",
  "function calculateJobReward(uint256 jobId) view returns (uint256)",
  "function getRewardBreakdown(uint256 jobId) view returns (uint256 totalReward, uint256 providerReward, uint256 verifierRewardTotal)",
  "function recordAcceptedJob(uint256 jobId, address provider)",
  "function claimProviderWorkReward(uint256 jobId)",
  "function claimVerifierWorkReward(uint256 jobId)",
  "function claimActiveReward(uint256 epoch)"
] as const;

export const rewardDistributorV3Abi = [
  "function recordAcceptedJob(uint256 jobId, address provider)",
  "function claimProviderWorkReward(uint256 jobId)",
  "function claimVerifierWorkReward(uint256 jobId)",
  "function claimActiveReward(uint256 epoch)",
  "function currentEpoch() view returns (uint256)",
  "function epochEmission(uint256 epoch) view returns (uint256)",
  "function activeEpochEmission(uint256 epoch) view returns (uint256)",
  "function workEpochEmission(uint256 epoch) view returns (uint256)",
  "function epochAcceptedWeight(uint256 epoch) view returns (uint256)",
  "function calculateJobReward(uint256 jobId) view returns (uint256)",
  "function getRewardBreakdown(uint256 jobId) view returns (uint256 totalReward, uint256 providerReward, uint256 verifierRewardTotal)",
  "function getRecordedJob(uint256 jobId) view returns ((address provider,uint64 epoch,uint32 weight,uint32 verifierCount,bool exists,bool providerClaimed))",
  "function paused() view returns (bool)"
] as const;

export const rewardDistributorAbi = rewardDistributorV2Abi;

export const tokenAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)"
] as const;

export const nodeRegistryAbi = [
  "function genesisTimestamp() view returns (uint256)",
  "function epochDuration() view returns (uint256)",
  "function getNode(address node) view returns ((uint8 role,bytes32 metadataHash,uint64 registeredAt,uint64 lastHeartbeatEpoch,bool active))",
  "function activeNodeCount(uint256 epoch) view returns (uint256)",
  "function registerNode(uint8 role, bytes32 metadataHash)",
  "function heartbeat() returns (uint256)",
  "function currentEpoch() view returns (uint256)",
  "function isNodeActiveAt(address node, uint256 epoch) view returns (bool)",
  "function paused() view returns (bool)"
] as const;

export const nodeStakingAbi = [
  "function stake() payable",
  "function topUp() payable",
  "function requestUnstake()",
  "function completeUnstake()",
  "function cancelUnstake()",
  "function isStaked(address node) view returns (bool)",
  "function getStake(address node) view returns ((uint256 amount,uint64 stakedAt,uint64 unstakeRequestedAt,bool active))",
  "function minBond() view returns (uint256)",
  "function currentEpoch() view returns (uint256)",
  "function COOLDOWN_EPOCHS() view returns (uint256)",
  "function paused() view returns (bool)"
] as const;
