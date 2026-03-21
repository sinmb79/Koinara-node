import type { FileNodeConfig, NetworkProfileName } from "../types.js";

type RuntimeRole = "provider" | "verifier";

export interface RuntimeCommandContext {
  role: RuntimeRole;
  config: Pick<FileNodeConfig, "networkProfile" | "provider">;
  stateDirHint?: string;
  networkProfileHint?: NetworkProfileName;
}

export interface RuntimeCommands {
  doctor: string;
  check?: string;
  status: string;
  start: string;
  claim: string;
}

export function resolveRuntimeCommands(context: RuntimeCommandContext): RuntimeCommands {
  const backend = context.config.provider?.backend;
  const profile = context.networkProfileHint ?? context.config.networkProfile;
  const stateDirHint = normalize(context.stateDirHint);
  const isOpenClaw = backend === "openclaw";
  const isBaseMainnet = stateDirHint.includes("base-mainnet");
  const isTestnet = profile === "testnet" || stateDirHint.includes("testnet");

  if (context.role === "provider") {
    if (isOpenClaw && isBaseMainnet) {
      return {
        doctor: "provider:v2:openclaw:base:doctor",
        check: "provider:v2:openclaw:base:check",
        status: "provider:v2:openclaw:base:status",
        start: "provider:v2:openclaw:base:start",
        claim: "provider:v2:openclaw:base:claim"
      };
    }

    if (isOpenClaw && isTestnet) {
      return {
        doctor: "provider:v2:openclaw:testnet:doctor",
        check: "provider:v2:openclaw:testnet:check",
        status: "provider:v2:openclaw:testnet:status",
        start: "provider:v2:openclaw:testnet:start",
        claim: "provider:v2:openclaw:testnet:claim"
      };
    }

    if (isOpenClaw) {
      return {
        doctor: "provider:v2:openclaw:doctor",
        check: "provider:v2:openclaw:check",
        status: "provider:v2:openclaw:status",
        start: "provider:v2:openclaw:start",
        claim: "provider:v2:openclaw:claim"
      };
    }

    return {
      doctor: "provider:v2:doctor",
      check: undefined,
      status: "provider:v2:status",
      start: "provider:v2:start",
      claim: "provider:v2:claim"
    };
  }

  if (isOpenClaw && isBaseMainnet) {
    return {
      doctor: "verifier:v2:base:doctor",
      status: "verifier:v2:base:status",
      start: "verifier:v2:base:start",
      claim: "verifier:v2:base:claim"
    };
  }

  if (isOpenClaw && isTestnet) {
    return {
      doctor: "verifier:v2:openclaw:testnet:doctor",
      check: "verifier:v2:openclaw:testnet:check",
      status: "verifier:v2:openclaw:testnet:status",
      start: "verifier:v2:openclaw:testnet:start",
      claim: "verifier:v2:openclaw:testnet:claim"
    };
  }

  if (isOpenClaw) {
    return {
      doctor: "verifier:v2:openclaw:doctor",
      check: "verifier:v2:openclaw:check",
      status: "verifier:v2:openclaw:status",
      start: "verifier:v2:openclaw:start",
      claim: "verifier:v2:openclaw:claim"
    };
  }

  if (isTestnet) {
    return {
      doctor: "verifier:v2:testnet:doctor",
      check: undefined,
      status: "verifier:v2:testnet:status",
      start: "verifier:v2:testnet:start",
      claim: "verifier:v2:testnet:claim"
    };
  }

  return {
    doctor: "verifier:v2:doctor",
    check: undefined,
    status: "verifier:v2:status",
    start: "verifier:v2:start",
    claim: "verifier:v2:claim"
  };
}

function normalize(value: string | undefined): string {
  return (value ?? "").replaceAll("/", "\\").toLowerCase();
}
