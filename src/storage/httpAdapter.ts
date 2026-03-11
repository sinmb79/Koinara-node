import type { DiscoveryAdapter } from "./adapter.js";
import { isHttpRoot } from "./adapter.js";

export class HttpAdapter implements DiscoveryAdapter {
  readonly name = "http";

  canHandle(root: string): boolean {
    return isHttpRoot(root);
  }

  async readJson<T>(root: string, pathParts: string[]): Promise<T | null> {
    try {
      const joined = `${root.replace(/\/$/, "")}/${pathParts.join("/")}`;
      const response = await fetch(joined);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }
}
