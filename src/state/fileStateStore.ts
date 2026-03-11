import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { NetworkHealthStatus, StoredNodeState } from "../types.js";

const DEFAULT_STATE: StoredNodeState = {
  provider: {
    submittedJobs: {}
  },
  verifier: {
    participatedJobs: {}
  },
  networkHealth: {}
};

export class FileStateStore {
  private state: StoredNodeState;

  constructor(private readonly path: string) {
    this.state = this.load();
  }

  hasSubmitted(jobKey: string): boolean {
    return Boolean(this.state.provider.submittedJobs[jobKey]);
  }

  markSubmitted(
    jobKey: string,
    entry: { networkKey: string; txHash: string; responseHash: string; recordedAt: string }
  ): void {
    this.state.provider.submittedJobs[jobKey] = entry;
    this.state.lastRunAt = new Date().toISOString();
    this.save();
  }

  hasParticipated(jobKey: string): boolean {
    return Boolean(this.state.verifier.participatedJobs[jobKey]);
  }

  markParticipated(
    jobKey: string,
    entry: { networkKey: string; action: string; txHash: string; recordedAt: string }
  ): void {
    this.state.verifier.participatedJobs[jobKey] = entry;
    this.state.lastRunAt = new Date().toISOString();
    this.save();
  }

  updateNetworkHealth(
    networkKey: string,
    entry: {
      status: NetworkHealthStatus;
      selectedRpcUrl?: string;
      lastCheckedAt: string;
      lastError?: string;
    }
  ): void {
    this.state.networkHealth[networkKey] = entry;
    this.state.lastRunAt = new Date().toISOString();
    this.save();
  }

  getState(): StoredNodeState {
    return structuredClone(this.state);
  }

  touch(): void {
    this.state.lastRunAt = new Date().toISOString();
    this.save();
  }

  private load(): StoredNodeState {
    if (!existsSync(this.path)) {
      return structuredClone(DEFAULT_STATE);
    }

    const loaded = JSON.parse(readFileSync(this.path, "utf8")) as Partial<StoredNodeState>;
    return {
      provider: {
        submittedJobs: loaded.provider?.submittedJobs ?? {}
      },
      verifier: {
        participatedJobs: loaded.verifier?.participatedJobs ?? {}
      },
      networkHealth: loaded.networkHealth ?? {},
      lastRunAt: loaded.lastRunAt
    };
  }

  private save(): void {
    const targetPath = resolve(this.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
  }
}
