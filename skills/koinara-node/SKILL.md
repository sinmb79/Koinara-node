---
name: koinara-node
description: Run Koinara-node with OpenClaw as the local provider backend and manage setup, doctor, start, and claim flows.
metadata:
  openclaw:
    user-invocable: true
    homepage: https://koinara.xyz/openclaw/setup/
    requires:
      bins: ["node", "npm", "openclaw"]
---

# Koinara-node for OpenClaw

Use this skill when the operator wants to connect OpenClaw to Koinara as a real provider runtime.

## What this skill is for

- verifying that the local `openclaw` CLI works
- configuring `Koinara-node` to use `provider.backend = "openclaw"`
- running the Worldland v2 provider path
- claiming rewards after the current epoch closes

## Windows defaults

- Preferred repository path: `C:\Users\<user>\koinara-node`
- Preferred runtime path: `C:\Users\<user>\.koinara-node`
- In PowerShell, prefer `npm.cmd` over `npm`

## Required local files

- `node.config.v2-openclaw-mainnet.json`
- `.env.provider.local`
- optionally `.env.verifier.local`

Do not commit wallet keys or RPC secrets.

## Step 1. Verify OpenClaw locally

Run:

```bash
openclaw agent --agent main --local --json --message "Reply with exactly OK"
```

If this fails, stop and fix OpenClaw first.

## Step 2. Verify the Koinara OpenClaw path

From the repo root, run:

```bash
npm run provider:v2:openclaw:doctor
```

On Windows PowerShell, use:

```powershell
npm.cmd run provider:v2:openclaw:doctor
```

## Step 3. Start the provider runtime

```bash
npm run provider:v2:openclaw:start
```

Windows PowerShell:

```powershell
npm.cmd run provider:v2:openclaw:start
```

This keeps:

- node registration
- heartbeat
- job polling
- OpenClaw-backed provider inference
- on-chain submission

## Step 4. Claim after epoch close

```bash
npm run provider:v2:openclaw:claim
```

Windows PowerShell:

```powershell
npm.cmd run provider:v2:openclaw:claim
```

## Verifier path

If the operator also runs a verifier:

```bash
npm run verifier:v2:doctor
npm run verifier:v2:start
npm run verifier:v2:claim
```

Windows PowerShell:

```powershell
npm.cmd run verifier:v2:doctor
npm.cmd run verifier:v2:start
npm.cmd run verifier:v2:claim
```

## Important rule

OpenClaw is the inference and agent layer.
`Koinara-node` remains the protocol execution boundary.

Without `Koinara-node`, OpenClaw alone does not:

- register the node
- send heartbeat
- submit provider hashes
- verify or finalize jobs
- claim active or work rewards
