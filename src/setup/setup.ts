import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { repoRootFrom } from "../config/loadConfig.js";
import type {
  FileNodeConfig,
  InferenceBackendName,
  JobTypeName,
  NetworkProfileName,
  NetworkSelectionMode,
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
}

type OpenClawThinkingLevel = NonNullable<
  NonNullable<NonNullable<FileNodeConfig["provider"]>["openclaw"]>["thinking"]
>;

export async function main(): Promise<void> {
  const repoRoot = repoRootFrom(import.meta.url);
  const homeRoot = homedir();
  const runtimeRoot = resolve(homeRoot, ".koinara-node");
  const shortcut = readShortcutProfile(process.argv);
  const rl = createInterface({ input, output });

  try {
    const preferredRepoRoot = resolve(homeRoot, "koinara-node");
    const desktopRoot = resolve(homeRoot, "Desktop");
    if (repoRoot.startsWith(desktopRoot) || repoRoot.toLowerCase().startsWith("c:\\windows\\system32")) {
      console.warn(
        `Warning: the repository is running from ${repoRoot}. ` +
          `Recommended clone path is ${preferredRepoRoot}.`
      );
    }

    const defaults = getShortcutDefaults(shortcut);
    const role = await askChoice(rl, "Select role", [
      { value: "provider", label: "provider" },
      { value: "verifier", label: "verifier" },
      { value: "both", label: "both" }
    ], defaults.role);
    const networkProfile = await askChoice(rl, "Select network profile", [
      { value: "testnet", label: "testnet" },
      { value: "mainnet", label: "mainnet" }
    ], defaults.networkProfile);
    console.log(
      "Selection mode help: priority-failover = use one highest-priority healthy chain, " +
        "all-healthy = use every healthy enabled chain."
    );
    const selectionMode = await askChoice(rl, "Network selection mode", [
      { value: "priority-failover", label: "priority-failover (one healthy chain, then fail over)" },
      { value: "all-healthy", label: "all-healthy (all healthy enabled chains together)" }
    ], "priority-failover");
    const enabledNetworks = await askMultiChoice(
      rl,
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
      rl,
      "Shared manifest and receipt root",
      resolve(runtimeRoot, "network")
    );
    const artifactOutputDir = await ask(
      rl,
      "Artifact output directory",
      resolve(runtimeRoot, "artifacts")
    );
    const pollIntervalMs = Number(await ask(rl, "Polling interval in milliseconds", "10000"));
    const privateKeyOrPath = await ask(
      rl,
      "Wallet private key or path to key file (leave blank to fill later)",
      ""
    );

    let providerConfig: FileNodeConfig["provider"] | undefined;
    if (role === "provider" || role === "both") {
      const backend = await askChoice(
        rl,
        "Provider backend",
        [
          { value: "ollama", label: "ollama (local model via Ollama)" },
          { value: "openai", label: "openai (hosted OpenAI API)" },
          { value: "openclaw", label: "openclaw (connect an OpenClaw agent)" }
        ],
        defaults.backend
      );
      if (backend === "ollama") {
        providerConfig = {
          backend: "ollama",
          supportedJobTypes: await askJobTypes(rl, defaults.providerJobTypes),
          ollama: {
            baseUrl: await ask(rl, "Ollama base URL", "http://127.0.0.1:11434"),
            model: await ask(rl, "Ollama model", "llama3.1")
          }
        };
      } else if (backend === "openai") {
        providerConfig = {
          backend: "openai",
          supportedJobTypes: await askJobTypes(rl, defaults.providerJobTypes),
          openai: {
            model: await ask(rl, "OpenAI model", "gpt-4.1-mini")
          }
        };
      } else {
        providerConfig = {
          backend: "openclaw",
          supportedJobTypes: await askJobTypes(rl, defaults.providerJobTypes),
          openclaw: {
            command: await ask(rl, "OpenClaw command", "openclaw"),
            agent: await ask(rl, "OpenClaw agent id", "main"),
            thinking: await askChoice<OpenClawThinkingLevel>(
              rl,
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
            timeoutSeconds: Number(await ask(rl, "OpenClaw timeout in seconds", "120")),
            local: (await askChoice(
              rl,
              "OpenClaw execution mode",
              [
                { value: "local", label: "local" },
                { value: "remote", label: "remote" }
              ],
              "local"
            )) === "local"
          }
        };
      }
    }

    let verifierConfig: FileNodeConfig["verifier"] | undefined;
    if (role === "verifier" || role === "both") {
      verifierConfig = {
        supportedJobTypes: await askJobTypes(rl, defaults.verifierJobTypes),
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
  } finally {
    rl.close();
  }
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

async function ask(
  rl: ReturnType<typeof createInterface>,
  question: string,
  fallback: string
): Promise<string> {
  const answer = (await rl.question(`${question} [${fallback}]: `)).trim();
  return answer || fallback;
}

async function askJobTypes(
  rl: ReturnType<typeof createInterface>,
  fallback: JobTypeName[]
): Promise<JobTypeName[]> {
  return (await askMultiChoice(
    rl,
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
  rl: ReturnType<typeof createInterface>,
  question: string,
  options: ChoiceOption<T>[],
  fallback: T
): Promise<T> {
  const defaultIndex = Math.max(
    0,
    options.findIndex((option) => option.value === fallback)
  );
  while (true) {
    console.log(`${question}:`);
    options.forEach((option, index) => {
      const defaultTag = option.value === fallback ? " (default)" : "";
      console.log(`  ${index + 1}. ${option.label ?? option.value}${defaultTag}`);
    });
    const raw = (await rl.question(`${question} [${defaultIndex + 1}]: `)).trim();
    if (!raw) {
      return fallback;
    }

    const byNumber = Number(raw);
    if (Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= options.length) {
      return options[byNumber - 1].value;
    }

    const byValue = options.find((option) => option.value.toLowerCase() === raw.toLowerCase());
    if (byValue) {
      return byValue.value;
    }

    console.log(`Invalid choice. Enter a number from 1 to ${options.length} or one of: ${options.map((option) => option.value).join(", ")}.`);
  }
}

async function askMultiChoice<T extends string>(
  rl: ReturnType<typeof createInterface>,
  question: string,
  options: ChoiceOption<T>[],
  fallback: T[]
): Promise<T[]> {
  while (true) {
    console.log(`${question}:`);
    options.forEach((option, index) => {
      const defaultTag = fallback.includes(option.value) ? " (default)" : "";
      console.log(`  ${index + 1}. ${option.label ?? option.value}${defaultTag}`);
    });
    console.log("  Use comma-separated numbers or values.");
    const raw = (await rl.question(`${question} [${fallback.join(",")}]: `)).trim();
    if (!raw) {
      return fallback;
    }

    const entries = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
    const resolved: T[] = [];
    let valid = true;

    for (const entry of entries) {
      const byNumber = Number(entry);
      if (Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= options.length) {
        const value = options[byNumber - 1].value;
        if (!resolved.includes(value)) {
          resolved.push(value);
        }
        continue;
      }

      const byValue = options.find((option) => option.value.toLowerCase() === entry.toLowerCase());
      if (byValue) {
        if (!resolved.includes(byValue.value)) {
          resolved.push(byValue.value);
        }
        continue;
      }

      valid = false;
      console.log(`Invalid choice: ${entry}`);
      break;
    }

    if (valid && resolved.length > 0) {
      return resolved;
    }

    console.log(`Invalid selection. Use numbers or values from: ${options.map((option) => option.value).join(", ")}.`);
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
