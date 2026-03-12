# Install Koinara-node on Windows

This is the first-time Windows guide for a normal operator.

The flow is now split into two parts:

1. install and set up the Koinara node
2. connect one inference source afterward
   - `OpenClaw`
   - `local LLM (Ollama)`

That means setup no longer tries to finish OpenClaw inside the same wizard.

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

If you want a one-command bootstrap for the node repo only:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-windows.ps1
```

## Step 2. Run setup for the base node config

Run:

```powershell
npm.cmd run setup
```

![Step 2](./assets/install-step2.svg)

This setup now does only the base node work:

- role
- network profile
- network selection mode
- enabled networks
- runtime folder defaults
- wallet now or later

It does **not** connect OpenClaw or Ollama inside the wizard anymore.

The current defaults place runtime files under your home folder:

- shared manifest root: `%USERPROFILE%\.koinara-node\network`
- artifact root: `%USERPROFILE%\.koinara-node\artifacts`
- state root: `%USERPROFILE%\.koinara-node\state`

The setup wizard uses interactive menus:

- `Up` / `Down` to move
- `Enter` to choose one option
- `Space` to toggle on multi-select screens

For a normal first-time Worldland operator, the common choices are:

- role: `both`
- network profile: `mainnet`
- network selection mode: `priority-failover`
- enabled networks: `worldland`

Setup writes:

- `node.config.json`
- `.env.local`

If you skipped the wallet, that is fine.
You can add `WALLET_PRIVATE_KEY` or `WALLET_KEYFILE` later before starting the node.

## Step 3. Connect exactly one inference source

After setup, choose **one** provider path.

### Option A. Connect OpenClaw in one step

```powershell
npm.cmd run openclaw:connect
```

What this does:

- updates the node config for an OpenClaw-backed provider
- writes the v2 runtime config files
- installs the bundled Koinara OpenClaw skill
- checks the OpenClaw CLI
- checks that the local `main` agent replies

If this succeeds, the next commands are:

```powershell
npm.cmd run provider:v2:openclaw:check
npm.cmd run provider:v2:openclaw:start
```

### Option B. Connect a local LLM (Ollama) in one step

```powershell
npm.cmd run ollama:connect
```

What this does:

- updates the node config for an Ollama-backed provider
- writes the v2 runtime config file
- checks `http://127.0.0.1:11434`
- checks whether model `llama3.1` is available

If this succeeds, the next commands are:

```powershell
npm.cmd run provider:v2:status
npm.cmd run provider:v2:start
```

## Step 4. Check and start

If you chose OpenClaw:

```powershell
npm.cmd run provider:v2:openclaw:check
npm.cmd run provider:v2:openclaw:start
```

If you chose Ollama:

```powershell
npm.cmd run provider:v2:status
npm.cmd run provider:v2:start
```

If you also run a verifier, use a second PowerShell window:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run verifier:v2:status
npm.cmd run verifier:v2:start
```

![Step 3](./assets/install-step3.svg)

What success looks like:

- provider logs repeating runtime passes
- when a job is accepted, provider logs lines such as:
  - `worldland: provider submitted response for job <jobId> (<responseHash>)`
- verifier logs lines such as:
  - `worldland: verifier approved job <jobId>`
  - `worldland: verifier finalized PoI for job <jobId>`
- status and check commands show:
  - current epoch
  - next epoch close time
  - recent jobs
  - reward state

## Step 5. After reboot

You do not need to install again after a reboot.

For an OpenClaw-backed provider:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run provider:v2:openclaw:check
npm.cmd run provider:v2:openclaw:start
```

For an Ollama-backed provider:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run provider:v2:status
npm.cmd run provider:v2:start
```

For a verifier:

```powershell
cd $env:USERPROFILE\koinara-node
npm.cmd run verifier:v2:status
npm.cmd run verifier:v2:start
```

## Step 6. Claim after the current epoch closes

Koinara v2 protocol rewards are not minted immediately.

They become claimable after the current epoch closes.

If you use OpenClaw:

```powershell
npm.cmd run provider:v2:openclaw:claim
```

If you use Ollama:

```powershell
npm.cmd run provider:v2:claim
```

Verifier claim:

```powershell
npm.cmd run verifier:v2:claim
```

## Troubleshooting

### OpenClaw connect says the CLI is not ready

Run:

```powershell
openclaw.cmd --help
npm.cmd run openclaw:check
```

If the skill somehow needs a manual reinstall:

```powershell
npm.cmd run openclaw:install
```

### You are in `C:\Windows\System32`

Do not run the repo scripts from there.

Move back to the repo first:

```powershell
cd $env:USERPROFILE\koinara-node
```

### PowerShell blocks `npm`

Use:

```powershell
npm.cmd install
npm.cmd run setup
```

instead of plain `npm`.
