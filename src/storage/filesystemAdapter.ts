import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DiscoveryAdapter } from "./adapter.js";
import { isHttpRoot } from "./adapter.js";

export class FilesystemAdapter implements DiscoveryAdapter {
  readonly name = "filesystem";

  canHandle(root: string): boolean {
    return !isHttpRoot(root);
  }

  async readJson<T>(root: string, pathParts: string[]): Promise<T | null> {
    try {
      return JSON.parse(readFileSync(resolve(root, ...pathParts), "utf8")) as T;
    } catch {
      return null;
    }
  }

  async writeJson<T>(root: string, pathParts: string[], value: T): Promise<string> {
    const targetPath = resolve(root, ...pathParts);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return targetPath;
  }
}
