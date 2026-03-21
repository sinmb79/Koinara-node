import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultOpenClawCommand, resolveOpenClawInvocation } from "../src/inference/openclawCli.js";
import { resolveRuntimeCommands } from "../src/config/runtimeCommands.js";
import type { FileNodeConfig, JobTypeName, NodeRole } from "../src/types.js";
import { installOpenClawSkill } from "./install-openclaw-skill.js";

type BackendName = "openclaw" | "ollama";
type CheckResult = {
  ok: boolean;
  summary: string;
  output?: string;
};

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const backend = process.argv[2] as BackendName | undefined;
const npmRunCommand = process.platform === "win32" ? "npm.cmd run" : "npm run";
const defaultProviderJobTypes: JobTypeName[] = ["Simple", "General", "Collective"];
const defaultVerifierJobTypes: JobTypeName[] = ["Simple", "General", "Collective"];

if (backend !== "openclaw" && backend !== "ollama") {
  fail("Usage: tsx scripts/connect-provider.ts <openclaw|ollama>");
}

const baseConfigPath = resolve(repoRoot, "node.config.json");
if (!existsSync(baseConfigPath)) {
  fail(`Missing ${baseConfigPath}. Run ${npmRunCommand} setup first.`);
}

const baseConfig = JSON.parse(readFileSync(baseConfigPath, "utf8")) as FileNodeConfig;
const role = inferRole(baseConfig);
if (role === "verifier") {
  fail("This node is configured as verifier-only. Run setup again with provider or both before connecting an inference source.");
}

const mergedConfig = buildConnectedConfig(baseConfig, role, backend);

writeJson(baseConfigPath, mergedConfig);

const v2ConfigPath = resolve(repoRoot, `node.config.v2-${mergedConfig.networkProfile}.json`);
writeJson(v2ConfigPath, mergedConfig);

if (backend === "openclaw") {
  const compatibilityPath = resolve(
    repoRoot,
    `node.config.v2-openclaw-${mergedConfig.networkProfile}.json`
  );
  writeJson(compatibilityPath, mergedConfig);
}

console.log(`Updated ${baseConfigPath}`);
console.log(`Updated ${v2ConfigPath}`);
if (backend === "openclaw") {
  console.log(
    `Updated ${resolve(repoRoot, `node.config.v2-openclaw-${mergedConfig.networkProfile}.json`)}`
  );
}
console.log("");

const providerCommands = resolveRuntimeCommands({
  role: "provider",
  config: mergedConfig
});
const verifierCommands = resolveRuntimeCommands({
  role: "verifier",
  config: mergedConfig
});

if (backend === "openclaw") {
  const skillTarget = installOpenClawSkill(repoRoot);
  console.log(`Installed OpenClaw skill: ${skillTarget}`);
  const cliCheck = await runCommand(defaultOpenClawCommand, ["--help"]);
  const skillCheck = cliCheck.ok
    ? await runCommand(defaultOpenClawCommand, ["skills", "info", "koinara-node"])
    : { ok: false, summary: "skipped because OpenClaw CLI is not ready" };
  const agentCheck = cliCheck.ok
    ? await runCommand(defaultOpenClawCommand, [
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
      ])
    : { ok: false, summary: "skipped because OpenClaw CLI is not ready" };
  const normalizedAgentCheck = agentCheck.ok
    ? {
        ...agentCheck,
        summary: "local main agent replied"
      }
    : agentCheck;

  console.log("");
  console.log("OpenClaw connection summary:");
  console.log(`- CLI: ${formatCheck(cliCheck)}`);
  console.log(`- Skill: ${formatCheck(skillCheck)}`);
  console.log(`- Local agent: ${formatCheck(normalizedAgentCheck)}`);
  console.log("");
  console.log("Next commands:");
  if (providerCommands.check) {
    console.log(`- ${npmRunCommand} ${providerCommands.check}`);
  }
  console.log(`- ${npmRunCommand} ${providerCommands.start}`);
  console.log(`- ${npmRunCommand} ${verifierCommands.status}`);
  console.log(`- ${npmRunCommand} ${verifierCommands.start}`);
  console.log("");
  console.log("What this means:");
  console.log("- Node setup is complete.");
  console.log("- OpenClaw is now the configured provider inference source.");
  console.log("- If OpenClaw was already running, restart it or reload skills once to pick up the Koinara skill.");
  console.log("- Keep the start command running across epoch boundaries, or install Windows autostart.");
  console.log("- If the local agent check failed, OpenClaw itself still needs attention before the provider can run.");
} else {
  const ollamaCheck = await testOllamaConnection("http://127.0.0.1:11434", "llama3.1");
  console.log("Ollama connection summary:");
  console.log(`- Local Ollama: ${formatCheck(ollamaCheck)}`);
  console.log("");
  console.log("Next commands:");
  console.log(`- ${npmRunCommand} ${providerCommands.status}`);
  console.log(`- ${npmRunCommand} ${providerCommands.start}`);
  console.log(`- ${npmRunCommand} ${verifierCommands.status}`);
  console.log(`- ${npmRunCommand} ${verifierCommands.start}`);
}

function inferRole(config: FileNodeConfig): NodeRole {
  if (config.role) {
    return config.role;
  }
  if (config.provider && config.verifier) {
    return "both";
  }
  if (config.verifier) {
    return "verifier";
  }
  return "provider";
}

function buildConnectedConfig(
  baseConfig: FileNodeConfig,
  role: NodeRole,
  backend: BackendName
): FileNodeConfig {
  const nextConfig: FileNodeConfig = {
    ...baseConfig,
    role
  };

  if (backend === "openclaw") {
    nextConfig.provider = {
      backend: "openclaw",
      supportedJobTypes: baseConfig.provider?.supportedJobTypes?.length
        ? baseConfig.provider.supportedJobTypes
        : defaultProviderJobTypes,
      openclaw: {
        command: defaultOpenClawCommand,
        agent: "main",
        local: true,
        thinking: "low",
        timeoutSeconds: 120
      }
    };
  } else {
    nextConfig.provider = {
      backend: "ollama",
      supportedJobTypes: baseConfig.provider?.supportedJobTypes?.length
        ? baseConfig.provider.supportedJobTypes
        : defaultProviderJobTypes,
      ollama: {
        baseUrl: "http://127.0.0.1:11434",
        model: "llama3.1"
      }
    };
  }

  if (role === "verifier" || role === "both") {
    nextConfig.verifier = baseConfig.verifier ?? {
      supportedJobTypes: defaultVerifierJobTypes,
      supportedSchemaHashes: []
    };
  }

  return nextConfig;
}

async function runCommand(command: string, args: string[]): Promise<CheckResult> {
  const invocation = resolveOpenClawInvocation(command);
  return await new Promise((resolvePromise) => {
    const child = spawn(invocation.command, [...invocation.prefixArgs, ...args], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: invocation.shell
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolvePromise({
        ok: false,
        summary: error instanceof Error ? error.message : String(error)
      });
    });

    child.on("close", (code) => {
      const body = stdout.trim() || stderr.trim();
      if ((code ?? 1) !== 0) {
        resolvePromise({
          ok: false,
          summary: body || `exit code ${code ?? 1}`,
          output: body
        });
        return;
      }

      resolvePromise({
        ok: true,
        summary: body ? firstLine(body) : "ok",
        output: body
      });
    });
  });
}

async function testOllamaConnection(baseUrl: string, model: string): Promise<CheckResult> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      return {
        ok: false,
        summary: `HTTP ${response.status}`
      };
    }

    const payload = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = payload.models ?? [];
    const hasModel = models.some((entry) => entry.name?.trim() === model);
    return {
      ok: hasModel,
      summary: hasModel
        ? `server responded and model ${model} is available`
        : `server responded but model ${model} was not listed`
    };
  } catch (error) {
    return {
      ok: false,
      summary: error instanceof Error ? error.message : String(error)
    };
  }
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? value;
}

function formatCheck(result: CheckResult): string {
  return result.ok ? `ready (${result.summary})` : `not ready (${result.summary})`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
