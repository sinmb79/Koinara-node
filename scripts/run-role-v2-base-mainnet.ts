import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type NodeRoleName = "provider" | "verifier";
type RoleCommand = "doctor" | "status" | "once" | "claim" | "start";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [role, command] = process.argv.slice(2) as [NodeRoleName | undefined, RoleCommand | undefined];

const roleCommands: Record<RoleCommand, string[]> = {
  doctor: ["src/doctor.ts"],
  status: ["src/status.ts"],
  once: ["src/index.ts", "--once"],
  claim: ["src/index.ts", "--once", "--claims-only"],
  start: ["src/index.ts"]
};

if (role !== "provider" && role !== "verifier") {
  fail("Usage: tsx scripts/run-role-v2-base-mainnet.ts <provider|verifier> <doctor|status|once|claim|start>");
}

if (!command || !(command in roleCommands)) {
  fail("Usage: tsx scripts/run-role-v2-base-mainnet.ts <provider|verifier> <doctor|status|once|claim|start>");
}

const envFile = resolve(repoRoot, role === "provider" ? ".env.provider.local" : ".env.verifier.local");
const nodeConfigFile = resolve(
  repoRoot,
  role === "provider" ? "node.config.v2-openclaw-base-mainnet.json" : "node.config.v2-base-mainnet.json"
);
const networksFile = resolve(repoRoot, "config", "networks.mainnet.base.v2.json");
const stateDir = resolve(
  repoRoot,
  role === "provider" ? ".koinara-node-v2-openclaw-base-mainnet/provider" : ".koinara-node-v2-base-mainnet/verifier"
);

const tsxCliPath = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
if (!existsSync(tsxCliPath)) {
  fail(`Missing ${tsxCliPath}. Run npm install first.`);
}

console.log(`Using ${envFile}`);
console.log(`Using ${nodeConfigFile}`);
console.log(`Using ${networksFile}`);
console.log("Using profile mainnet (Base)");

const child = spawn(process.execPath, [tsxCliPath, ...roleCommands[command]], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV_FILE: envFile,
    NODE_ROLE: role,
    NODE_CONFIG_FILE: nodeConfigFile,
    NODE_NETWORKS_FILE: networksFile,
    NETWORK_PROFILE: "mainnet",
    NODE_STATE_DIR: stateDir
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
