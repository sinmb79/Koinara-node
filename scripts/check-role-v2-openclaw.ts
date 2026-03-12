import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

type NodeRoleName = "provider" | "verifier";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [role] = process.argv.slice(2) as [NodeRoleName | undefined];

if (role !== "provider" && role !== "verifier") {
  fail("Usage: tsx scripts/check-role-v2-openclaw.ts <provider|verifier>");
}

const envFile = resolve(repoRoot, `.env.${role}.local`);
if (!existsSync(envFile)) {
  fail(`Missing ${envFile}. Create it before running ${role}.`);
}

const nodeConfigFile = resolve(repoRoot, "node.config.v2-openclaw-mainnet.json");
if (!existsSync(nodeConfigFile)) {
  fail(`Missing ${nodeConfigFile}.`);
}

const networksFile = resolve(repoRoot, "config", "networks.mainnet.v2.json");
if (!existsSync(networksFile)) {
  fail(`Missing ${networksFile}.`);
}

const tsxCliPath = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
if (!existsSync(tsxCliPath)) {
  fail(`Missing ${tsxCliPath}. Run npm install first.`);
}

const sharedEnv = {
  ...process.env,
  NODE_ENV_FILE: envFile,
  NODE_CONFIG_FILE: nodeConfigFile,
  NODE_NETWORKS_FILE: networksFile,
  NODE_STATE_DIR: resolve(repoRoot, ".koinara-node-v2-openclaw", role)
};

console.log(`Using ${envFile}`);
console.log(`Using ${nodeConfigFile}`);
console.log(`Using ${networksFile}`);
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
