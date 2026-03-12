import { checkbox, confirm, input as promptInput, select } from "@inquirer/prompts";
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

  const defaults = getShortcutDefaults(shortcut);
  const role = await askChoice("Select role", [
    { value: "provider", label: "provider" },
    { value: "verifier", label: "verifier" },
    { value: "both", label: "both" }
  ], defaults.role);
  const networkProfile = await askChoice("Select network profile", [
    { value: "testnet", label: "testnet" },
    { value: "mainnet", label: "mainnet" }
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
      { value: "worldland" },
      { value: "base" },
      { value: "ethereum" },
      { value: "bnb" },
      { value: "solana" }
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
    "Wallet private key or path to key file (leave blank to fill later)",
    ""
  );

  let providerConfig: FileNodeConfig["provider"] | undefined;
  if (role === "provider" || role === "both") {
    const connectOpenClaw = await askConfirm(
      "Do you want to connect this provider to an OpenClaw agent?",
      defaults.backend === "openclaw"
    );
    const backend = connectOpenClaw
      ? "openclaw"
      : await askChoice(
          "Provider backend",
          [
            { value: "ollama", label: "ollama", description: "Use a local model through Ollama." },
            { value: "openai", label: "openai", description: "Use the hosted OpenAI API." },
            {
              value: "openclaw",
              label: "openclaw",
              description: "Connect an OpenClaw agent and let it drive provider-side inference."
            }
          ],
          defaults.backend === "openclaw" ? "ollama" : defaults.backend
        );

    if (backend === "ollama") {
      providerConfig = {
        backend: "ollama",
        supportedJobTypes: await askJobTypes(defaults.providerJobTypes),
        ollama: {
          baseUrl: await ask("Ollama base URL", "http://127.0.0.1:11434"),
          model: await ask("Ollama model", "llama3.1")
        }
      };
    } else if (backend === "openai") {
      providerConfig = {
        backend: "openai",
        supportedJobTypes: await askJobTypes(defaults.providerJobTypes),
        openai: {
          model: await ask("OpenAI model", "gpt-4.1-mini")
        }
      };
    } else {
      providerConfig = {
        backend: "openclaw",
        supportedJobTypes: await askJobTypes(defaults.providerJobTypes),
        openclaw: {
          command: await ask("OpenClaw command", "openclaw"),
          agent: await ask("OpenClaw agent id", "main"),
          thinking: await askChoice<OpenClawThinkingLevel>(
            "OpenClaw thinking level",
            [
              { value: "off", label: "off" },
              { value: "minimal", label: "minimal" },
              { value: "low", label: "low" },
              { value: "medium", label: "medium" },
              { value: "high", label: "high" }
            ],
            "low"
          ),
          timeoutSeconds: Number(await ask("OpenClaw timeout in seconds", "120")),
          local: await askConfirm("Run OpenClaw locally on this machine?", true)
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
      { value: "Simple" },
      { value: "General" },
      { value: "Collective" }
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
