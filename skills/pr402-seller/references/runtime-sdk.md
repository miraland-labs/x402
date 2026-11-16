# Runtime: X402SellerSDK and paid route gates

Starters implement the same architecture in Rust, TypeScript, and Python.

## SDK responsibilities

At **`sdk.start()`**:

1. `GET /api/v1/facilitator/capabilities` — resolve feature flags and endpoints
2. `POST /api/v1/facilitator/payment-required/enrich` — fetch fully enriched challenge template
3. Cache template in memory; refresh on a ~10-minute interval

At **each paid request**:

1. If **`PAYMENT-SIGNATURE`** absent → return **HTTP 402** with enriched `PaymentRequired` JSON (and optionally `PAYMENT-REQUIRED` header)
2. Decode proof as base64 JSON; accept raw JSON only as a compatibility fallback
3. `POST /settle` directly — it verifies immediately before broadcast and confirmation
4. Deliver only when the response is HTTP 200 with **`success: true`**; set **`PAYMENT-RESPONSE`** to base64 settlement JSON
5. On failure → return **402** again with the same enriched `PaymentRequired` body; never deliver after `/verify` alone

`/verify` is diagnostic only. If used while debugging, call `/settle` immediately afterward and pass your own `X-Correlation-ID` to both calls.

## No heavy blockchain deps in the web server

The HTTP app does **not** need `@solana/web3.js`, `solders`, etc. for the happy path. PDA resolution and tx validation happen at the facilitator.

The language snippets below show application structure. Inspect the checked-out facilitator client before use: any helper named `verify_and_settle` / `verifyAndSettle` must be changed to call `/settle` directly.

## TypeScript (Express) pattern

From [x402-seller-starter/typescript](https://github.com/miraland-labs/x402-seller-starter/tree/main/typescript):

```typescript
import { X402SellerSDK, x402Middleware } from "./payment-required.js";

const sdk = new X402SellerSDK({
  facilitatorUrl: process.env.FACILITATOR_BASE_URL!,
  sellerWallet: process.env.MERCHANT_WALLET!,
  publicBaseUrl: process.env.SELLER_PUBLIC_BASE_URL!,
  amount: "50000",
});
await sdk.start();

app.get("/api/premium", x402Middleware(sdk), (req, res) => {
  res.json({ message: "paid content", settlement: (req as any).payment });
});
```

## Rust (Axum) pattern

From [x402-seller-starter/rust](https://github.com/miraland-labs/x402-seller-starter/tree/main/rust):

- `X402SellerSDK::new(facilitator, wallet, public_base, amount, …)`
- `sdk.start().await?`
- Handler: `extract_payment_header_value` → `parse_payment_header` → direct facilitator `/settle` → `encode_payment_response`

## Python (FastAPI) pattern

From [x402-seller-starter/python](https://github.com/miraland-labs/x402-seller-starter/tree/main/python):

- `X402SellerSDK(...)` + `register_x402_exception_handler(app)`
- `Depends(x402_payment_gate(sdk))` on paid routes

## Enrich vs hand-built 402

**Prefer enrich.** Sellers post a naive draft (wallet + amount + resource URL); facilitator returns institutional `accepts[]` with correct vault PDAs and `extra` metadata.

Manual 402 construction is error-prone — mismatched `payTo` is the #1 verify failure for new sellers.

## Settle error handling

| Status / code | Seller action |
| --- | --- |
| `400 PAYMENT_INVALID` | Return 402; require a corrected proof |
| `400 BLOCKHASH_EXPIRED` | Return 402; buyer must rebuild and re-sign |
| `502 FACILITATOR_UPSTREAM` | Do not deliver; retry `/settle` with backoff or return 402 |

`/settle` is idempotent, so retrying after an ambiguous transport or upstream failure is safe.

## Multi-route pricing

Each paid path needs its own enriched template keyed by resource URL. The SDK cache is per `(seller, path, amount)` — add routes by calling enrich with distinct URLs or extend the starter pattern.

## Testing locally

```bash
curl -sS http://127.0.0.1:3000/api/free          # 200, no payment
curl -i  http://127.0.0.1:3000/api/premium      # 402, PaymentRequired body
# Pay with buyer starter or pr402-buy CLI, then retry with PAYMENT-SIGNATURE
```

## CORS note

Browser-based buyers need `Access-Control-Expose-Headers` for `PAYMENT-RESPONSE` on the seller origin. pr402-compliant starters set this when applicable.
