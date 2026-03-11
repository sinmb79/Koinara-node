import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type {
  FileNodeConfig,
  NetworkConfig,
  NetworkProfileName,
  NodeRole,
  RuntimeConfig,
  RuntimeNetworkConfig,
  NetworksProfile
} from "../types.js";
import { getRpcCandidates } from "../chain/rpc.js";

export function repoRootFrom(importMetaUrl = import.meta.url): string {
  return resolve(fileURLToPath(new URL("../..", importMetaUrl)));
}

export function loadRuntimeConfig(options?: {
  repoRoot?: string;
  allowMissingWallet?: boolean;
}): RuntimeConfig {
  const repoRoot = options?.repoRoot ?? repoRootFrom(import.meta.url);

  loadEnvFiles(repoRoot);

  const nodeConfigPath = resolve(repoRoot, "node.config.json");
  if (!existsSync(nodeConfigPath)) {
    throw new Error(`Missing ${nodeConfigPath}. Run npm run setup first.`);
  }

  const fileConfig = JSON.parse(readFileSync(nodeConfigPath, "utf8")) as FileNodeConfig;
  const networkProfile = (process.env.NETWORK_PROFILE ?? fileConfig.networkProfile) as NetworkProfileName;
  const role = (process.env.NODE_ROLE ?? inferRole(fileConfig)) as NodeRole;
  const networksPath = resolve(repoRoot, "config", `networks.${networkProfile}.json`);
  const networksProfileData = JSON.parse(readFileSync(networksPath, "utf8")) as NetworksProfile;
  const walletResolution = loadWallet(repoRoot, options?.allowMissingWallet === true);
  const networks = resolveRuntimeNetworks(
    repoRoot,
    fileConfig,
    networksProfileData.networks,
    process.env.RPC_URL
  );

  return {
    repoRoot,
    role,
    walletPrivateKey: walletResolution.privateKey,
    walletSource: walletResolution.source,
    networkProfile,
    selectionMode: fileConfig.selectionMode ?? "priority-failover",
    networks,
    pollIntervalMs: fileConfig.pollIntervalMs,
    stateDir: resolve(repoRoot, ".koinara-node"),
    statePath: resolve(repoRoot, ".koinara-node", "state.json"),
    provider: fileConfig.provider,
    verifier: fileConfig.verifier,
    openAiApiKey: process.env.OPENAI_API_KEY
  };
}

function inferRole(fileConfig: FileNodeConfig): NodeRole {
  if (fileConfig.provider && fileConfig.verifier) {
    return "both";
  }
  if (fileConfig.verifier) {
    return "verifier";
  }
  return "provider";
}

function resolveRuntimeNetworks(
  repoRoot: string,
  fileConfig: FileNodeConfig,
  networks: NetworkConfig[],
  rpcOverride?: string
): RuntimeNetworkConfig[] {
  const enabledNetworks = fileConfig.enabledNetworks?.length ? fileConfig.enabledNetworks : ["worldland"];

  return networks.map((network) => {
    const enabledBySelection =
      enabledNetworks.includes("*") || enabledNetworks.includes(network.key);
    const manifestRoots =
      network.manifestRoots?.length
        ? network.manifestRoots.map((entry) => resolveMaybe(repoRoot, entry))
        : fileConfig.manifestRoots.map((entry) => resolveMaybe(repoRoot, entry));
    const receiptRoots =
      network.receiptRoots?.length
        ? network.receiptRoots.map((entry) => resolveMaybe(repoRoot, entry))
        : fileConfig.receiptRoots.map((entry) => resolveMaybe(repoRoot, entry));
    const artifactOutputDir = resolveMaybe(
      repoRoot,
      network.artifactOutputDir ??
        `${trimTrailingSlash(fileConfig.artifactOutputDir)}/${network.key}`
    );

    if (network.kind === "evm") {
      return {
        ...network,
        enabled: network.enabled && enabledBySelection,
        manifestRoots,
        receiptRoots,
        artifactOutputDir,
        rpcCandidates: getRpcCandidates(network.rpcUrls, rpcOverride)
      };
    }

    return {
      ...network,
      enabled: network.enabled && enabledBySelection,
      manifestRoots,
      receiptRoots,
      artifactOutputDir,
      rpcCandidates: getRpcCandidates(network.rpcUrls)
    };
  });
}

function trimTrailingSlash(value: string): string {
  return value.replace(/[\\/]+$/, "");
}

function loadEnvFiles(repoRoot: string): void {
  const envPath = resolve(repoRoot, ".env");
  const envLocalPath = resolve(repoRoot, ".env.local");

  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  if (existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
  }
}

function loadWallet(
  repoRoot: string,
  allowMissingWallet: boolean
): { privateKey: string; source: "env" | "keyfile" | "missing" } {
  const inline = process.env.WALLET_PRIVATE_KEY?.trim();
  if (inline) {
    return { privateKey: inline, source: "env" };
  }

  const keyfile = process.env.WALLET_KEYFILE?.trim();
  if (keyfile) {
    const resolved = resolveMaybe(repoRoot, keyfile);
    if (!existsSync(resolved)) {
      throw new Error(`WALLET_KEYFILE does not exist: ${keyfile}`);
    }
    return {
      privateKey: readFileSync(resolved, "utf8").trim(),
      source: "keyfile"
    };
  }

  if (allowMissingWallet) {
    return { privateKey: "", source: "missing" };
  }

  throw new Error("WALLET_PRIVATE_KEY or WALLET_KEYFILE is required");
}

export function resolveMaybe(baseDir: string, target: string): string {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return target;
  }

  return resolve(baseDir, target);
}
