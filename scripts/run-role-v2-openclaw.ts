import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveProfileFromEnvFile,
  resolveRoleEnvFile,
  resolveV2NetworksFile,
  resolveV2NodeConfigFile,
  resolveV2Profile,
  resolveV2StateDir
} from "./v2-runtime-paths.js";

type NodeRoleName = "provider" | "verifier";
type RoleCommand = "doctor" | "status" | "once" | "claim" | "start";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [role, command, requestedProfile] = process.argv.slice(2) as [
  NodeRoleName | undefined,
  RoleCommand | undefined,
  string | undefined
];

const roleCommands: Record<RoleCommand, string[]> = {
  doctor: ["src/doctor.ts"],
  status: ["src/status.ts"],
  once: ["src/index.ts", "--once"],
  claim: ["src/index.ts", "--once", "--claims-only"],
  start: ["src/index.ts"]
};

if (role !== "provider" && role !== "verifier") {
  fail("Usage: tsx scripts/run-role-v2-openclaw.ts <provider|verifier> <doctor|status|once|claim|start> [testnet|mainnet]");
}

if (!command || !(command in roleCommands)) {
  fail("Usage: tsx scripts/run-role-v2-openclaw.ts <provider|verifier> <doctor|status|once|claim|start> [testnet|mainnet]");
}

const fallbackProfile = resolveV2Profile(repoRoot, requestedProfile);
const envFile = resolveRoleEnvFile(repoRoot, role, fallbackProfile);
const profile = resolveProfileFromEnvFile(envFile, fallbackProfile);
const nodeConfigFile = resolveV2NodeConfigFile(repoRoot, profile, "openclaw");
const networksFile = resolveV2NetworksFile(repoRoot, profile);

const tsxCliPath = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
if (!existsSync(tsxCliPath)) {
  fail(`Missing ${tsxCliPath}. Run npm install first.`);
}

console.log(`Using ${envFile}`);
console.log(`Using ${nodeConfigFile}`);
console.log(`Using ${networksFile}`);
console.log(`Using profile ${profile}`);

const child = spawn(process.execPath, [tsxCliPath, ...roleCommands[command]], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV_FILE: envFile,
    NODE_ROLE: role,
    NODE_CONFIG_FILE: nodeConfigFile,
    NODE_NETWORKS_FILE: networksFile,
    NETWORK_PROFILE: profile,
    NODE_STATE_DIR: resolveV2StateDir(repoRoot, "openclaw", profile, role)
  }
});

child.on("error", (error) => {
  fail(error instanceof Error ? error.message : String(error));
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
