import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { StoredNodeState } from "../types.js";

const DEFAULT_STATE: StoredNodeState = {
  provider: {
    submittedJobs: {}
  },
  verifier: {
    participatedJobs: {}
  }
};

export class FileStateStore {
  private state: StoredNodeState;

  constructor(private readonly path: string) {
    this.state = this.load();
  }

  hasSubmitted(jobId: number): boolean {
    return Boolean(this.state.provider.submittedJobs[String(jobId)]);
  }

  markSubmitted(
    jobId: number,
    entry: { txHash: string; responseHash: string; recordedAt: string }
  ): void {
    this.state.provider.submittedJobs[String(jobId)] = entry;
    this.state.lastRunAt = new Date().toISOString();
    this.save();
  }

  hasParticipated(jobId: number): boolean {
    return Boolean(this.state.verifier.participatedJobs[String(jobId)]);
  }

  markParticipated(
    jobId: number,
    entry: { action: string; txHash: string; recordedAt: string }
  ): void {
    this.state.verifier.participatedJobs[String(jobId)] = entry;
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

    return JSON.parse(readFileSync(this.path, "utf8")) as StoredNodeState;
  }

  private save(): void {
    const targetPath = resolve(this.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
  }
}
