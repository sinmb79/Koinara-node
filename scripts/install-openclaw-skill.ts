import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function installOpenClawSkill(repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))): string {
  const sourceDir = resolve(repoRoot, "skills", "koinara-node");
  const targetRoot = resolve(process.env.USERPROFILE ?? process.env.HOME ?? "", ".openclaw", "skills");
  const targetDir = resolve(targetRoot, "koinara-node");

  if (!existsSync(sourceDir)) {
    fail(`Missing skill source: ${sourceDir}`);
  }

  mkdirSync(targetRoot, { recursive: true });
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  cpSync(sourceDir, targetDir, { recursive: true, force: true });

  return targetDir;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const targetDir = installOpenClawSkill();
    console.log("Installed OpenClaw skill:");
    console.log(`  ${targetDir}`);
    console.log("");
    console.log("Restart OpenClaw or reload skills to pick up the new Koinara skill.");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
