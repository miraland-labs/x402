# 📅 x402 Subscription Pattern

The x402 subscription pattern allows sellers to offer **time-window access** (hourly, daily, monthly, yearly) on the `exact` rail instead of gating every request with a separate payment.

**Concept:** Pay once on-chain via `exact` → Receive a time-window JWT signed by the seller → Send the JWT in the `Authorization: Bearer` header on data routes → Enforce rate limits.

---

## 🔌 The Wire Contract

### 1. Discovery
Sellers advertise their tiers and resource catalogs:
* `GET /api/v1/subscribe/info` — Returns JSON listing tiers, pricing, and available endpoints.
* `GET /.well-known/x402-resources.json` — Public catalog of subscription routes.

### 2. Purchase Flow (Gated)
```
POST /api/v1/subscribe?tier=hourly|daily|monthly
```
* **Without valid `PAYMENT-SIGNATURE`:** Returns HTTP **402 Payment Required** + JSON accepts envelope.
* **With valid `PAYMENT-SIGNATURE`:** The seller settles the transaction on-chain via pr402 and returns the JWT:
  ```json
  {
    "success": true,
    "token": "<jwt-token-string>",
    "tier": "monthly",
    "expiresAt": "2026-07-23T12:00:00.000Z",
    "durationSeconds": 2592000,
    "usage": "Authorization: Bearer <token>"
  }
  ```

### 3. Data Routes (JWT Auth)
```
GET /api/v1/premium-data
Authorization: Bearer <jwt-token-string>
```
If JWT validation fails, return **HTTP 401 Unauthorized** with one of the standard error codes:
* `MISSING_TOKEN` — Authorization header omitted.
* `TOKEN_EXPIRED` — JWT `exp` has passed.
* `TOKEN_REVOKED` — JWT has been explicitly revoked.
* `TOKEN_INVALID` — Malformed signature.
* `TOKEN_SCOPE_MISMATCH` — Returns **HTTP 403 Forbidden** if the token doesn't cover this endpoint scope.

---

## 🎫 JWT Claims & Scopes

### Canonical JWT Claims
```json
{
  "sub": "api.example.com",
  "payer": "<buyer-wallet-pubkey>",
  "tier": "monthly",
  "resources": ["*"],
  "jti": "<unique-uuid-token-id>",
  "iat": 1718270000,
  "exp": 1718273600
}
```

### Resource Scopes (`resources[]`)
* **`["*"]`** — Grants access to all data routes under the service.
* **`["/api/v1/matches/live"]`** — Grants access to a specific endpoint.

---

## 🔒 Auth Infrastructure (Tier A vs Tier B)

Sellers can choose between two token validation architectures:

| Feature | Tier A (Local) | Tier B (Hosted) |
| :--- | :--- | :--- |
| **Signing Key** | Local `JWT_SECRET` (HS256) | Centralized RS256 JWKS |
| **Revocation** | Checked against a local DB | Pulled from a hosted revocation feed |
| **Setup Cost** | Zero (fully self-contained) | Requires service registration |

---

## 🛠️ Implementation Checklist for Sellers

1. [ ] Expose `/api/v1/subscribe/info` describing your subscription pricing.
2. [ ] Gated path `POST /api/v1/subscribe` returns HTTP 402 if unpaid, settles via pr402, and returns a signed JWT.
3. [ ] Store `JWT_SECRET` securely in environment variables.
4. [ ] Data routes check `Authorization: Bearer <token>` and return `401` / `403` error codes.
5. [ ] Apply per-payer rate limits keyed on the `payer` claim inside the validated JWT.
