# Seller onboarding (CLI + REST)

Complete **before** the runtime SDK serves paid traffic.

## x402-cli

Clone the **x402 hub repo** for CLI source ([miraland-labs/x402/tools/x402-cli](https://github.com/miraland-labs/x402/tree/main/tools/x402-cli)) — the hub is not a monorepo; this CLI is one of several sibling projects documented there.

```bash
git clone https://github.com/miraland-labs/x402.git
cd x402/tools/x402-cli && npm install && npm run build
CLI="node dist/index.js"
FAC="--facilitator https://ipay.sh/api/v1/facilitator"
```

Devnet: use `--facilitator https://preview.ipay.sh/api/v1/facilitator` instead.

### 1. Status

```bash
$CLI status --keypair /path/to/seller-keypair.json $FAC
```

Shows lifecycle: derived vault, on-chain activation, off-chain registration.

### 2. Activate SplitVault

```bash
$CLI activate --wallet <PUBKEY> --asset USDC $FAC
```

Returns a base64 transaction. Sign with the seller keypair and submit to Solana. Idempotent — safe to retry.

REST equivalent: `POST /api/v1/facilitator/sellers/provision-tx` with `{ "wallet", "asset" }`.

### 3. Register merchant (optional — public directory)

```bash
$CLI register --keypair /path/to/seller-keypair.json \
  --url https://your-api.example.com \
  --display-name "My API Shop" \
  --description "Machine-to-machine APIs" \
  --tags "data,compute" \
  $FAC
```

Facilitator returns `409 Conflict` if Activate has not landed on-chain yet.

REST flow:

1. `GET /api/v1/facilitator/sellers/{wallet}/challenge?action=seller:register`
2. Sign returned `message` (Ed25519; base58 canonical, base64 accepted)
3. `POST /api/v1/facilitator/sellers/{wallet}/register`

### 4. Enroll resources (optional — searchable APIs)

Administrative challenges are one-time and action-scoped. For **each** resource:

1. Request `GET /api/v1/facilitator/resources/register/challenge?wallet={wallet}&action=resource:register`.
2. Sign the returned message and `POST /api/v1/facilitator/resources/register`.
3. If probing, request a new challenge with `action=resource:probe`, sign it, then `POST /api/v1/facilitator/resources/probe`.

Never reuse one challenge across resources or between register and probe. Older `x402-cli enroll` / `tools/enroll.mjs` implementations reuse a challenge and are incompatible with replay protection; use the REST loop above unless the checked-out tool requests a fresh action-bound challenge for every administrative call.

See [x402-resources-manifest.md](x402-resources-manifest.md).

### 5. Test enrich pipeline

```bash
$CLI enrich --wallet <PUBKEY> --amount 50000 \
  --url https://your-api.example.com/api/premium $FAC
```

Read-only — confirms the facilitator can produce a full `PaymentRequired` document.

## Seller endpoint decision matrix

| Goal | Call | Side effect |
| --- | --- | --- |
| Inspect lifecycle | `GET .../sellers/{wallet}/preview` | Read-only |
| Lookup `payTo` for one rail | `GET .../sellers/{wallet}/rails/exact` | Read-only |
| Activate vault | `POST .../sellers/provision-tx` | Returns unsigned tx |
| Enrich 402 body | `POST .../payment-required/enrich` | Read-only JSON transform |
| Registry challenge | `GET .../sellers/{wallet}/challenge?action=seller:register` | One-time message |
| Registry submit | `POST .../sellers/{wallet}/register` | DB write when configured |

## Sovereign fee tier

When the seller signs Activate with their own wallet, they qualify for the **sovereign** protocol fee tier (90 bps vs 100 bps standard). Document this for production sellers.

## Common failures

| Symptom | Fix |
| --- | --- |
| `409` on register | Broadcast Activate tx first; re-check preview `lifecycle` |
| `401` challenge already used | Request and sign a fresh challenge for the exact action |
| Build/verify "not supported … Approved assets" | Pick an allowlisted mint or change deployment config |
| Wrong `payTo` in manual 402 bodies | Use enrich endpoint or SDK cache — never paste wallet address as `payTo` |
| Resource enroll probe fails | Check origin binding and public HTTP(S) probe restrictions; redirects and private/special addresses are rejected |
