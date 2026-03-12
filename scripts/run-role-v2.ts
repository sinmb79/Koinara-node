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

function resolveEnvFile(repoRoot: string, role: NodeRoleName): string {
  const roleSpecific = resolve(repoRoot, `.env.${role}.local`);
  if (existsSync(roleSpecific)) {
    return roleSpecific;
  }

  const shared = resolve(repoRoot, ".env.local");
  if (existsSync(shared)) {
    return shared;
  }

  fail(`Missing ${roleSpecific} and ${shared}. Run setup first.`);
}

if (role !== "provider" && role !== "verifier") {
  fail("Usage: tsx scripts/run-role-v2.ts <provider|verifier> <doctor|status|once|claim|start>");
}

if (!command || !(command in roleCommands)) {
  fail("Usage: tsx scripts/run-role-v2.ts <provider|verifier> <doctor|status|once|claim|start>");
}

const envFile = resolveEnvFile(repoRoot, role);

const nodeConfigFile = resolve(repoRoot, "node.config.v2-mainnet.json");
if (!existsSync(nodeConfigFile)) {
  fail(`Missing ${nodeConfigFile}. Run npm run setup first, then connect a provider with npm run openclaw:connect or npm run ollama:connect.`);
}

const networksFile = resolve(repoRoot, "config", "networks.mainnet.v2.json");
if (!existsSync(networksFile)) {
  fail(`Missing ${networksFile}.`);
}

const tsxCliPath = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
if (!existsSync(tsxCliPath)) {
  fail(`Missing ${tsxCliPath}. Run npm install first.`);
}

console.log(`Using ${envFile}`);
console.log(`Using ${nodeConfigFile}`);
console.log(`Using ${networksFile}`);

const child = spawn(process.execPath, [tsxCliPath, ...roleCommands[command]], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV_FILE: envFile,
    NODE_ROLE: role,
    NODE_CONFIG_FILE: nodeConfigFile,
    NODE_NETWORKS_FILE: networksFile,
    NODE_STATE_DIR: resolve(repoRoot, ".koinara-node-v2", role)
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
