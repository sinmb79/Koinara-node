import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

type NodeRoleName = "provider" | "verifier";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [role] = process.argv.slice(2) as [NodeRoleName | undefined];

if (role !== "provider" && role !== "verifier") {
  fail("Usage: tsx scripts/check-role-v2-base-mainnet.ts <provider|verifier>");
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

const sharedEnv = {
  ...process.env,
  NODE_ENV_FILE: envFile,
  NODE_ROLE: role,
  NODE_CONFIG_FILE: nodeConfigFile,
  NODE_NETWORKS_FILE: networksFile,
  NETWORK_PROFILE: "mainnet",
  NODE_STATE_DIR: stateDir
};

console.log(`Using ${envFile}`);
console.log(`Using ${nodeConfigFile}`);
console.log(`Using ${networksFile}`);
console.log("Using profile mainnet (Base)");
console.log("");
console.log("=== Doctor ===");
await runTsx(["src/doctor.ts"]);
console.log("");
console.log("=== Status ===");
await runTsx(["src/status.ts"]);

async function runTsx(args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tsxCliPath, ...args], {
      cwd: repoRoot,
      stdio: "inherit",
      env: sharedEnv
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(`Command failed with exit code ${code ?? 1}: ${args.join(" ")}`));
        return;
      }
      resolvePromise();
    });
  });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
