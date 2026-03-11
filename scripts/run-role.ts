import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type NodeRoleName = "provider" | "verifier";
type RoleCommand = "doctor" | "status" | "once" | "start";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [role, command] = process.argv.slice(2) as [NodeRoleName | undefined, RoleCommand | undefined];

const roleCommands: Record<RoleCommand, string[]> = {
  doctor: ["src/doctor.ts"],
  status: ["src/status.ts"],
  once: ["src/index.ts", "--once"],
  start: ["src/index.ts"]
};

if (role !== "provider" && role !== "verifier") {
  fail("Usage: tsx scripts/run-role.ts <provider|verifier> <doctor|status|once|start>");
}

if (!command || !(command in roleCommands)) {
  fail("Usage: tsx scripts/run-role.ts <provider|verifier> <doctor|status|once|start>");
}

const envFile = resolve(repoRoot, `.env.${role}.local`);
if (!existsSync(envFile)) {
  fail(`Missing ${envFile}. Create it before running ${role}.`);
}

const tsxCliPath = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
if (!existsSync(tsxCliPath)) {
  fail(`Missing ${tsxCliPath}. Run npm install first.`);
}

console.log(`Using ${envFile}`);

const child = spawn(process.execPath, [tsxCliPath, ...roleCommands[command]], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV_FILE: envFile
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
