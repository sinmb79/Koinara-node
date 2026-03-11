import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { repoRootFrom } from "../config/loadConfig.js";
import type {
  FileNodeConfig,
  JobTypeName,
  NetworkProfileName,
  NetworkSelectionMode,
  NodeRole
} from "../types.js";

type SetupShortcut = "provider-ollama" | "provider-openai" | "verifier-only";

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
    const role = (await ask(rl, "Select role (provider/verifier/both)", defaults.role)) as NodeRole;
    const networkProfile = (await ask(
      rl,
      "Select network profile (testnet/mainnet)",
      defaults.networkProfile
    )) as NetworkProfileName;
    const selectionMode = (await ask(
      rl,
      "Network selection mode (priority-failover/all-healthy)",
      "priority-failover"
    )) as NetworkSelectionMode;
    const enabledNetworks = await ask(
      rl,
      "Enabled networks (comma-separated keys: worldland,base,ethereum,bnb,solana)",
      defaults.enabledNetworks.join(",")
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
      const backend = await ask(rl, "Provider backend (ollama/openai)", defaults.backend);
      if (backend === "ollama") {
        providerConfig = {
          backend: "ollama",
          supportedJobTypes: await askJobTypes(rl, defaults.providerJobTypes),
          ollama: {
            baseUrl: await ask(rl, "Ollama base URL", "http://127.0.0.1:11434"),
            model: await ask(rl, "Ollama model", "llama3.1")
          }
        };
      } else {
        providerConfig = {
          backend: "openai",
          supportedJobTypes: await askJobTypes(rl, defaults.providerJobTypes),
          openai: {
            model: await ask(rl, "OpenAI model", "gpt-4.1-mini")
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
        .split(",")
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
  if (value === "provider-ollama" || value === "provider-openai" || value === "verifier-only") {
    return value;
  }

  return undefined;
}

function getShortcutDefaults(shortcut?: SetupShortcut): {
  role: NodeRole;
  networkProfile: NetworkProfileName;
  enabledNetworks: string[];
  backend: "ollama" | "openai";
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
  const answer = await ask(
    rl,
    "Supported job types (comma-separated: Simple,General,Collective)",
    fallback.join(",")
  );

  return answer
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) as JobTypeName[];
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
