export type NodeRole = "provider" | "verifier" | "both";
export type NetworkProfileName = "testnet" | "mainnet";
export type JobTypeName = "Simple" | "General" | "Collective";
export type JobStateName =
  | "Created"
  | "Open"
  | "Submitted"
  | "UnderVerification"
  | "Accepted"
  | "Rejected"
  | "Settled"
  | "Expired";
export type InferenceBackendName = "ollama" | "openai";
export type NetworkKind = "evm" | "solana";
export type NetworkSelectionMode = "priority-failover" | "all-healthy";
export type NetworkHealthStatus = "healthy" | "unhealthy" | "unsupported" | "disabled";
export type ProtocolVersionName = "v1" | "v2";

export interface ChainConfig {
  key: string;
  label: string;
  kind: "evm";
  enabled: boolean;
  priority: number;
  rpcUrls: string[];
  networkRef?: string;
  chainId: number;
  explorerBaseUrl: string;
  confirmationsRequired: number;
  recommendedGasBufferNative: string;
  nativeToken: {
    type: string;
    symbol: string;
    address?: string;
  };
  contracts: {
    registry: string;
    verifier: string;
    rewardDistributor: string;
    token: string;
    nodeRegistry?: string;
  };
  protocolVersion?: ProtocolVersionName;
  manifestRoots?: string[];
  receiptRoots?: string[];
  artifactOutputDir?: string;
}

export interface SolanaNetworkConfig {
  key: string;
  label: string;
  kind: "solana";
  enabled: boolean;
  priority: number;
  rpcUrls: string[];
  cluster: string;
  explorerBaseUrl: string;
  confirmationsRequired: number;
  recommendedGasBufferNative: string;
  nativeToken: {
    type: string;
    symbol: string;
    address?: string;
  };
  programIds: {
    registry: string;
    verifier: string;
    rewardDistributor: string;
    tokenMint: string;
  };
  manifestRoots?: string[];
  receiptRoots?: string[];
  artifactOutputDir?: string;
}

export type NetworkConfig = ChainConfig | SolanaNetworkConfig;

export interface NetworksProfile {
  networks: NetworkConfig[];
}

export interface FileNodeConfig {
  networkProfile: NetworkProfileName;
  selectionMode: NetworkSelectionMode;
  enabledNetworks: string[];
  pollIntervalMs: number;
  manifestRoots: string[];
  receiptRoots: string[];
  artifactOutputDir: string;
  provider?: {
    backend: InferenceBackendName;
    supportedJobTypes: JobTypeName[];
    ollama?: {
      baseUrl: string;
      model: string;
    };
    openai?: {
      model: string;
      baseUrl?: string;
    };
  };
  verifier?: {
    supportedJobTypes: JobTypeName[];
    supportedSchemaHashes: string[];
  };
}

export interface RuntimeNetworkConfigBase {
  key: string;
  label: string;
  kind: NetworkKind;
  enabled: boolean;
  priority: number;
  manifestRoots: string[];
  receiptRoots: string[];
  artifactOutputDir: string;
  rpcCandidates: string[];
}

export interface EvmRuntimeNetworkConfig extends RuntimeNetworkConfigBase {
  kind: "evm";
  chainId: number;
  networkRef?: string;
  explorerBaseUrl: string;
  confirmationsRequired: number;
  recommendedGasBufferNative: string;
  nativeToken: {
    type: string;
    symbol: string;
    address?: string;
  };
  contracts: {
    registry: string;
    verifier: string;
    rewardDistributor: string;
    token: string;
    nodeRegistry?: string;
  };
  protocolVersion?: ProtocolVersionName;
}

export interface SolanaRuntimeNetworkConfig extends RuntimeNetworkConfigBase {
  kind: "solana";
  cluster: string;
  explorerBaseUrl: string;
  confirmationsRequired: number;
  recommendedGasBufferNative: string;
  nativeToken: {
    type: string;
    symbol: string;
    address?: string;
  };
  programIds: {
    registry: string;
    verifier: string;
    rewardDistributor: string;
    tokenMint: string;
  };
}

export type RuntimeNetworkConfig = EvmRuntimeNetworkConfig | SolanaRuntimeNetworkConfig;

export interface RuntimeConfig {
  repoRoot: string;
  role: NodeRole;
  walletPrivateKey: string;
  walletSource: "env" | "keyfile" | "missing";
  networkProfile: NetworkProfileName;
  selectionMode: NetworkSelectionMode;
  networks: RuntimeNetworkConfig[];
  pollIntervalMs: number;
  stateDir: string;
  statePath: string;
  provider?: FileNodeConfig["provider"];
  verifier?: FileNodeConfig["verifier"];
  openAiApiKey?: string;
}

export interface HealthyEvmNetwork {
  key: string;
  label: string;
  kind: "evm";
  priority: number;
  selectedRpcUrl: string;
  rpcCandidates: string[];
  network: EvmRuntimeNetworkConfig;
}

export interface PreparedSolanaNetwork {
  key: string;
  label: string;
  kind: "solana";
  priority: number;
  network: SolanaRuntimeNetworkConfig;
  reason: string;
}

export type ActiveNetwork = HealthyEvmNetwork | PreparedSolanaNetwork;

export interface JobManifest {
  version: "koinara-job-manifest-v1";
  requestHash: string;
  body: {
    prompt: string;
    contentType: string;
    schema: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
}

export interface SubmissionReceipt {
  version: "koinara-submission-receipt-v1";
  jobId: number;
  responseHash: string;
  provider: string;
  body: {
    contentType: string;
    output: unknown;
    metadata: Record<string, unknown>;
  };
}

export interface OnChainJob {
  jobId: bigint;
  creator: string;
  requestHash: string;
  schemaHash: string;
  deadline: bigint;
  jobType: bigint;
  premiumReward: bigint;
  state: bigint;
}

export interface OnChainSubmission {
  provider: string;
  responseHash: string;
  submittedAt: bigint;
  exists: boolean;
}

export interface VerificationRecord {
  provider: string;
  responseHash: string;
  submittedAt: bigint;
  approvals: bigint;
  quorum: bigint;
  validJob: boolean;
  withinDeadline: boolean;
  formatPass: boolean;
  nonEmptyResponse: boolean;
  verificationPass: boolean;
  rejected: boolean;
  finalized: boolean;
  poiHash: string;
}

export interface StoredNodeState {
  provider: {
    submittedJobs: Record<
      string,
      {
        networkKey: string;
        txHash: string;
        responseHash: string;
        recordedAt: string;
      }
    >;
    claimedWorkRewards: Record<
      string,
      {
        networkKey: string;
        txHash: string;
        recordedAt: string;
      }
    >;
    claimedActiveEpochs: Record<
      string,
      {
        networkKey: string;
        txHash: string;
        recordedAt: string;
      }
    >;
  };
  verifier: {
    participatedJobs: Record<
      string,
      {
        networkKey: string;
        action: string;
        txHash: string;
        recordedAt: string;
      }
    >;
    recordedAcceptedJobs: Record<
      string,
      {
        networkKey: string;
        txHash: string;
        recordedAt: string;
      }
    >;
    claimedWorkRewards: Record<
      string,
      {
        networkKey: string;
        txHash: string;
        recordedAt: string;
      }
    >;
    claimedActiveEpochs: Record<
      string,
      {
        networkKey: string;
        txHash: string;
        recordedAt: string;
      }
    >;
  };
  networkHealth: Record<
    string,
    {
      status: NetworkHealthStatus;
      selectedRpcUrl?: string;
      lastCheckedAt: string;
      lastError?: string;
    }
  >;
  lastRunAt?: string;
}
