# Home Test Quickstart

This is the shortest safe path for testing `Koinara-node` on your home computer after cloning from GitHub.

Do not put secrets into Git history. Only write them to local files that are already gitignored.

For the full manual verification list, see [docs/home-test-checklist.md](./home-test-checklist.md).

## 1. Clone and install

```bash
git clone https://github.com/sinmb79/Koinara-node.git
cd Koinara-node
npm install
```

For Windows PowerShell, prefer this version:

```powershell
git clone https://github.com/sinmb79/Koinara-node.git "$env:USERPROFILE\\koinara-node"
cd "$env:USERPROFILE\\koinara-node"
npm.cmd install
```

If you want one helper command after cloning:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-windows.ps1
```

## 2. Fill local-only settings

Edit these locally:

- `config/networks.testnet.json` or `config/networks.mainnet.json`
- or prefer `config/networks.testnet.local.json` / `config/networks.mainnet.local.json`
- `.env.local`
- `node.config.json`

If you want `provider` and `verifier` split on one computer, prefer:

- `.env.provider.local`
- `.env.verifier.local`
- separate `NODE_STATE_DIR` values for each role

Never commit:

- wallet private keys
- keyfiles
- RPC secrets
- private endpoints

## 3. Run setup

```bash
npm run setup
```

This creates:

- `.env.local`
- `node.config.json`

The setup wizard now defaults runtime files to `~/.koinara-node` instead of the cloned repository
folder.

## 4. Run preflight checks

```bash
npm run doctor
npm run status
```

For split roles, use:

```bash
npm run provider:doctor
npm run verifier:doctor
npm run provider:status
npm run verifier:status
```

Check:

- wallet address is correct
- at least one selected EVM network is healthy
- contract addresses are filled on the networks you enabled
- native balance is enough for gas
- `OPENAI_API_KEY` exists if using OpenAI

## 5. Test a single pass

```bash
npm run node:once
```

For split roles:

```bash
npm run provider:once
npm run verifier:once
```

This is the safest first runtime check.

Use it to confirm:

- config loads
- network selection works
- wallet signs
- discovery roots are reachable
- no immediate runtime errors appear

## 6. Start the live loop

```bash
npm run node
```

or:

```bash
npm run logs
```

For split roles:

```bash
npm run provider:start
npm run verifier:start
```

## 7. Watch for success

What you want to see:

- provider sends `submitResponse`
- verifier sends `verifySubmission` or `rejectSubmission`
- accepted jobs move to `Settled`
- `KOIN` arrives in the wallet

Check again with:

```bash
npm run status
```

## 8. If something fails

Check these first:

- wrong network profile
- empty contract addresses
- no healthy selected EVM network
- low native balance
- bad wallet key or keyfile path
- missing manifest or receipt files
- wrong shared discovery root

Then restart with:

```bash
npm run node
```
