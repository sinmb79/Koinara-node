import { existsSync } from "node:fs";
import { formatEther } from "ethers";
import { buildContracts } from "./chain/client.js";
import { resolveHealthyRpcUrl } from "./chain/rpc.js";
import { loadRuntimeConfig } from "./config/loadConfig.js";
import { FileStateStore } from "./state/fileStateStore.js";

async function main(): Promise<void> {
  const config = loadRuntimeConfig({ allowMissingWallet: true });
  const stateStore = new FileStateStore(config.statePath);
  const state = stateStore.getState();

  console.log(`Role: ${config.role}`);
  console.log(`Chain profile: ${config.chainProfile}`);
  console.log(`Wallet source: ${config.walletSource}`);
  console.log(`Last local activity: ${state.lastRunAt ?? "n/a"}`);

  if (!config.walletPrivateKey) {
    console.log("Wallet is not configured yet.");
    return;
  }

  const rpcUrl = await resolveHealthyRpcUrl(config.rpcCandidates, config.chain.chainId);
  const contracts = buildContracts(rpcUrl, config.chain, config.walletPrivateKey);
  const nativeBalance = await contracts.provider.getBalance(contracts.wallet.address);
  const tokenBalance = await contracts.token.balanceOf(contracts.wallet.address);

  console.log(`Wallet: ${contracts.wallet.address}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Native balance: ${formatEther(nativeBalance)} ${config.chain.nativeToken.symbol}`);
  console.log(`KOIN balance: ${formatEther(tokenBalance)} KOIN`);

  const providerCount = summarizeWindow(
    Object.values(state.provider.submittedJobs).map((entry) => entry.recordedAt)
  );
  const verifierCount = summarizeWindow(
    Object.values(state.verifier.participatedJobs).map((entry) => entry.recordedAt)
  );

  console.log("Cached participation summary:");
  console.log(
    `- Provider submissions: today=${providerCount.today}, week=${providerCount.week}, all=${providerCount.all}`
  );
  console.log(
    `- Verifier participations: today=${verifierCount.today}, week=${verifierCount.week}, all=${verifierCount.all}`
  );

  const lastSubmitted = lastJobId(state.provider.submittedJobs);
  const lastVerified = lastJobId(state.verifier.participatedJobs);
  console.log(`Last provider job: ${lastSubmitted ?? "n/a"}`);
  console.log(`Last verifier job: ${lastVerified ?? "n/a"}`);
  console.log(`State file present: ${existsSync(config.statePath) ? "yes" : "no"}`);
}

function summarizeWindow(recordedAtValues: string[]): { today: number; week: number; all: number } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  let today = 0;
  let week = 0;
  for (const value of recordedAtValues) {
    const delta = now - new Date(value).getTime();
    if (delta <= dayMs) {
      today += 1;
    }
    if (delta <= weekMs) {
      week += 1;
    }
  }

  return {
    today,
    week,
    all: recordedAtValues.length
  };
}

function lastJobId(records: Record<string, unknown>): string | null {
  const keys = Object.keys(records).sort((left, right) => Number(right) - Number(left));
  return keys[0] ?? null;
}

void main();
