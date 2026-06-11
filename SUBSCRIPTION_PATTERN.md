# x402 Subscription Pattern

**Pay once on-chain via pr402 → receive a time-window JWT → use Bearer auth on data routes → enforce fair-use rate limits.**

This document is the canonical reference for sellers who want **traditional subscription billing** (hourly, daily, monthly, yearly) on top of x402 — not per-request micropayments.

---

## Positioning: Two Seller Models

x402/pr402 supports both models on the same `exact` rail:

| Model | When to use | 402 on data routes? | Reference |
|-------|-------------|---------------------|-----------|
| **Per-call** | Low-latency, stateless APIs; price per inference/query | Yes — every request | [solrisk](https://github.com/miralandlabs/solrisk) |
| **Subscription** | High-volume data feeds, scrapers, analytics; buyers poll repeatedly | No — JWT Bearer only | [x402-subscription-starter](https://github.com/miraland-labs/x402-subscription-starter) + [x402-subscription-client](https://github.com/miraland-labs/x402-subscription-client) |

**Key insight:** pr402/x402 is not only for single-request payments. Sellers can map **hourly / daily / monthly / yearly** plans to one on-chain settlement per window — the same flow as Stripe + API key, but wallet-native.

| Traditional SaaS | x402 subscription pattern |
|------------------|---------------------------|
| Monthly invoice | One `exact` settlement for the plan window |
| API key after payment | JWT signed by seller; `exp` = tier duration |
| Plan-based rate limits | Per-payer `express-rate-limit` keyed on wallet |
| Upgrade plan | New x402 payment on `?tier=monthly` |

---

## Wire Contract

### 1. Discovery (free)

- `GET /health` — liveness
- `GET /api/v1/subscribe/info` — tier list, pricing hints, data endpoint catalog
- `GET /.well-known/x402-resources.json` — x402 resource index (subscription endpoints)

### 2. Purchase subscription (x402 gate)

```
POST /api/v1/subscribe?tier=hourly|daily|monthly
```

**Without `PAYMENT-SIGNATURE`:** HTTP **402** + JSON body:

```json
{
  "x402Version": 2,
  "resource": { "url": "...", "description": "...", "mimeType": "application/json" },
  "accepts": [{ "scheme": "exact", "network": "...", "asset": "...", "amount": "...", "payTo": "...", "maxTimeoutSeconds": 120, "extra": { ... } }],
  "extensions": { "pr402FacilitatorUrl": "https://preview.ipay.sh" }
}
```

**With valid `PAYMENT-SIGNATURE`:** seller calls pr402 `verify` → `settle`, then issues JWT:

```json
{
  "success": true,
  "token": "<jwt>",
  "tier": "monthly",
  "tierLabel": "30 days",
  "expiresAt": "2026-07-10T12:00:00.000Z",
  "durationSeconds": 2592000,
  "usage": "Authorization: Bearer <token>"
}
```

Response header: `PAYMENT-RESPONSE` (base64 settle result).

### 3. Data routes (JWT only)

```
POST /api/v1/<resource>
Authorization: Bearer <jwt>
Content-Type: application/json
```

No per-request x402. Seller validates JWT, checks revocation DB, applies per-payer rate limit.

### 4. Error codes (data routes)

| Code | HTTP | Meaning |
|------|------|---------|
| `MISSING_TOKEN` | 401 | No `Authorization` header |
| `TOKEN_EXPIRED` | 401 | JWT `exp` passed — buyer should renew via `/subscribe` |
| `TOKEN_REVOKED` | 401 | Token revoked in seller DB |
| `SUBSCRIBER_RATE_LIMIT_EXCEEDED` | 429 | Per-wallet fair-use limit |
| `RATE_LIMIT_EXCEEDED` | 429 | Global per-IP limit |

---

## Rate-Limit Design

Two layers (reference: fifa-worldcup-scraper):

1. **Global per-IP** — applied before auth; protects against DoS (default ~200 req/min).
2. **Per-payer wallet** — applied after JWT validation; keyed on `payer` claim (default ~60 req/min).

Optional: scale `max` by tier (monthly subscribers get higher ceiling).

---

## Adding a New Tier (3 steps)

Example: add `yearly` after `hourly` | `daily` | `monthly`.

### Step 1 — SQLite pricing seed

Insert a row per tier using endpoint key `/api/v1/subscribe/<tier>`:

```sql
INSERT OR REPLACE INTO parameters (service, endpoint, param_name, param_value, ...)
VALUES ('my-service', '/api/v1/subscribe/yearly', 'X402_ACCEPTS_JSON', '[{...}]', ...);
```

Generate `accepts[]` via `POST …/facilitator/payment-required/enrich` (see pr402 docs) or copy from seller-starter env contract.

### Step 2 — JWT duration

```typescript
export type Tier = 'hourly' | 'daily' | 'monthly' | 'yearly';

export const TIER_DURATIONS_SEC: Record<Tier, number> = {
  hourly:  60 * 60,
  daily:   24 * 60 * 60,
  monthly: 30 * 24 * 60 * 60,
  yearly:  365 * 24 * 60 * 60,
};
```

### Step 3 — Buyer client `Tier` type

Extend the union in your subscription client SDK so `subscribe('yearly')` works.

`/api/v1/subscribe/info` should iterate `ALL_TIERS` — no route changes needed.

---

## Buyer Client Pattern

Reference implementation: [x402-subscription-client/src/client.ts](https://github.com/miraland-labs/x402-subscription-client/blob/main/src/client.ts)

1. **Probe** `POST /subscribe` → parse 402 body (not `Payment-Required` header — matches seller-starter).
2. **Build tx** via `POST …/build-exact-payment-tx` — normalize `v2:solana:exact` → `exact`; never send `buyerPaysTransactionFees`.
3. **Sign** `VersionedTransaction` locally.
4. **Submit** with `PAYMENT-SIGNATURE` header (raw JSON string).
5. **Persist** JWT locally (`saveSubscriptionToFile`) — survives app/machine restart until `exp`.
6. **Data calls** with `Authorization: Bearer <jwt>`.
7. **Auto-renew** on `TOKEN_EXPIRED` or `TOKEN_REVOKED` — one retry after fresh `subscribe()`.

Sellers must return `persistenceHint` on subscribe success — the seller does not re-issue a token without a new x402 payment.

Shared pr402 helpers live in [x402-buyer-starter/typescript/src/pr402-exact-flow.ts](https://github.com/miraland-labs/x402-buyer-starter/blob/main/typescript/src/pr402-exact-flow.ts).

---

## Seller Implementation Checklist

- [ ] x402 gate **only** on `/api/v1/subscribe` — never on data routes
- [ ] JWT `exp` matches tier duration; `payer` claim from settlement result
- [ ] Revocation checked on every data request (SQLite or Redis)
- [ ] Dual rate limits: global IP + per-payer
- [ ] Tier pricing from DB parameters, not hardcoded
- [ ] `PAYMENT-RESPONSE` header on successful subscribe
- [ ] `persistenceHint` on subscribe success — remind buyers to save JWT locally
- [ ] Tier pricing: SQLite `parameters` first, env vars fallback
- [ ] Do not cache empty/failed scrape results (if applicable)

---

## Reference Projects

| Asset | Role |
|-------|------|
| [x402-subscription-starter](https://github.com/miraland-labs/x402-subscription-starter) | Forkable subscription **seller** (SQLite parameters + JWT) |
| [x402-subscription-client](https://github.com/miraland-labs/x402-subscription-client) | Generic subscription **buyer SDK** |
| fifa-worldcup-scraper (private) | Operated example — API `https://fifa.polystrike.io/devnet` (endpoints only; probe `GET /health` or `GET /api/v1/subscribe/info`) |
| [x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter) | Base per-call x402 gate + verify/settle |
| [x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) | Per-call buyer + pr402 exact-flow helpers |
| articles/subscription-pattern-01-en.md | Article column (EN + ZH) — in hub workspace; not published on this repo |

---

**Philosophy:** Simple is Best, yet Elegant — one payment gate, one JWT, rate limits for fair use. No new on-chain program required.
