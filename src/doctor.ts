import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { formatEther, parseEther } from "ethers";
import { buildContracts } from "./chain/client.js";
import { inspectNetworks, selectedHealthyNetworks } from "./chain/networkSelection.js";
import { loadRuntimeConfig } from "./config/loadConfig.js";

async function main(): Promise<void> {
  const warnings: string[] = [];
  const failures: string[] = [];

  let config;
  try {
    config = loadRuntimeConfig({ allowMissingWallet: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Configuration load failed: ${message}`);
    process.exitCode = 1;
    return;
  }

  if (!existsSync(resolve(config.repoRoot, "node.config.json"))) {
    failures.push("node.config.json is missing");
  }

  if ((config.role === "provider" || config.role === "both") && !config.provider) {
    failures.push("provider role is enabled but provider config is missing");
  }
  if ((config.role === "verifier" || config.role === "both") && !config.verifier) {
    failures.push("verifier role is enabled but verifier config is missing");
  }
  if (!config.walletPrivateKey) {
    warnings.push(
      "wallet is not configured yet; set WALLET_KEYFILE before running the node"
    );
  }
  if (config.walletSource === "env") {
    warnings.push(
      "wallet is loaded from an inline environment variable; prefer WALLET_KEYFILE so private keys are not copied into shell history or .env files"
    );
  }
  if (config.provider?.backend === "openai" && !config.openAiApiKey) {
    warnings.push("provider backend is openai but OPENAI_API_KEY is not set");
  }
  if (config.provider?.backend === "openclaw") {
    warnings.push(
      "openclaw backend should use a dedicated Koinara worker profile without personal files, chat history, or wallet/tool access"
    );
  }
  if (config.networks.length === 0) {
    failures.push("no networks are configured");
  }

  const reports = await inspectNetworks(config);
  const selectedNetworks = selectedHealthyNetworks(reports);

  for (const report of reports) {
    if (!report.enabled) {
      continue;
    }
    if (report.network.kind !== "evm") {
      warnings.push(`${report.label}: ${report.reason}`);
      continue;
    }
    if (report.network.chainId === 0) {
      failures.push(`${report.label}: chainId is still 0`);
    }
    if (report.status === "unhealthy") {
      failures.push(`${report.label}: ${report.reason}`);
    }
  }

  console.log(`Role: ${config.role}`);
  console.log(`Network profile: ${config.networkProfile}`);
  console.log(`Selection mode: ${config.selectionMode}`);
  console.log(`Wallet source: ${config.walletSource}`);

  if (config.walletPrivateKey) {
    for (const activeNetwork of selectedNetworks) {
      try {
        const contracts = buildContracts(
          activeNetwork.selectedRpcUrl,
          activeNetwork.network,
          config.walletPrivateKey
        );
        const nativeBalance = await contracts.provider.getBalance(contracts.wallet.address);
        const tokenBalance = await contracts.token.balanceOf(contracts.wallet.address);
        console.log(`Healthy network: ${activeNetwork.label}`);
        console.log(`- Wallet: ${contracts.wallet.address}`);
        console.log(`- RPC: ${activeNetwork.selectedRpcUrl}`);
        console.log(
          `- Native balance: ${formatEther(nativeBalance)} ${activeNetwork.network.nativeToken.symbol}`
        );
        console.log(`- KOIN balance: ${formatEther(tokenBalance)} KOIN`);
        if (nativeBalance < parseEther(activeNetwork.network.recommendedGasBufferNative)) {
          warnings.push(
            `${activeNetwork.label}: native balance is below the recommended gas buffer of ${activeNetwork.network.recommendedGasBufferNative} ${activeNetwork.network.nativeToken.symbol}`
          );
        }
      } catch (error) {
        failures.push(
          `${activeNetwork.label}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  const selectedLabels = selectedNetworks.map((entry) => entry.label).join(", ");
  console.log(`Selected runtime networks: ${selectedLabels || "none"}`);

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    warnings.forEach((entry) => console.log(`- ${entry}`));
  }

  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((entry) => console.log(`- ${entry}`));
    process.exitCode = 1;
    return;
  }

  console.log("\nNode doctor found no blocking issues.");
}

void main();
