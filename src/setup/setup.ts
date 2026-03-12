import { checkbox, confirm, input as promptInput, select } from "@inquirer/prompts";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRootFrom } from "../config/loadConfig.js";
import type {
  FileNodeConfig,
  InferenceBackendName,
  JobTypeName,
  NetworkProfileName,
  NodeRole
} from "../types.js";

type SetupShortcut =
  | "provider-ollama"
  | "provider-openai"
  | "provider-openclaw"
  | "verifier-only";

interface ChoiceOption<T extends string> {
  value: T;
  label?: string;
  description?: string;
}

type OpenClawThinkingLevel = NonNullable<
  NonNullable<NonNullable<FileNodeConfig["provider"]>["openclaw"]>["thinking"]
>;

export async function main(): Promise<void> {
  const repoRoot = repoRootFrom(import.meta.url);
  const homeRoot = homedir();
  const runtimeRoot = resolve(homeRoot, ".koinara-node");
  const shortcut = readShortcutProfile(process.argv);

  const preferredRepoRoot = resolve(homeRoot, "koinara-node");
  const desktopRoot = resolve(homeRoot, "Desktop");
  if (repoRoot.startsWith(desktopRoot) || repoRoot.toLowerCase().startsWith("c:\\windows\\system32")) {
    console.warn(
      `Warning: the repository is running from ${repoRoot}. ` +
        `Recommended clone path is ${preferredRepoRoot}.`
    );
  }

  console.log("Setup notes:");
  console.log("- Provider mode requires one inference source: OpenClaw agent or local LLM (Ollama).");
  console.log("- If OpenClaw is installed normally, the default command `openclaw` is usually correct.");
  console.log("- If Ollama is installed normally, the default URL `http://127.0.0.1:11434` is usually correct.");
  console.log("- You can leave the wallet field blank now and fill it later before starting the node.");
  console.log("");

  const defaults = getShortcutDefaults(shortcut);
  const role = await askChoice("Select role", [
    { value: "provider", label: "provider", description: "Submit inference results and earn provider rewards." },
    { value: "verifier", label: "verifier", description: "Review submissions, verify jobs, and earn verifier rewards." },
    { value: "both", label: "both", description: "Run provider and verifier together on one machine." }
  ], defaults.role);
  const networkProfile = await askChoice("Select network profile", [
    { value: "testnet", label: "testnet", description: "Safer for rehearsal and dry runs." },
    { value: "mainnet", label: "mainnet", description: "Live network with real WLC gas and real KOIN rewards." }
  ], defaults.networkProfile);
  const selectionMode = await askChoice("Network selection mode", [
    {
      value: "priority-failover",
      label: "priority-failover",
      description: "Use one highest-priority healthy chain, then fail over if it becomes unhealthy."
    },
    {
      value: "all-healthy",
      label: "all-healthy",
      description: "Use every healthy enabled chain at the same time."
    }
  ], "priority-failover");
  const enabledNetworks = await askMultiChoice(
    "Enabled networks",
    [
      { value: "worldland", description: "Worldland Seoul / Gwangju profiles used by Koinara." },
      { value: "base", description: "Base EVM network." },
      { value: "ethereum", description: "Ethereum mainnet or testnet profile." },
      { value: "bnb", description: "BNB Smart Chain profile." },
      { value: "solana", description: "Prepared configuration only in this release." }
    ],
    defaults.enabledNetworks
  );
  const sharedRoot = await ask(
    "Shared manifest and receipt root",
    resolve(runtimeRoot, "network")
  );
  const artifactOutputDir = await ask(
    "Artifact output directory",
    resolve(runtimeRoot, "artifacts")
  );
  const pollIntervalMs = Number(await ask("Polling interval in milliseconds", "10000"));
  const privateKeyOrPath = await ask(
    "Wallet private key or path to key file (leave blank now and fill it later before starting the node)",
    ""
  );

  let providerConfig: FileNodeConfig["provider"] | undefined;
  if (role === "provider" || role === "both") {
    const backend = await askChoice<"ollama" | "openclaw">(
      "Provider inference source",
      [
        {
          value: "ollama",
          label: "local LLM (Ollama)",
          description: "Use a local model installed on this machine through Ollama."
        },
        {
          value: "openclaw",
          label: "OpenClaw agent",
          description: "Use an OpenClaw agent on this machine as the provider inference source."
        }
      ],
      defaults.backend === "openclaw" ? "openclaw" : "ollama"
    );

    if (backend === "ollama") {
      const ollamaBaseUrl = "http://127.0.0.1:11434";
      const ollamaModel = "llama3.1";
      console.log(
        "Using default Ollama settings: baseUrl=http://127.0.0.1:11434, model=llama3.1"
      );
      const check = await testOllamaConnection({
        baseUrl: ollamaBaseUrl,
        model: ollamaModel
      });
      if (check.ok) {
        console.log(`Ollama check passed: ${check.summary}`);
      } else {
        console.warn(`Ollama check failed: ${check.summary}`);
        const continueAnyway = await askConfirm(
          "Continue setup anyway and save the Ollama config?",
          true
        );
        if (!continueAnyway) {
          throw new Error("Setup cancelled until Ollama connection is fixed.");
        }
      }

      providerConfig = {
        backend: "ollama",
        supportedJobTypes: await askJobTypes(defaults.providerJobTypes),
        ollama: {
          baseUrl: ollamaBaseUrl,
          model: ollamaModel
        }
      };
    } else {
      const openclawCommand = undefined;
      const openclawAgent = "main";
      const openclawThinking: OpenClawThinkingLevel = "low";
      const openclawTimeoutSeconds = 120;
      const openclawLocal = true;
      console.log(
        "Using default OpenClaw settings: command=openclaw, agent=main, local=true, thinking=low"
      );
      const check = await testOpenClawConnection({
        command: openclawCommand,
        agent: openclawAgent,
        thinking: openclawThinking,
        timeoutSeconds: openclawTimeoutSeconds,
        local: openclawLocal
      });
      if (check.ok) {
        console.log(`OpenClaw check passed: ${check.summary}`);
      } else {
        console.warn(`OpenClaw check failed: ${check.summary}`);
        const continueAnyway = await askConfirm(
          "Continue setup anyway and save the OpenClaw config?",
          true
        );
        if (!continueAnyway) {
          throw new Error("Setup cancelled until OpenClaw connection is fixed.");
        }
      }

      providerConfig = {
        backend: "openclaw",
        supportedJobTypes: await askJobTypes(defaults.providerJobTypes),
        openclaw: {
          command: openclawCommand,
          agent: openclawAgent,
          thinking: openclawThinking,
          timeoutSeconds: openclawTimeoutSeconds,
          local: openclawLocal
        }
      };
    }
  }

  let verifierConfig: FileNodeConfig["verifier"] | undefined;
  if (role === "verifier" || role === "both") {
    verifierConfig = {
      supportedJobTypes: await askJobTypes(defaults.verifierJobTypes),
      supportedSchemaHashes: []
    };
  }

  const fileConfig: FileNodeConfig = {
    networkProfile,
    selectionMode,
    enabledNetworks: enabledNetworks
      .map((entry) => entry.trim())
      .filter(Boolean),
    pollIntervalMs,
    manifestRoots: [sharedRoot],
    receiptRoots: [sharedRoot],
    artifactOutputDir,
    provider: providerConfig,
    verifier: verifierConfig
  };

  writeJson(resolve(repoRoot, "node.config.json"), fileConfig);
  writeEnv(
    resolve(repoRoot, ".env.local"),
    buildEnvTemplate({
      repoRoot,
      role,
      networkProfile,
      openAiEnabled: providerConfig?.backend === "openai",
      walletInput: privateKeyOrPath,
      stateDir: resolve(runtimeRoot, "state")
    })
  );

  const runtimeDirs = [sharedRoot, artifactOutputDir].map((entry) => resolve(repoRoot, entry));
  runtimeDirs.forEach((dir) => mkdirSync(dir, { recursive: true }));

  console.log("Wrote node.config.json and .env.local");
  console.log("You can now run: npm run doctor");
}

function readShortcutProfile(argv: string[]): SetupShortcut | undefined {
  const index = argv.findIndex((entry) => entry === "--profile");
  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1];
  if (
    value === "provider-ollama" ||
    value === "provider-openai" ||
    value === "provider-openclaw" ||
    value === "verifier-only"
  ) {
    return value;
  }

  return undefined;
}

function getShortcutDefaults(shortcut?: SetupShortcut): {
  role: NodeRole;
  networkProfile: NetworkProfileName;
  enabledNetworks: string[];
  backend: InferenceBackendName;
  providerJobTypes: JobTypeName[];
  verifierJobTypes: JobTypeName[];
} {
  if (shortcut === "provider-openai") {
    return {
      role: "provider",
      networkProfile: "testnet",
      enabledNetworks: ["worldland", "base"],
      backend: "openai",
      providerJobTypes: ["General", "Collective"],
      verifierJobTypes: ["Simple", "General", "Collective"]
    };
  }

  if (shortcut === "provider-openclaw") {
    return {
      role: "provider",
      networkProfile: "testnet",
      enabledNetworks: ["worldland"],
      backend: "openclaw",
      providerJobTypes: ["Simple"],
      verifierJobTypes: ["Simple", "General", "Collective"]
    };
  }

  if (shortcut === "verifier-only") {
    return {
      role: "verifier",
      networkProfile: "testnet",
      enabledNetworks: ["worldland"],
      backend: "ollama",
      providerJobTypes: ["Simple"],
      verifierJobTypes: ["Simple", "General", "Collective"]
    };
  }

  return {
    role: "provider",
    networkProfile: "testnet",
    enabledNetworks: ["worldland"],
    backend: "ollama",
    providerJobTypes: ["Simple"],
    verifierJobTypes: ["Simple", "General", "Collective"]
  };
}

async function ask(question: string, fallback: string): Promise<string> {
  return await promptInput({
    message: question,
    default: fallback
  });
}

async function askJobTypes(fallback: JobTypeName[]): Promise<JobTypeName[]> {
  return (await askMultiChoice(
    "Supported job types",
    [
      { value: "Simple", description: "Fast, small jobs. Lowest coordination cost and quickest path to a result." },
      { value: "General", description: "Normal multi-step jobs. Broader participation and more verification than Simple." },
      { value: "Collective", description: "Harder jobs that benefit from wider participation and stronger consensus." }
    ],
    fallback
  )) as JobTypeName[];
}

async function askChoice<T extends string>(
  question: string,
  options: ChoiceOption<T>[],
  fallback: T
): Promise<T> {
  return await select<T>({
    message: question,
    default: fallback,
    choices: options.map((option) => ({
      value: option.value,
      name: option.label ?? option.value,
      description: option.description
    }))
  });
}

async function askMultiChoice<T extends string>(
  question: string,
  options: ChoiceOption<T>[],
  fallback: T[]
): Promise<T[]> {
  return await checkbox<T>({
    message: `${question} (use arrow keys + space, then enter)`,
    choices: options.map((option) => ({
      value: option.value,
      name: option.label ?? option.value,
      checked: fallback.includes(option.value),
      description: option.description
    })),
    validate(value) {
      if (value.length === 0) {
        return "Select at least one option.";
      }
      return true;
    }
  });
}

async function askConfirm(question: string, fallback: boolean): Promise<boolean> {
  return await confirm({
    message: question,
    default: fallback
  });
}

async function testOpenClawConnection(options: {
  command?: string;
  agent: string;
  thinking: OpenClawThinkingLevel;
  timeoutSeconds: number;
  local: boolean;
}): Promise<{ ok: true; summary: string } | { ok: false; summary: string }> {
  const command = options.command?.trim() || "openclaw";
  const args = ["agent", "--agent", options.agent.trim() || "main", "--json"];

  if (options.local) {
    args.push("--local");
  }

  if (options.thinking?.trim()) {
    args.push("--thinking", options.thinking.trim());
  }

  if (options.timeoutSeconds && Number.isFinite(options.timeoutSeconds)) {
    args.push("--timeout", String(options.timeoutSeconds));
  }

  args.push("--message", "Reply with exactly OK");

  return await new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
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
        summary: error.message
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolvePromise({
          ok: false,
          summary: stderr.trim() || stdout.trim() || `OpenClaw exited with code ${code}`
        });
        return;
      }

      const body = stdout.trim() || stderr.trim();
      resolvePromise({
        ok: true,
        summary: body ? "agent returned a JSON response" : "agent completed successfully"
      });
    });
  });
}

async function testOllamaConnection(options: {
  baseUrl: string;
  model: string;
}): Promise<{ ok: true; summary: string } | { ok: false; summary: string }> {
  try {
    const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/api/tags`);
    if (!response.ok) {
      return {
        ok: false,
        summary: `Ollama returned HTTP ${response.status}`
      };
    }

    const payload = (await response.json()) as {
      models?: Array<{ name?: string }>;
    };
    const models = payload.models ?? [];
    const hasRequestedModel = models.some((entry) => entry.name?.trim() === options.model.trim());
    const summary = hasRequestedModel
      ? `server responded and model ${options.model} is available`
      : `server responded but model ${options.model} was not listed`;

    return {
      ok: hasRequestedModel,
      summary
    };
  } catch (error) {
    return {
      ok: false,
      summary: error instanceof Error ? error.message : String(error)
    };
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeEnv(path: string, values: Record<string, string | undefined>): void {
  const lines = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value ?? ""}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

export function buildEnvTemplate(input: {
  repoRoot: string;
  role: NodeRole;
  networkProfile: NetworkProfileName;
  openAiEnabled: boolean;
  walletInput: string;
  stateDir: string;
}): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {
    NODE_ROLE: input.role,
    NETWORK_PROFILE: input.networkProfile,
    NODE_STATE_DIR: input.stateDir
  };

  if (!input.walletInput) {
    values.WALLET_PRIVATE_KEY = "";
    values.WALLET_KEYFILE = "";
  } else if (input.walletInput.startsWith("0x")) {
    values.WALLET_PRIVATE_KEY = input.walletInput;
  } else {
    if (!existsSync(resolve(input.repoRoot, input.walletInput))) {
      console.warn(`Warning: key file does not exist yet: ${input.walletInput}`);
    }
    values.WALLET_KEYFILE = input.walletInput;
  }

  if (input.openAiEnabled) {
    values.OPENAI_API_KEY = "";
  }

  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
