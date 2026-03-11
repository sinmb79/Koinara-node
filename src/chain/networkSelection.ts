import { resolveHealthyRpcUrl } from "./rpc.js";
import type {
  ActiveNetwork,
  HealthyEvmNetwork,
  NetworkHealthStatus,
  PreparedSolanaNetwork,
  RuntimeConfig,
  RuntimeNetworkConfig
} from "../types.js";

export interface NetworkInspection {
  key: string;
  label: string;
  kind: RuntimeNetworkConfig["kind"];
  priority: number;
  enabled: boolean;
  status: NetworkHealthStatus;
  selected: boolean;
  selectedRpcUrl?: string;
  reason?: string;
  activeNetwork?: HealthyEvmNetwork | PreparedSolanaNetwork;
  network: RuntimeNetworkConfig;
}

export async function inspectNetworks(config: RuntimeConfig): Promise<NetworkInspection[]> {
  const reports: NetworkInspection[] = [];
  const enabledNetworks = [...config.networks].sort((left, right) => left.priority - right.priority);

  for (const network of enabledNetworks) {
    if (!network.enabled) {
      reports.push({
        key: network.key,
        label: network.label,
        kind: network.kind,
        priority: network.priority,
        enabled: false,
        status: "disabled",
        selected: false,
        reason: "disabled in networks profile",
        network
      });
      continue;
    }

    if (network.kind === "solana") {
      reports.push({
        key: network.key,
        label: network.label,
        kind: network.kind,
        priority: network.priority,
        enabled: true,
        status: "unsupported",
        selected: false,
        reason: "prepared only; Solana runtime adapter is not implemented in v1",
        activeNetwork: {
          key: network.key,
          label: network.label,
          kind: "solana",
          priority: network.priority,
          network,
          reason: "prepared only; Solana runtime adapter is not implemented in v1"
        },
        network
      });
      continue;
    }

    if (
      !network.contracts.registry ||
      !network.contracts.verifier ||
      !network.contracts.rewardDistributor ||
      !network.contracts.token
    ) {
      reports.push({
        key: network.key,
        label: network.label,
        kind: network.kind,
        priority: network.priority,
        enabled: true,
        status: "unhealthy",
        selected: false,
        reason: "missing one or more contract addresses",
        network
      });
      continue;
    }

    try {
      const selectedRpcUrl = await resolveHealthyRpcUrl(network.rpcCandidates, network.chainId);
      reports.push({
        key: network.key,
        label: network.label,
        kind: network.kind,
        priority: network.priority,
        enabled: true,
        status: "healthy",
        selected: false,
        selectedRpcUrl,
        activeNetwork: {
          key: network.key,
          label: network.label,
          kind: "evm",
          priority: network.priority,
          selectedRpcUrl,
          rpcCandidates: network.rpcCandidates,
          network
        },
        network
      });
    } catch (error) {
      reports.push({
        key: network.key,
        label: network.label,
        kind: network.kind,
        priority: network.priority,
        enabled: true,
        status: "unhealthy",
        selected: false,
        reason: error instanceof Error ? error.message : String(error),
        network
      });
    }
  }

  const healthyReports = reports.filter((report) => report.status === "healthy");
  if (config.selectionMode === "priority-failover") {
    const selected = healthyReports[0];
    if (selected) {
      selected.selected = true;
    }
  } else {
    healthyReports.forEach((report) => {
      report.selected = true;
    });
  }

  return reports;
}

export function selectedHealthyNetworks(reports: NetworkInspection[]): HealthyEvmNetwork[] {
  return reports
    .filter((report): report is NetworkInspection & { activeNetwork: HealthyEvmNetwork } => {
      return report.status === "healthy" && report.selected && report.activeNetwork?.kind === "evm";
    })
    .map((report) => report.activeNetwork);
}

export function summarizeSelection(reports: NetworkInspection[]): string {
  const selected = reports.filter((report) => report.selected).map((report) => report.label);
  if (selected.length === 0) {
    return "none";
  }
  return selected.join(", ");
}

export function makeScopedJobKey(
  network: HealthyEvmNetwork,
  jobId: number | bigint
): string {
  return [
    network.key,
    String(network.network.chainId),
    network.network.contracts.registry.toLowerCase(),
    String(jobId)
  ].join(":");
}

export function networkReceiptPrefix(network: ActiveNetwork | { key: string }): string {
  return network.key;
}
