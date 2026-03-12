# Install Koinara-node on Windows

This is the detailed Windows installation guide for a first-time Koinara operator.

It uses:

- a user-owned repo path
- `npm.cmd` instead of `npm` in PowerShell
- the live Worldland v2 commands

If you want the short overview page, use the Koinara website. If you want the detailed operator steps, follow this document.

## Step 1. Clone into your user folder

Open a fresh PowerShell window and run:

```powershell
cd $env:USERPROFILE
git clone https://github.com/sinmb79/Koinara-node.git koinara-node
cd $env:USERPROFILE\koinara-node
npm.cmd install
```

![Step 1](./assets/install-step1.svg)

Why this path:

- it avoids mixing the repo with `Desktop`
- it avoids running from `system32`
- it keeps the repo under `C:\Users\<current-user>\koinara-node`

Why `npm.cmd`:

- Windows PowerShell often blocks `npm.ps1`
- `npm.cmd` avoids the execution-policy error

If you still want a one-command bootstrap:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-windows.ps1
```

## Step 2. Run setup and keep the default runtime paths

Run:

```powershell
npm.cmd run setup
```

![Step 2](./assets/install-step2.svg)

The current defaults place runtime files under your home folder:

- shared manifest root: `%USERPROFILE%\.koinara-node\network`
- artifact root: `%USERPROFILE%\.koinara-node\artifacts`
- state root: `%USERPROFILE%\.koinara-node\state`

This means the runtime does not depend on where the repo was cloned.

During setup, you will generate or fill:

- `node.config.json`
- `.env.local`

The setup wizard now shows numbered menus, so you can choose by number instead of typing every value.
That makes the first run easier and prevents typos like `mainet`.

You will also be asked for:

- `Role`
- `Network selection mode (priority-failover/all-healthy)`
- `Enabled networks`
- `Provider backend` when you choose `provider` or `both`

What it means:

- `priority-failover`
  - use one chain at a time
  - the node picks the highest-priority healthy enabled network
  - if that chain becomes unhealthy, the node fails over to the next healthy one
- `all-healthy`
  - use every healthy enabled network at the same time
  - the node can process jobs across all healthy enabled EVM chains

Recommended choice for most first-time operators:

- if you only want to run on Worldland mainnet, choose `priority-failover`
- if you explicitly want one node runtime to participate across multiple healthy EVM networks, choose `all-healthy`
- if you want Koinara to use an OpenClaw agent, choose `openclaw` for the provider backend

If only one network is enabled, both modes behave almost the same in practice.

If you run provider and verifier separately on one machine, later create:

- `.env.provider.local`
- `.env.verifier.local`

and use different `NODE_STATE_DIR` values.

## Step 3. Run doctor, then start the role

For a provider:

```powershell
npm.cmd run provider:v2:doctor
npm.cmd run provider:v2:start
```

For a verifier:

```powershell
npm.cmd run verifier:v2:doctor
npm.cmd run verifier:v2:start
```

![Step 3](./assets/install-step3.svg)

If you run both roles on the same machine:

- use separate PowerShell windows
- use separate env files
- use separate state directories

## Step 4. Claim after the current epoch closes

Koinara v2 protocol rewards are not minted immediately.

They become claimable after the current epoch closes.

When the epoch is closed, run:

```powershell
npm.cmd run provider:v2:claim
npm.cmd run verifier:v2:claim
```

Then verify:

```powershell
npm.cmd run provider:v2:status
npm.cmd run verifier:v2:status
```

## If you want OpenClaw

OpenClaw is supported as a built-in provider backend.

Use these docs next:

- [OpenClaw setup guide](./openclaw-setup.md)
- [OpenClaw integration overview](./openclaw-integration.md)

If you want to install the bundled OpenClaw skill package globally:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-openclaw-skill.ps1
```

## Common Windows mistakes

### `npm.ps1` execution-policy error

Use:

```powershell
npm.cmd install
```

instead of:

```powershell
npm install
```

### Wrong working directory

Do not run the node from:

- `C:\Windows\System32`
- `Desktop`

Use:

```powershell
cd $env:USERPROFILE\koinara-node
```

### Repo cloned to the wrong location

The recommended repo path is:

```text
C:\Users\<current-user>\koinara-node
```

## Related docs

- [Generic node setup](./node-setup.md)
- [Operator checklist](./operator-checklist.md)
- [Supported networks](./supported-networks.md)
- [Protocol compatibility](./protocol-compatibility.md)
