# Home Test Quickstart

This is the shortest safe path for testing `Koinara-node` on your home computer after cloning from GitHub.

Do not put secrets into Git history. Only write them to local files that are already gitignored.

## 1. Clone and install

```bash
git clone https://github.com/sinmb79/Koinara-node.git
cd Koinara-node
npm install
```

## 2. Fill local-only settings

Edit these locally:

- `config/chain.testnet.json` or `config/chain.mainnet.json`
- `.env.local`
- `node.config.json`

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

## 4. Run preflight checks

```bash
npm run doctor
npm run status
```

Check:

- wallet address is correct
- RPC is correct
- contract addresses are filled
- native balance is enough for gas
- `OPENAI_API_KEY` exists if using OpenAI

## 5. Test a single pass

```bash
npm run node:once
```

This is the safest first runtime check.

Use it to confirm:

- config loads
- chain connection works
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

- wrong chain profile
- empty contract addresses
- low native balance
- bad wallet key or keyfile path
- missing manifest or receipt files
- wrong shared discovery root

Then restart with:

```bash
npm run node
```
