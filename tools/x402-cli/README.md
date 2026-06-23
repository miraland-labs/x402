# x402-cli: Unified Developer CLI Tool for Onboarding & Discovery

`x402-cli` is a zero-dependency developer command-line tool built using Node.js / ESM to guide sellers through the entire x402 integration lifecycle.

## Why use this tool?
1. **No blockchain setup required**: It uses Node's native `crypto` module to parse Solana keypair JSONs, derive public keys, and calculate Ed25519 signatures, meaning you don't need to compile heavy Solana SDK packages on your system.
2. **Unified Entrance**: Instantly inspect, provision, and register your merchant wallet off-chain on the facilitator directory.
3. **Directory Discovery**: Automatically enroll and index your API endpoints so buyers and agents can search for them.

---

## Installation & Setup

1. **Build the CLI**:
   ```bash
   cd tools/x402-cli
   npm install
   npm run build
   ```
2. **Link or Run directly**:
   ```bash
   node dist/index.js --help
   ```

---

## Commands Reference

### 1. `status`
Inspect the onboarding lifecycle status of a wallet address or keypair.
```bash
node dist/index.js status --wallet <address>
# OR
node dist/index.js status --keypair <path_to_keypair.json>
```
*Outcome*: Displays whether the wallet is Derived, On-chain Activated, or off-chain Registered, along with the derived vaults and banks.

### 2. `activate`
Request the base64 transaction string to provision your SplitVault on-chain.
```bash
node dist/index.js activate --wallet <address> [--asset USDC|SOL|mint]
```
*Outcome*: Generates the base64 bincode transaction that you can sign and submit to activate your vault on-chain.

### 3. `register`
Register your merchant wallet in the off-chain discovery directory.
```bash
node dist/index.js register --keypair <path_to_keypair.json> \
  --url <shop_homepage_url> \
  --display-name "My API Shop" \
  --description "Furious machine-to-machine APIs" \
  --tags "data,compute"
```
*Outcome*: Requests an challenge from the facilitator, computes an Ed25519 signature, and binds your metadata.

### 4. `enrich`
Test the `enrich` pipeline by converting a basic 402 draft into a fully populated PaymentRequired document.
```bash
node dist/index.js enrich --wallet <address> --amount 50000 --url http://your-api.com/premium
```

### 5. `enroll`
Publish your API endpoints from an `x402-resources.json` SRM manifest to the public facilitator index.
```bash
node dist/index.js enroll --manifest <path_to_manifest.json> --keypair <path_to_keypair.json>
```
*Options*:
- `--no-listing`: Register the resource but skip opting in to the public directory index.
- `--no-probe`: Skip the verification probe (useful for offline testing).

---

## Options
- `--facilitator <url>`: Override the facilitator endpoint (Default: `https://preview.ipay.sh/api/v1/facilitator`).
- `--wallet <address>`: Target wallet address.
- `--keypair <path>`: Path to a Solana filesystem JSON keypair.
