# Exact payment flow (buyer)

Step-by-step protocol under `@pr402/client`, MCP, and hand-rolled implementations.

## 1. Discover facilitator capabilities

```bash
BASE="https://ipay.sh"
curl -sS "$BASE/api/v1/facilitator/capabilities" | jq .
curl -sS "$BASE/api/v1/facilitator/supported" | jq .
```

Devnet: set `BASE="https://preview.ipay.sh"`.

Confirm `features.unsignedExactPaymentTxBuild` (or equivalent) before relying on build endpoint.

## 2. Receive 402 from seller

Save:

- Full `paymentRequirements` / `PaymentRequired` object
- The chosen **`accepts[]`** entry (scheme, network, asset, amount, payTo, extra)

Header names (x402 v2):

| Header | Content |
| --- | --- |
| `PAYMENT-REQUIRED` | Base64-encoded PaymentRequired JSON |

Some sellers return JSON body only; both patterns exist in the wild.

## 3. Build unsigned transaction

Before sending a signing request, require the facilitator origin to be official or explicitly trusted, and reject `accepted.amount` above the buyer's atomic-unit spend ceiling.

```http
POST /api/v1/facilitator/build-exact-payment-tx
Content-Type: application/json

{
  "payer": "<buyer_pubkey>",
  "accepted": { ... one accepts[] line, scheme: "exact" ... },
  "resource": "<canonical resource URL>"
}
```

Optional: `skipSourceBalanceCheck`, `autoWrapSol` — see OpenAPI.

**Scheme rule:** if the 402 line says `v2:solana:exact`, normalize to **`exact`** in this request. pr402 accepts aliases on build but `verifyBodyTemplate` uses wire `exact`.

Response (camelCase JSON):

- `transaction` — base64 bincode unsigned `VersionedTransaction`
- `verifyBodyTemplate` — ready-made body for verify/settle
- `payerSignatureIndex` — which signer slot the payer must sign
- `notes[]` — signing order hints

## 4. Sign locally

1. Base64-decode `transaction` → bincode → `VersionedTransaction`
2. Confirm `payerSignatureIndex` is a required signer slot whose static account key equals the buyer pubkey
3. Sign with the payer keypair and re-encode the signed tx to base64
4. Confirm the build template preserved `scheme`, `network`, `asset`, `amount`, and `payTo`
5. Replace `verifyBodyTemplate.paymentPayload.payload.transaction` with the signed value; change nothing else

Do **not** add address lookup tables — pr402 rejects ALT-loaded txs today.

## 5. Call seller with proof (default — starter/SDK path)

Retry the original HTTP request with header:

```http
PAYMENT-SIGNATURE: <base64(UTF-8 JSON verifyBodyTemplate)>
```

Raw JSON remains accepted for compatibility, but new clients should emit base64.

This matches `@pr402/client` (`pr402-buy`, `X402AgentClient.fetchWithAutoPay`) and MCP: the buyer sends proof; the **seller** runs facilitator settlement.

## 6. Seller settlement and response

On `PAYMENT-SIGNATURE`, the seller SDK (or gate) calls facilitator `/settle` directly. `/settle` verifies immediately before broadcast. The seller returns the protected resource only after HTTP 200 with `success: true`.

On success, inspect:

```http
PAYMENT-RESPONSE: <base64 JSON>
```

Fields typically include `success`, `transaction` (signature), `network`, `payer`.

## Seller-side vs buyer-side settle

| Pattern | Who settles | When to use |
| --- | --- | --- |
| **SDK / CLI / MCP** (`pr402-buy`, MCP) | Buyer builds proof; **seller** calls `/settle` on `PAYMENT-SIGNATURE` | **Default** for HTTP 402 APIs |
| **Manual buyer settlement** | Buyer calls `/settle` before seller retry | Debugging, custom flows without seller gate |

Default to the SDK/MCP path unless the user explicitly hand-rolls buyer-side settlement.

## Advanced: direct buyer settlement

Use only when **not** relying on seller-side settlement (manual curl or facilitator debugging; not `pr402-buy` / MCP default):

```bash
curl -sS -X POST "$BASE/api/v1/facilitator/settle" \
  -H "X-Correlation-ID: <your-audit-id>" \
  -H "Content-Type: application/json" -d @verify-body.json
```

`/settle` is idempotent — safe to retry if the tx already landed on-chain.

`/verify` is diagnostic only. If used, never deliver on its result; call `/settle` immediately with the same proof and correlation id.

If the seller still requires a proof header after direct settle, retry the resource with `PAYMENT-SIGNATURE` as in step 5.

## Failure recovery

| Error | Action |
| --- | --- |
| `400 BLOCKHASH_EXPIRED` | Re-run build-exact-payment-tx, re-sign |
| `400 PAYMENT_INVALID` | Correct the proof or seller payment terms |
| `502 FACILITATOR_UPSTREAM` | Retry with backoff; settle is idempotent |
| "not supported … Approved assets" | Pick allowlisted `asset` or different seller rail |
| Recipient / payTo mismatch | Seller's `accepts[]` wrong — not a buyer wallet bug |
| HTTP 200 + `{ "error": "..." }` | Treat as failure defensively (starter convention, not facilitator contract) |

## sla-escrow branch

Use `POST /build-sla-escrow-payment-tx` instead — requires `slaHash`, `oracleAuthority`, etc. Trust template `payTo` over stale 402 line. See oracles workspace protocol doc.

## Discover sellers without prior 402

```
GET /api/v1/facilitator/providers?limit=20
GET /api/v1/facilitator/resources?q=<tag>
```

Build `accepts[]` from directory metadata, then continue at step 3.
