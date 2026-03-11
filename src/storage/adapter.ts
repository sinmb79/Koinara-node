export interface DiscoveryAdapter {
  readonly name: string;
  canHandle(root: string): boolean;
  readJson<T>(root: string, pathParts: string[]): Promise<T | null>;
  writeJson?<T>(root: string, pathParts: string[], value: T): Promise<string>;
}

export function isHttpRoot(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
