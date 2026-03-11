import { JsonRpcProvider } from "ethers";

export function getRpcCandidates(rpcUrls: string[], override?: string): string[] {
  const candidates = [override, ...rpcUrls]
    .filter((entry): entry is string => Boolean(entry && entry.trim()))
    .map((entry) => entry.trim());

  return [...new Set(candidates)];
}

export async function resolveHealthyRpcUrl(
  candidates: string[],
  expectedChainId = 0
): Promise<string> {
  if (candidates.length === 0) {
    throw new Error("No RPC candidates configured");
  }

  let lastError = "No RPC candidate was tried";
  for (const rpcUrl of candidates) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, expectedChainId || undefined);
      const network = await provider.getNetwork();
      if (expectedChainId && Number(network.chainId) !== expectedChainId) {
        throw new Error(`wrong chainId ${network.chainId}`);
      }
      return rpcUrl;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`Unable to connect to any configured RPC endpoint. Last error: ${lastError}`);
}
