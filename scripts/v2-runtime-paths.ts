import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import type { NetworkProfileName } from "../src/types.js";

const PROFILE_VALUES = new Set<NetworkProfileName>(["testnet", "mainnet"]);

export function resolveV2Profile(repoRoot: string, requested?: string): NetworkProfileName {
  const explicit =
    requested?.trim() ??
    process.env.KOINARA_NETWORK_PROFILE?.trim() ??
    process.env.NETWORK_PROFILE?.trim();
  if (isProfile(explicit)) {
    return explicit;
  }

  const baseConfigPath = resolve(repoRoot, "node.config.json");
  if (existsSync(baseConfigPath)) {
    const parsed = JSON.parse(readFileSync(baseConfigPath, "utf8")) as { networkProfile?: string };
    if (isProfile(parsed.networkProfile)) {
      return parsed.networkProfile;
    }
  }

  return "mainnet";
}

export function resolveRoleEnvFile(repoRoot: string, role: "provider" | "verifier", profile: NetworkProfileName): string {
  const candidates = [
    resolve(repoRoot, `.env.${role}.${profile}.local`),
    resolve(repoRoot, `.env.${role}.local`),
    resolve(repoRoot, ".env.local")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  fail(`Missing ${candidates.join(", ")}. Run setup first.`);
}

export function resolveProfileFromEnvFile(
  envFile: string,
  fallbackProfile: NetworkProfileName
): NetworkProfileName {
  const parsed = dotenv.parse(readFileSync(envFile, "utf8"));
  const value = parsed.NETWORK_PROFILE?.trim();
  return isProfile(value) ? value : fallbackProfile;
}

export function resolveV2NodeConfigFile(
  repoRoot: string,
  profile: NetworkProfileName,
  flavor: "default" | "openclaw"
): string {
  const candidate =
    flavor === "openclaw"
      ? resolve(repoRoot, `node.config.v2-openclaw-${profile}.json`)
      : resolve(repoRoot, `node.config.v2-${profile}.json`);

  if (existsSync(candidate)) {
    return candidate;
  }

  fail(`Missing ${candidate}. Prepare the ${profile} v2 node config first.`);
}

export function resolveV2NetworksFile(repoRoot: string, profile: NetworkProfileName): string {
  const explicit = process.env.NODE_NETWORKS_FILE?.trim();
  if (explicit) {
    return resolve(repoRoot, explicit);
  }

  const candidates = [
    resolve(repoRoot, "config", `networks.${profile}.v2-local.json`),
    resolve(repoRoot, "config", `networks.${profile}.v2.local.json`),
    resolve(repoRoot, "config", `networks.${profile}.v2.json`)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  fail(`Missing ${candidates.join(", ")}. Prepare the ${profile} v2 network profile first.`);
}

export function resolveV2StateDir(
  repoRoot: string,
  flavor: "default" | "openclaw",
  profile: NetworkProfileName,
  role: "provider" | "verifier"
): string {
  const explicit = process.env.NODE_STATE_DIR?.trim();
  if (explicit) {
    return resolve(repoRoot, explicit);
  }

  const baseDir = flavor === "openclaw" ? ".koinara-node-v2-openclaw" : ".koinara-node-v2";
  return resolve(repoRoot, baseDir, profile, role);
}

function isProfile(value: string | undefined): value is NetworkProfileName {
  return value !== undefined && PROFILE_VALUES.has(value as NetworkProfileName);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
