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

interface ConnectionCheckResult {
  ok: boolean;
  summary: string;
}

interface SkillInstallResult {
  ok: boolean;
  summary: string;
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
  console.log("- First-time setup keeps runtime folders and polling on safe defaults unless you choose to customize them.");
  console.log("- You can skip wallet setup now and fill it later before starting the node.");
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

  let providerConfig: FileNodeConfig["provider"] | undefined;
  let providerCheck: ConnectionCheckResult | undefined;
  let providerSourceSummary: string | undefined;
  let openClawSkillInstall: SkillInstallResult | undefined;
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
      providerSourceSummary = "local LLM (Ollama)";
      console.log(
        "Using default Ollama settings: baseUrl=http://127.0.0.1:11434, model=llama3.1"
      );
      providerCheck = await testOllamaConnection({
        baseUrl: ollamaBaseUrl,
        model: ollamaModel
      });
      if (providerCheck.ok) {
        console.log(`Ollama check passed: ${providerCheck.summary}`);
      } else {
        console.warn(`Ollama check failed: ${providerCheck.summary}`);
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
      providerSourceSummary = "OpenClaw agent";
      console.log(
        "Using default OpenClaw settings: command=openclaw, agent=main, local=true, thinking=low"
      );
      providerCheck = await testOpenClawConnection({
        command: openclawCommand,
        agent: openclawAgent,
        thinking: openclawThinking,
        timeoutSeconds: openclawTimeoutSeconds,
        local: openclawLocal
      });
      if (providerCheck.ok) {
        console.log(`OpenClaw check passed: ${providerCheck.summary}`);
      } else {
        console.warn(`OpenClaw check failed: ${providerCheck.summary}`);
        const continueAnyway = await askConfirm(
          "Continue setup anyway and save the OpenClaw config?",
          true
        );
        if (!continueAnyway) {
          throw new Error("Setup cancelled until OpenClaw connection is fixed.");
        }
      }

      openClawSkillInstall = await installOpenClawSkill(repoRoot);
      if (openClawSkillInstall.ok) {
        console.log(`OpenClaw skill install passed: ${openClawSkillInstall.summary}`);
      } else {
        console.warn(`OpenClaw skill install failed: ${openClawSkillInstall.summary}`);
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
  printSetupSummary({
    role,
    networkProfile,
    selectionMode,
    enabledNetworks,
    providerSourceSummary,
    providerCheck,
    openClawSkillInstall,
    walletConfigured: Boolean(privateKeyOrPath),
    providerBackend: providerConfig?.backend,
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
}): Promise<ConnectionCheckResult> {
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

async function installOpenClawSkill(repoRoot: string): Promise<SkillInstallResult> {
  const isWindows = process.platform === "win32";
  const scriptPath = isWindows
    ? resolve(repoRoot, "scripts", "install-openclaw-skill.ps1")
    : resolve(repoRoot, "scripts", "install-openclaw-skill.sh");

  if (!existsSync(scriptPath)) {
    return {
      ok: false,
      summary: `missing installer script: ${scriptPath}`
    };
  }

  const command = isWindows ? "powershell" : "bash";
  const args = isWindows
    ? ["-ExecutionPolicy", "Bypass", "-File", scriptPath]
    : [scriptPath];

  return await new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
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
      if ((code ?? 1) !== 0) {
        resolvePromise({
          ok: false,
          summary: stderr.trim() || stdout.trim() || `installer exited with code ${code ?? 1}`
        });
        return;
      }

      resolvePromise({
        ok: true,
        summary: stdout.trim() || "installed bundled OpenClaw skill"
      });
    });
  });
}

function printSetupSummary(input: {
  role: NodeRole;
  networkProfile: NetworkProfileName;
  selectionMode: string;
  enabledNetworks: string[];
  providerSourceSummary?: string;
  providerCheck?: ConnectionCheckResult;
  openClawSkillInstall?: SkillInstallResult;
  walletConfigured: boolean;
  usedDefaultAdvancedSettings: boolean;
  providerBackend?: FileNodeConfig["provider"] extends infer T
    ? T extends { backend: infer B }
      ? B
      : never
    : never;
}): void {
  console.log("");
  console.log("Setup summary:");
  console.log(`- Role: ${input.role}`);
  console.log(`- Network profile: ${input.networkProfile}`);
  console.log(`- Selection mode: ${input.selectionMode}`);
  console.log(`- Enabled networks: ${input.enabledNetworks.join(", ")}`);
  if (input.providerSourceSummary) {
    console.log(`- Provider inference source: ${input.providerSourceSummary}`);
  }
  if (input.providerCheck) {
    console.log(
      `- Provider connection check: ${input.providerCheck.ok ? "ready" : "not ready"} (${input.providerCheck.summary})`
    );
  }
  if (input.openClawSkillInstall) {
    console.log(
      `- OpenClaw skill install: ${input.openClawSkillInstall.ok ? "installed" : "not installed"} (${input.openClawSkillInstall.summary})`
    );
  }
  console.log(
    `- Wallet for on-chain actions: ${input.walletConfigured ? "configured" : "not configured yet"}`
  );
  console.log(
    `- Runtime folders and polling: ${input.usedDefaultAdvancedSettings ? "using standard defaults" : "customized"}`
  );
  console.log("");
  console.log("Current state:");
  if (input.providerCheck?.ok) {
    console.log("- Provider backend check passed on this computer.");
  } else if (input.providerBackend === "openclaw" && input.providerCheck) {
    if (input.providerCheck.summary.includes("ENOENT")) {
      console.log("- OpenClaw skill was installed, but the `openclaw` command was not found on this computer yet.");
      console.log("- This means setup saved the config, but OpenClaw CLI is not ready in your shell path.");
    } else {
      console.log(`- OpenClaw is configured, but the connection check still failed: ${input.providerCheck.summary}`);
    }
  } else if (input.providerCheck) {
    console.log(`- Provider backend is configured, but the connection check still failed: ${input.providerCheck.summary}`);
  }
  if (!input.walletConfigured) {
    console.log("- Wallet is still empty, so the node cannot send on-chain transactions until you add it.");
  }
  console.log("");
  console.log("What this means:");
  console.log("- Setup saved the config files, but the node is not running yet.");
  console.log("- Protocol connection starts only after you run doctor/start commands.");
  if (input.providerSourceSummary) {
    console.log(
      `- Provider communication path: ${input.providerSourceSummary} -> Koinara-node -> Worldland manifests/receipts -> Worldland contracts`
    );
  }
  console.log("- Active rewards accrue after registration and heartbeat on-chain.");
  console.log("- Work rewards accrue after accepted jobs.");
  console.log("- KOIN is not minted immediately. In v2, rewards are claimable after the epoch closes.");
  console.log("");
  console.log("Recommended next steps:");
  if (!input.walletConfigured) {
    console.log("- Add WALLET_PRIVATE_KEY or WALLET_KEYFILE to .env.local before starting the node.");
  }
  console.log("- Check the saved config with: npm run doctor");
  if (input.role === "provider" || input.role === "both") {
    if (input.providerBackend === "openclaw") {
      console.log("- Confirm OpenClaw CLI exists: openclaw --help");
      console.log(
        '- Confirm the local OpenClaw agent replies: openclaw agent --agent main --local --json --thinking low --timeout 120 --message "Reply with exactly OK"'
      );
      console.log("- Provider check (connection + epoch + recent jobs + rewards): npm run provider:v2:openclaw:check");
      console.log("- Provider start: npm run provider:v2:openclaw:start");
      console.log("- Provider claim after epoch close: npm run provider:v2:openclaw:claim");
      console.log("- OpenClaw skill install (manual fallback): powershell -ExecutionPolicy Bypass -File .\\scripts\\install-openclaw-skill.ps1");
      console.log("- When jobs are processed, the running terminal will print lines like:");
      console.log("  worldland: provider submitted response for job <jobId> (<responseHash>)");
    } else {
      console.log("- Provider connection status: npm run provider:v2:status");
      console.log("- Provider start: npm run provider:v2:start");
      console.log("- Provider claim after epoch close: npm run provider:v2:claim");
      console.log("- When jobs are processed, the running terminal will print lines like:");
      console.log("  worldland: provider submitted response for job <jobId> (<responseHash>)");
    }
  }
  if (input.role === "verifier" || input.role === "both") {
    console.log("- Verifier check (connection + epoch + recent jobs + rewards): npm run verifier:v2:status");
    console.log("- Verifier start: npm run verifier:v2:start");
    console.log("- Verifier claim after epoch close: npm run verifier:v2:claim");
    console.log("- When jobs are processed, the running terminal will print lines like:");
    console.log("  worldland: verifier approved job <jobId>");
    console.log("  worldland: verifier finalized PoI for job <jobId>");
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
