# x402 Subscription Pattern

**Pay once on-chain via pr402 → receive a time-window JWT → use Bearer auth on data routes → enforce fair-use rate limits.**

This document is the canonical **wire contract** for subscription billing on x402 (endpoints, 402 body, JWT claims, rate limits, buyer behavior). **Choosing or configuring JWT auth (Tier A vs B)?** → [subscription-auth/docs/SUBSCRIPTION_AUTH_FOR_SELLERS.md](subscription-auth/docs/SUBSCRIPTION_AUTH_FOR_SELLERS.md)

---

## Positioning: Two Seller Models

x402/pr402 supports both models on the same `exact` rail:

| Model | When to use | 402 on data routes? | Reference |
|-------|-------------|---------------------|-----------|
| **Per-call** | Low-latency, stateless APIs; price per inference/query | Yes — every request | [solrisk](https://github.com/miralandlabs/solrisk) (per-call path) |
| **Subscription** | High-volume data feeds, scrapers, analytics; buyers poll repeatedly | No — JWT Bearer only | [x402-subscription-starter](https://github.com/miraland-labs/x402-subscription-starter) + [x402-subscription-client](https://github.com/miraland-labs/x402-subscription-client) |
| **Dual-mode** | Same data routes: per-call **or** subscribe once | Per-call if no Bearer; x402 gate on `/subscribe` only | **[solrisk v2](https://github.com/miralandlabs/solrisk)** — Rust/Vercel reference |

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

| Code | HTTP | Meaning | Buyer auto-renew? |
|------|------|---------|-------------------|
| `MISSING_TOKEN` | 401 | No `Authorization` header | No |
| `TOKEN_EXPIRED` | 401 | JWT `exp` passed — buyer should renew via `/subscribe` | **Yes** |
| `TOKEN_REVOKED` | 401 | Token revoked (store or AuthService feed) | **Yes** |
| `TOKEN_INVALID` | 401 | Bad signature or malformed JWT | No |
| `TOKEN_SCOPE_MISMATCH` | 403 | JWT valid but `resources[]` does not cover this route | **No** — subscribe to correct tier |
| `SUBSCRIBER_RATE_LIMIT_EXCEEDED` | 429 | Per-wallet fair-use limit | No |
| `RATE_LIMIT_EXCEEDED` | 429 | Global per-IP limit | No |

---

## JWT Auth Infrastructure (Tier A / Tier B)

Sellers may issue JWTs **locally** (Tier A) or via optional hosted **subscription-auth** (Tier B). Payment gate (`402` + pr402 settle on `/subscribe`) **always stays at the seller**.

| Tier | JWT signing | Revocation | Register auth service? |
|------|-------------|------------|------------------------|
| **A — local** | `JWT_SECRET` (HS256) via [`@pr402/subscription-seller`](https://www.npmjs.com/package/@pr402/subscription-seller) | Seller DB or `NoopStore` | **No** |
| **B — hosted** | [subscription-auth](subscription-auth/) RS256 + JWKS | Central feed poll (~60s, fail-open) | **Yes — once at deploy** |

**→ Seller setup (Tier A vs B, env, verify):** [subscription-auth/docs/SUBSCRIPTION_AUTH_FOR_SELLERS.md](subscription-auth/docs/SUBSCRIPTION_AUTH_FOR_SELLERS.md)

**What you register where:**

| You sell | Register with |
|----------|---------------|
| Per-call `exact` only | pr402 (facilitator onboarding) |
| Subscription + Tier A | pr402 only — set `JWT_SECRET` on seller |
| Subscription + Tier B | pr402 + **subscription-auth** (`register-service`) |
| `sla-escrow` delivery | pr402 + oracle (orthogonal to subscription JWT) |

---

## JWT Claims

### Legacy tokens (existing deployments)

```json
{ "payer": "...", "tier": "hourly", "iat": 1718270000, "exp": 1718273600 }
```

Optional `sub` (solrisk). Missing `resources` → treat as `["*"]` (service-wide). Missing `jti` → revoke via `payer + iat` row where store exists.

### New tokens (recommended)

```json
{
  "sub": "fifa.polystrike.io",
  "payer": "...",
  "tier": "hourly",
  "resources": ["*"],
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1718270000,
  "exp": 1718273600
}
```

Tier B adds `iss` (AuthService URL). Scope enforcement on data routes is **opt-in** until seller advertises scoped tiers in `/subscribe/info`.

---

## Resource scopes (`resources[]`)

| Mode | JWT `resources` | Data route check |
|------|-----------------|------------------|
| Service-wide (default) | `["*"]` | Any protected route |
| Single endpoint | `["/api/v1/matches/live"]` | Normalized path must match |
| Combination | `["/path/a", "/path/b"]` | Path must be in array |

v1: exact normalized paths only (strip trailing slashes). `TOKEN_SCOPE_MISMATCH` → **403**, not 402.

`/api/v1/subscribe/info` should list `resources[]` per tier when scopes are used.

---

## Revocation store policies (Tier A)

| Policy | Missing DB row | Store error | Profile |
|--------|----------------|-------------|---------|
| **StrictStore** | Deny (revoked) | Fail closed | TypeScript starters, FIFA |
| **LenientStore** | Allow if JWT valid | Fail open + warn | solrisk |
| **NoopStore** | Allow until `exp` | N/A | Minimal — **exp-only, no early revoke** |

SQLite/Postgres is **not required** for JWT sign/verify — only for revocation and optional tier pricing DB.

---

## Dual-mode sellers (per-call + subscription)

Reference: [solrisk](https://github.com/miralandlabs/solrisk)

1. Data route receives `Authorization: Bearer` → validate JWT + scope first.
2. Scope mismatch → **403 `TOKEN_SCOPE_MISMATCH`** — do **not** fall through to per-call x402.
3. No Bearer header → per-call x402 `PAYMENT-SIGNATURE` path unchanged.
4. `/subscribe/info` documents which endpoints each tier grants.

---

## Buyer client behavior

Reference: [x402-subscription-client](https://github.com/miralandlabs/x402-subscription-client)

- Auto-renew on **401** `TOKEN_EXPIRED` or `TOKEN_REVOKED` only.
- **403** `TOKEN_SCOPE_MISMATCH` — surface error; buyer must subscribe to a tier that includes the route.
- Client is claim-opaque; optional additive `resources` in subscribe success response is for human/docs only.

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
2. **Build tx** via `POST …/build-exact-payment-tx` — normalize `v2:solana:exact` → `exact`.
3. **Enrich verify body** — merge facilitator `GET …/capabilities` exact-rail `extra` into `paymentPayload.accepted.extra` and `paymentRequirements.extra`; set signed tx on `paymentPayload.payload.transaction`.
4. **Submit** with `PAYMENT-SIGNATURE` header (raw JSON string).
5. **Persist** JWT locally (`saveSubscriptionToFile`) — survives app/machine restart until `exp`.
6. **Data calls** with `Authorization: Bearer <jwt>`.
7. **Auto-renew** on `TOKEN_EXPIRED` or `TOKEN_REVOKED` only — **not** on `403 TOKEN_SCOPE_MISMATCH`.

Sellers must return `persistenceHint` on subscribe success — the seller does not re-issue a token without a new x402 payment.

Shared pr402 helpers: [x402-subscription-client/src/pr402-exact-flow.ts](x402-subscription-client/src/pr402-exact-flow.ts) (subscription). Per-call: [x402-buyer-starter](https://github.com/miralandlabs/x402-buyer-starter).

---

## Seller Implementation Checklist

- [ ] x402 gate **only** on `/api/v1/subscribe` — never on data routes
- [ ] JWT `exp` matches tier duration; `payer` claim from settlement result
- [ ] Choose revocation policy: StrictStore / LenientStore / NoopStore (see above)
- [ ] New tokens: include `jti`; recommend `sub` + `resources` (default `["*"]`)
- [ ] Revocation checked on every data request (local store and/or Tier B feed)
- [ ] Dual rate limits: global IP + per-payer
- [ ] Tier pricing from DB parameters or env — DB not required for JWT alone
- [ ] `PAYMENT-RESPONSE` header on successful subscribe
- [ ] `persistenceHint` on subscribe success — remind buyers to save JWT locally
- [ ] Optional: scope enforcement + `resources[]` per tier in `/subscribe/info`
- [ ] Do not cache empty/failed scrape results (if applicable)

---

## Auth infrastructure docs

| Doc | Purpose |
|-----|---------|
| [subscription-auth/docs/SUBSCRIPTION_AUTH_FOR_SELLERS.md](subscription-auth/docs/SUBSCRIPTION_AUTH_FOR_SELLERS.md) | Tier A vs B setup + env |
| [subscription-auth/README.md](subscription-auth/README.md) | Deploy auth service + API |
| [subscription-auth/scripts/](subscription-auth/scripts/) | Smoke, register, E2E scripts |

**Packages / repos:** [`@pr402/subscription-seller`](https://www.npmjs.com/package/@pr402/subscription-seller) (npm), [subscription-auth](subscription-auth/) (Tier B service, in hub).

### Verify your integration

```bash
# Tier B auth Preview (no payment)
./subscription-auth/scripts/smoke-preview.sh
node subscription-auth/scripts/e2e-tier-b-auth.mjs --keypair demo-wallets/seller-keypair.json

# Full stack: starter example run-seller.sh + client run-buyer.sh (two terminals)
# See x402-subscription-starter/examples/tier-b-preview-e2e/README.md
```

---

## Reference Projects

| Asset | Role |
|-------|------|
| [solrisk](https://github.com/miralandlabs/solrisk) | **Dual-mode** Rust seller — per-call + subscription JWT on wallet/token/tx routes |
| [x402-subscription-starter](https://github.com/miralandlabs/x402-subscription-starter) | Forkable subscription **seller** (Tier A default; Tier B optional) |
| [`@pr402/subscription-seller`](https://www.npmjs.com/package/@pr402/subscription-seller) | Shared seller SDK |
| [subscription-auth](subscription-auth/) | Tier B hosted JWT + revocation feed |
| [x402-subscription-client](https://github.com/miraland-labs/x402-subscription-client) | Generic subscription **buyer SDK** |
| fifa-worldcup-scraper (private) | Operated example — API `https://fifa.polystrike.io/devnet` (endpoints only; probe `GET /health` or `GET /api/v1/subscribe/info`) |
| [x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter) | Base per-call x402 gate + verify/settle |
| [x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) | Per-call buyer + pr402 exact-flow helpers |

---

**Philosophy:** Simple is Best, yet Elegant — one payment gate, one JWT, rate limits for fair use. No new on-chain program required.
