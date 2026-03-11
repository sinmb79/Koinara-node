import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { ChainConfig, ChainProfileName, FileNodeConfig, NodeRole, RuntimeConfig } from "../types.js";
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
  const chainProfile = (process.env.CHAIN_PROFILE ?? fileConfig.chainProfile) as ChainProfileName;
  const role = (process.env.NODE_ROLE ?? inferRole(fileConfig)) as NodeRole;
  const chainPath = resolve(repoRoot, "config", `chain.${chainProfile}.json`);
  const chain = JSON.parse(readFileSync(chainPath, "utf8")) as ChainConfig;
  const walletResolution = loadWallet(repoRoot, options?.allowMissingWallet === true);

  return {
    repoRoot,
    role,
    walletPrivateKey: walletResolution.privateKey,
    walletSource: walletResolution.source,
    chainProfile,
    chain,
    pollIntervalMs: fileConfig.pollIntervalMs,
    manifestRoots: fileConfig.manifestRoots.map((entry) => resolveMaybe(repoRoot, entry)),
    receiptRoots: fileConfig.receiptRoots.map((entry) => resolveMaybe(repoRoot, entry)),
    artifactOutputDir: resolveMaybe(repoRoot, fileConfig.artifactOutputDir),
    stateDir: resolve(repoRoot, ".koinara-node"),
    statePath: resolve(repoRoot, ".koinara-node", "state.json"),
    rpcCandidates: getRpcCandidates(chain, process.env.RPC_URL),
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
