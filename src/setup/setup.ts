import { checkbox, confirm, input as promptInput, select } from "@inquirer/prompts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRootFrom } from "../config/loadConfig.js";
import type { FileNodeConfig, NetworkProfileName, NodeRole } from "../types.js";

type SetupShortcut =
  | "provider-openclaw"
  | "verifier-only";

interface ChoiceOption<T extends string> {
  value: T;
  label?: string;
  description?: string;
}

const npmRunCommand = process.platform === "win32" ? "npm.cmd run" : "npm run";

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
  console.log("- This step saves the base Koinara node config only.");
  console.log("- The primary operator path is Worldland + OpenClaw + Koinara.");
  console.log("- Provider inference is connected afterward with one separate OpenClaw command.");
  console.log(`- OpenClaw path: ${npmRunCommand} openclaw:connect`);
  console.log("- If you use OpenClaw as your operator shell, hand the OpenClaw setup guide to the agent and let it run the connection steps.");
  console.log("- First-time setup keeps runtime folders and polling on safe defaults unless you choose to customize them.");
  console.log("- You can skip wallet setup now and fill it later before starting the node.");
  console.log("");

  const defaults = getShortcutDefaults(shortcut);
  const role = await askChoice(
    "Select role",
    [
      { value: "provider", label: "provider", description: "Submit inference results and earn provider rewards." },
      { value: "verifier", label: "verifier", description: "Review submissions, verify jobs, and earn verifier rewards." },
      { value: "both", label: "both", description: "Run provider and verifier together on one machine." }
    ],
    defaults.role
  );
  const networkProfile = await askChoice(
    "Select network profile",
    [
      { value: "testnet", label: "testnet", description: "Safer for rehearsal and dry runs." },
      { value: "mainnet", label: "mainnet", description: "Live network with real WLC gas and real KOIN rewards." }
    ],
    defaults.networkProfile
  );
  const selectionMode = await askChoice(
    "Network selection mode",
    [
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
    ],
    "priority-failover"
  );
  const enabledNetworks = await askMultiChoice(
    "Enabled networks",
    [
      { value: "worldland", description: "Primary live path for Worldland + OpenClaw operators." },
      { value: "base", description: "Fallback EVM path kept ready as an alternative." },
      { value: "ethereum", description: "Advanced use only." },
      { value: "bnb", description: "Advanced use only." },
      { value: "solana", description: "Prepared configuration only in this release." }
    ],
    defaults.enabledNetworks
  );

  let verifierConfig: FileNodeConfig["verifier"] | undefined;
  if (role === "verifier" || role === "both") {
    verifierConfig = {
      supportedJobTypes: ["Simple", "General", "Collective"],
      supportedSchemaHashes: []
    };
  }

  const defaultSharedRoot = resolve(runtimeRoot, "network");
  const defaultArtifactOutputDir = resolve(runtimeRoot, "artifacts");
  const defaultPollIntervalMs = 10000;
  const customizeAdvancedSettings = await askConfirm(
    "Customize runtime folders or polling interval now?",
    false
  );
  const sharedRoot = customizeAdvancedSettings
    ? await ask("Shared manifest and receipt root", defaultSharedRoot)
    : defaultSharedRoot;
  const artifactOutputDir = customizeAdvancedSettings
    ? await ask("Artifact output directory", defaultArtifactOutputDir)
    : defaultArtifactOutputDir;
  const pollIntervalMs = customizeAdvancedSettings
    ? Number(await ask("Polling interval in milliseconds", String(defaultPollIntervalMs)))
    : defaultPollIntervalMs;
  const configureWalletNow = await askConfirm(
    "Configure the wallet for on-chain actions now?",
    false
  );
  const privateKeyOrPath = configureWalletNow
    ? await ask("Wallet private key or path to key file", "")
    : "";

  const fileConfig: FileNodeConfig = {
    role,
    networkProfile,
    selectionMode,
    enabledNetworks: enabledNetworks.map((entry) => entry.trim()).filter(Boolean),
    pollIntervalMs,
    manifestRoots: [sharedRoot],
    receiptRoots: [sharedRoot],
    artifactOutputDir,
    verifier: verifierConfig
  };

  writeJson(resolve(repoRoot, "node.config.json"), fileConfig);
  writeEnv(
    resolve(repoRoot, ".env.local"),
    buildEnvTemplate({
      repoRoot,
      role,
      networkProfile,
      walletInput: privateKeyOrPath,
      stateDir: resolve(runtimeRoot, "state")
    })
  );

  const runtimeDirs = [sharedRoot, artifactOutputDir].map((entry) => resolve(repoRoot, entry));
  runtimeDirs.forEach((dir) => mkdirSync(dir, { recursive: true }));

  console.log("Wrote node.config.json and .env.local");
  printSetupSummary({
    role,
    networkProfile,
    selectionMode,
    enabledNetworks,
    walletConfigured: Boolean(privateKeyOrPath),
    providerPending: role === "provider" || role === "both",
    usedDefaultAdvancedSettings: !customizeAdvancedSettings
  });
}

function readShortcutProfile(argv: string[]): SetupShortcut | undefined {
  const index = argv.findIndex((entry) => entry === "--profile");
  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1];
  if (
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
} {
  if (shortcut === "provider-openclaw") {
    return {
      role: "provider",
      networkProfile: "mainnet",
      enabledNetworks: ["worldland"]
    };
  }

  if (shortcut === "verifier-only") {
    return {
      role: "verifier",
      networkProfile: "testnet",
      enabledNetworks: ["worldland"]
    };
  }

  return {
    role: "provider",
    networkProfile: "mainnet",
    enabledNetworks: ["worldland"]
  };
}

async function ask(question: string, fallback: string): Promise<string> {
  return await promptInput({
    message: question,
    default: fallback
  });
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

function printSetupSummary(input: {
  role: NodeRole;
  networkProfile: NetworkProfileName;
  selectionMode: string;
  enabledNetworks: string[];
  walletConfigured: boolean;
  usedDefaultAdvancedSettings: boolean;
  providerPending: boolean;
}): void {
  console.log("");
  console.log("Setup summary:");
  console.log(`- Role: ${input.role}`);
  console.log(`- Network profile: ${input.networkProfile}`);
  console.log(`- Selection mode: ${input.selectionMode}`);
  console.log(`- Enabled networks: ${input.enabledNetworks.join(", ")}`);
  if (input.providerPending) {
    console.log("- Provider inference source: not connected yet");
  }
  console.log(
    `- Wallet for on-chain actions: ${input.walletConfigured ? "configured" : "not configured yet"}`
  );
  console.log(
    `- Runtime folders and polling: ${input.usedDefaultAdvancedSettings ? "using standard defaults" : "customized"}`
  );
  console.log("");
  console.log("Current state:");
  if (input.providerPending) {
    console.log("- Provider mode is enabled, but the OpenClaw inference path is not connected yet.");
    console.log("- The default next step is to connect OpenClaw.");
  }
  if (!input.walletConfigured) {
    console.log("- Wallet is still empty, so the node cannot send on-chain transactions until you add it.");
  }
  console.log("");
  console.log("What this means:");
  console.log("- Setup saved the base node config files, but the node is not running yet.");
  if (input.providerPending) {
    console.log("- Provider mode still needs one connection step before doctor/start can succeed.");
  }
  console.log("- Active rewards accrue after registration and heartbeat on-chain.");
  console.log("- Work rewards accrue after accepted jobs.");
  console.log("- KOIN is not minted immediately. In v2, rewards are claimable after the epoch closes.");
  console.log("");
  console.log("Recommended next steps:");
  if (!input.walletConfigured) {
    console.log("- Add WALLET_PRIVATE_KEY or WALLET_KEYFILE to .env.local before starting the node.");
  }
  if (input.providerPending) {
    console.log(`- Connect OpenClaw in one step: ${npmRunCommand} openclaw:connect`);
    console.log(`- After OpenClaw connect: ${npmRunCommand} provider:v2:openclaw:check`);
    console.log(`- After OpenClaw connect: ${npmRunCommand} provider:v2:openclaw:start`);
    console.log("- If you operate through OpenClaw chat, give the OpenClaw setup guide to the agent and let it run these commands.");
  } else {
    console.log(`- Check the saved config with: ${npmRunCommand} doctor`);
  }
  if (input.role === "verifier" || input.role === "both") {
    console.log(`- Verifier check: ${npmRunCommand} verifier:v2:status`);
    console.log(`- Verifier start: ${npmRunCommand} verifier:v2:start`);
    console.log(`- Verifier claim after epoch close: ${npmRunCommand} verifier:v2:claim`);
  }
  console.log("- Status commands also show the current epoch and the next epoch close time.");
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

  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
