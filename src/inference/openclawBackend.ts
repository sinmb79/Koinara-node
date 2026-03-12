import { spawn } from "node:child_process";
import type { JobManifest } from "../types.js";
import type { InferenceBackend, InferenceResult } from "./inference.js";

type OpenClawPayload = {
  text?: string;
  mediaUrl?: string | null;
};

type OpenClawResponse = {
  payloads?: OpenClawPayload[];
  meta?: {
    durationMs?: number;
    agentMeta?: {
      provider?: string;
      model?: string;
    };
  };
};

const defaultOpenClawCommand = process.platform === "win32" ? "openclaw.cmd" : "openclaw";

export interface OpenClawBackendOptions {
  command?: string;
  agent?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high";
  timeoutSeconds?: number;
  local?: boolean;
  profile?: string;
}

export class OpenClawBackend implements InferenceBackend {
  readonly name = "openclaw";

  constructor(private readonly options: OpenClawBackendOptions = {}) {}

  async infer(manifest: JobManifest): Promise<InferenceResult> {
    const payload = await this.invokeAgent(manifest.body.prompt);
    const text = (payload.payloads ?? [])
      .map((entry) => entry.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");

    return {
      contentType: "application/json",
      output: {
        text
      },
      metadata: {
        backend: "openclaw",
        agent: this.options.agent ?? "main",
        provider: payload.meta?.agentMeta?.provider ?? "unknown",
        model: payload.meta?.agentMeta?.model ?? "unknown",
        durationMs: payload.meta?.durationMs ?? null
      }
    };
  }

  private invokeAgent(prompt: string): Promise<OpenClawResponse> {
    const command = this.options.command?.trim() || defaultOpenClawCommand;
    const args = ["agent", "--agent", this.options.agent?.trim() || "main", "--json"];

    if (this.options.local !== false) {
      args.push("--local");
    }

    if (this.options.profile?.trim()) {
      args.unshift(this.options.profile.trim());
      args.unshift("--profile");
    }

    if (this.options.thinking?.trim()) {
      args.push("--thinking", this.options.thinking.trim());
    }

    if (this.options.timeoutSeconds && Number.isFinite(this.options.timeoutSeconds)) {
      args.push("--timeout", String(this.options.timeoutSeconds));
    }

    args.push("--message", prompt);

    return new Promise((resolvePromise, reject) => {
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
        reject(error);
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`OpenClaw exited with ${code}: ${stderr.trim() || stdout.trim()}`));
          return;
        }

        const parsed = extractFirstJsonObject(stdout);
        if (!parsed) {
          reject(new Error(`OpenClaw returned no JSON payload: ${stdout.trim() || stderr.trim()}`));
          return;
        }

        try {
          resolvePromise(JSON.parse(parsed) as OpenClawResponse);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse OpenClaw JSON: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      });
    });
  }
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return text.slice(start, end + 1);
}
