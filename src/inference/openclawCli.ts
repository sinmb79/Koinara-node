import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

export const defaultOpenClawCommand =
  process.platform === "win32" ? "openclaw.cmd" : "openclaw";

export function resolveOpenClawInvocation(requestedCommand?: string): {
  command: string;
  prefixArgs: string[];
  shell: boolean;
} {
  const command = requestedCommand?.trim() || defaultOpenClawCommand;

  if (process.platform !== "win32") {
    return {
      command,
      prefixArgs: [],
      shell: false
    };
  }

  const normalized = basename(command).toLowerCase();
  if (normalized === "openclaw" || normalized === "openclaw.cmd" || normalized === "openclaw.ps1") {
    const candidates = [
      process.env.OPENCLAW_MJS?.trim(),
      process.env.APPDATA
        ? resolve(process.env.APPDATA, "npm", "node_modules", "openclaw", "openclaw.mjs")
        : "",
      process.env.USERPROFILE
        ? resolve(process.env.USERPROFILE, "AppData", "Roaming", "npm", "node_modules", "openclaw", "openclaw.mjs")
        : ""
    ].filter((entry): entry is string => Boolean(entry));

    const entrypoint = candidates.find((entry) => existsSync(entry));
    if (entrypoint) {
      return {
        command: process.execPath,
        prefixArgs: [entrypoint],
        shell: false
      };
    }
  }

  return {
    command,
    prefixArgs: [],
    shell: true
  };
}
