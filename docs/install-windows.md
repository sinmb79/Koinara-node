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

For a normal first-time install, you do not need to customize:

- manifest root
- artifact root
- polling interval
- wallet path

The wizard now keeps those on safe defaults unless you explicitly choose to customize them.

During setup, you will generate or fill:

- `node.config.json`
- `.env.local`

The setup wizard now uses interactive menus.

- move with `Up` / `Down`
- press `Enter` to choose one option
- on multi-select screens, press `Space` to toggle and `Enter` to confirm

That makes the first run easier and prevents typos like `mainet`.

For most first-time operators:

- choose `OpenClaw agent` if you want Koinara to use OpenClaw on this same computer
- choose `local LLM (Ollama)` if you want Koinara to use Ollama on this same computer
- after you choose one, setup applies the normal default local settings automatically
- if you choose `OpenClaw agent`, setup also tries to install the bundled Koinara OpenClaw skill automatically
- if OpenClaw is installed normally, the default command `openclaw.cmd` is usually correct in Windows PowerShell
- if Ollama is installed normally, the default URL `http://127.0.0.1:11434` is usually correct

You will also be asked for:

- `Role`
- `Network selection mode (priority-failover/all-healthy)`
- `Enabled networks`
- `Provider inference source` when you choose `provider` or `both`

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
- when provider mode is enabled, choose either `OpenClaw agent` or `local LLM (Ollama)`

If you choose `OpenClaw agent` during setup:

- Koinara uses the normal default CLI command `openclaw.cmd` in Windows PowerShell
- the default agent id is `main`
- the default mode is local execution on the current machine
- setup runs a quick OpenClaw connection check before it saves the config
- setup also tries to install the bundled OpenClaw skill before finishing

What that OpenClaw check result means:

- `ready`
  - the `openclaw.cmd` command was found on this computer
  - the local OpenClaw agent answered
  - Koinara can save a working OpenClaw-backed provider config
- `not ready (spawn openclaw ENOENT)`
  - Koinara saved the config
  - the bundled OpenClaw skill may already be installed
  - but this computer still cannot launch the `openclaw.cmd` command
  - in other words, the skill exists but the OpenClaw CLI is not ready on this PC yet

Manual OpenClaw check command:

```powershell
openclaw.cmd agent --agent main --local --json --thinking low --timeout 120 --message "Reply with exactly OK"
```

If you choose `local LLM (Ollama)` during setup:

- Koinara uses the normal default base URL `http://127.0.0.1:11434`
- the default local model is `llama3.1`
- setup runs a quick Ollama connection check before it saves the config

If only one network is enabled, both modes behave almost the same in practice.

If you run provider and verifier separately on one machine, later create:

- `.env.provider.local`
- `.env.verifier.local`

and use different `NODE_STATE_DIR` values.

## Step 3. Run doctor, then start the role

If you chose `OpenClaw agent`, run these in order:

```powershell
openclaw.cmd --help
openclaw.cmd agent --agent main --local --json --thinking low --timeout 120 --message "Reply with exactly OK"
npm.cmd run provider:v2:openclaw:check
npm.cmd run provider:v2:openclaw:start
```

What each command is for:

- `openclaw.cmd --help`
  - confirms that this computer can launch the OpenClaw CLI
- `openclaw.cmd agent ...`
  - confirms that the local OpenClaw agent actually answers
- `npm.cmd run provider:v2:openclaw:check`
  - confirms Koinara-node config, epoch, next epoch close, recent jobs, and claimable rewards
- `npm.cmd run provider:v2:openclaw:start`
  - starts the live provider runtime

If you chose `local LLM (Ollama)`, use:

```powershell
npm.cmd run provider:v2:doctor
npm.cmd run provider:v2:status
npm.cmd run provider:v2:start
```

For a plain verifier:

```powershell
npm.cmd run verifier:v2:doctor
npm.cmd run verifier:v2:status
npm.cmd run verifier:v2:start
```

![Step 3](./assets/install-step3.svg)

If you run both roles on the same machine:

- use separate PowerShell windows
- use separate env files
- use separate state directories

What success looks like after start:

- provider window shows repeating runtime passes
- when a job is accepted, provider logs lines such as:
  - `worldland: provider submitted response for job <jobId> (<responseHash>)`
- verifier logs lines such as:
  - `worldland: verifier approved job <jobId>`
  - `worldland: verifier finalized PoI for job <jobId>`
- status or check commands show the current epoch and next epoch close time

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

Why claim is delayed:

- Koinara v2 does not mint rewards immediately when you install or when a job finishes
- active rewards and work rewards are calculated inside the current epoch
- actual minting happens only after that epoch closes and you run a claim command

So the normal flow is:

1. install and save config
2. connect and run the node
3. process jobs or stay active on-chain
4. wait for the epoch to close
5. run `claim`

## If you want OpenClaw

OpenClaw is supported as a built-in provider backend.

Use these docs next:

- [OpenClaw setup guide](./openclaw-setup.md)
- [OpenClaw integration overview](./openclaw-integration.md)

If you want to install the bundled OpenClaw skill package globally:

```powershell
cd $env:USERPROFILE\koinara-node
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

### Setup ended, but OpenClaw still says `not ready`

This is the most common first-time confusion.

It means:

- setup saved `node.config.json` and `.env.local`
- the bundled OpenClaw skill may have been copied into `~/.openclaw/skills/koinara-node`
- but this computer still cannot launch the `openclaw.cmd` command

Run these next:

```powershell
cd $env:USERPROFILE\koinara-node
openclaw.cmd --help
openclaw.cmd agent --agent main --local --json --thinking low --timeout 120 --message "Reply with exactly OK"
npm.cmd run provider:v2:openclaw:check
```

If `openclaw.cmd --help` fails, fix OpenClaw installation or shell path first.
If `openclaw.cmd --help` works but `openclaw.cmd agent ...` fails, fix the local OpenClaw agent first.
If both succeed, `provider:v2:openclaw:check` should become the human-readable Koinara connection snapshot.

If you are sitting in `C:\Windows\System32`, change directory first.
The repo scripts and config files are expected under:

```text
C:\Users\<current-user>\koinara-node
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
