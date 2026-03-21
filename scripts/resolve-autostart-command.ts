import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { resolveRuntimeCommands } from "../src/config/runtimeCommands.js";
import { resolveProfileFromEnvFile, resolveRoleEnvFile, resolveV2Profile } from "./v2-runtime-paths.js";
import type { FileNodeConfig } from "../src/types.js";

type RuntimeRole = "provider" | "verifier";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [roleArg] = process.argv.slice(2);

if (roleArg !== "provider" && roleArg !== "verifier") {
  fail("Usage: tsx scripts/resolve-autostart-command.ts <provider|verifier>");
}

const nodeConfigPath = resolve(repoRoot, "node.config.json");
if (!existsSync(nodeConfigPath)) {
  fail(`Missing ${nodeConfigPath}. Run npm run setup first.`);
}

const config = JSON.parse(readFileSync(nodeConfigPath, "utf8")) as FileNodeConfig;
const fallbackProfile = resolveV2Profile(repoRoot, config.networkProfile);
const envFile = resolveRoleEnvFile(repoRoot, roleArg, fallbackProfile);
const envValues = dotenv.parse(readFileSync(envFile, "utf8"));
const profile = resolveProfileFromEnvFile(envFile, fallbackProfile);
const commands = resolveRuntimeCommands({
  role: roleArg,
  config,
  stateDirHint: envValues.NODE_STATE_DIR,
  networkProfileHint: profile
});

console.log(commands.start);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
