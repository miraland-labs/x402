# Subscription buyer flow

Buy **time-window access** or a **pack** on the **`exact`** rail — pay once, then send a Bearer token on later calls instead of paying each time.

Buyers talk **only to the seller**. Two seller shapes exist; tell them apart from the first 402.

| 402 body has | Seller shape | Follow |
| --- | --- | --- |
| `offers[]` and `billing` | Members seller gate (default) | [Members gate](#members-seller-gate) |
| 402 only on `POST /api/v1/subscribe` | Self-hosted JWT ([SUBSCRIPTION_PATTERN.md](https://github.com/miraland-labs/x402/blob/main/SUBSCRIPTION_PATTERN.md)) | [Self-hosted](#self-hosted-subscribe-route) |

## Members seller gate

Pay the route itself with `@pr402/client`; the seller answers with an entitlement token. Send that token on the next calls.

```typescript
import { X402AgentClient } from '@pr402/client';

const client = new X402AgentClient(payer, { maxPaymentAmount: '1000000' });
const first = await client.fetchWithAutoPay('https://seller.example/export', USDC_MINT, { method: 'POST' });
const { token } = await first.json(); // the seller returns the entitlement token after the paid call

const next = await fetch('https://seller.example/export', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Members-Idempotency-Key': 'order-2' },
});
```

| Answer | Meaning | Do |
| --- | --- | --- |
| 402 with `offers` | Not entitled, or quota used up | Pay again (a plan from `offers`) |
| 401 `token_invalid` | Token missing, invalid or expired (tokens last five minutes) | Get a new token; do **not** pay again with the expired token attached |
| 403 `membership_required` | The seller's organization does not admit this wallet | Stop; nothing was charged |

Send the same `Members-Idempotency-Key` when retrying one logical request, or each retry consumes quota again. An agent with a Members API key gets a fresh token with `GET https://api.members.miraland.io/v1/entitlements/token?app=<client_id>`. Full guide: [api.members.miraland.io/llms.txt](https://api.members.miraland.io/llms.txt).

## Self-hosted subscribe route

1. `GET /api/v1/subscribe/info` → pick a tier.
2. `POST /api/v1/subscribe?tier=…` → 402 → run [exact-payment-flow.md](exact-payment-flow.md) steps 3–5 against this route (`@pr402/client` `fetchWithAutoPay` does it).
3. Store `token` and `expiresAt` from the success JSON.
4. Data routes: `Authorization: Bearer <token>`, no `PAYMENT-SIGNATURE`.
5. `401 TOKEN_EXPIRED` / `TOKEN_REVOKED` → subscribe again; `TOKEN_INVALID` → discard the token; `403 TOKEN_SCOPE_MISMATCH` → wrong endpoint.

Reference seller: [miralandlabs/solrisk](https://github.com/miralandlabs/solrisk) (`/api/v1/subscribe`). Do not call facilitator `/verify` or `/settle` yourself — the seller settles.

## Related

- Seller setup: `pr402-seller` → [subscription-exact-rail.md](../../pr402-seller/references/subscription-exact-rail.md)
- Exact payment steps: [exact-payment-flow.md](exact-payment-flow.md)
