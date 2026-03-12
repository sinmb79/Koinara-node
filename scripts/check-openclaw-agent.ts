import { spawn } from "node:child_process";
import { defaultOpenClawCommand, resolveOpenClawInvocation } from "../src/inference/openclawCli.js";

const command = defaultOpenClawCommand;

async function main(): Promise<void> {
  console.log(`Checking OpenClaw CLI with: ${command} --help`);
  await run(command, ["--help"]);
  console.log("");
  console.log("Checking installed Koinara OpenClaw skill...");
  await run(command, ["skills", "info", "koinara-node"]);
  console.log("");
  console.log("Checking local OpenClaw agent response...");
  await run(command, [
    "agent",
    "--agent",
    "main",
    "--local",
    "--json",
    "--thinking",
    "low",
    "--timeout",
    "120",
    "--message",
    "Reply with exactly OK"
  ]);
}

async function run(cmd: string, args: string[]): Promise<void> {
  const invocation = resolveOpenClawInvocation(cmd);
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(invocation.command, [...invocation.prefixArgs, ...args], {
      stdio: "inherit",
      env: process.env,
      shell: invocation.shell
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(`Command failed with exit code ${code ?? 1}: ${cmd} ${args.join(" ")}`));
        return;
      }

      resolvePromise();
    });
  });
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
