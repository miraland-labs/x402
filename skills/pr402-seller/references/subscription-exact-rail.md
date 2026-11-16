# Subscriptions and plans on the exact rail

Time-window access (hourly, daily, monthly) and packs on top of pr402 **`exact`** — **not** pay-per-call and **not** `sla-escrow`.

## Default: Members (hosted)

[Members](https://api.members.miraland.io/llms.txt) holds the plans, settles the buyer's x402 proof through pr402, grants the entitlement, and returns an entitlement token. The seller guards a route with one adapter and never handles JWT signing, revocation or the ledger.

| | |
| --- | --- |
| SDK | `npm install @miraland-labs/members` — [npm](https://www.npmjs.com/package/@miraland-labs/members) |
| Integration guide (agents) | [api.members.miraland.io/llms.txt](https://api.members.miraland.io/llms.txt) |
| API reference | [api.members.miraland.io/v1/docs](https://api.members.miraland.io/v1/docs) |
| Portal (apps, features, plans, merchant wallet) | [members.miraland.io](https://members.miraland.io) |

### Setup

1. Portal → Organization → Apps → New app; copy client id and secret. Add a feature key (e.g. `export`) and a priced plan that bundles it. Set the organization's **merchant wallet** (the Solana wallet that receives USDC).
2. Env: `MEMBERS_CLIENT_ID`, `MEMBERS_CLIENT_SECRET`, `MEMBERS_API_URL=https://api.members.miraland.io`, `MEMBERS_PORTAL_URL=https://members.miraland.io`.
3. Guard the paid route so x402 buyers pay and retry:

```ts
import { MembersApp, expressGuard, expressBearerResolve, type MembersRequest } from '@miraland-labs/members';

const members = new MembersApp(); // reads MEMBERS_* from the environment

app.post('/export', expressGuard(members, expressBearerResolve(members), 'export', { body: true }),
  async (req, res) => {
    const access = (req as typeof req & MembersRequest).members;
    res.json({ line: await access.take(), token: access.token });
  });
```

Hono, Bun, Deno and Workers use `fetchGuard` / `bearerResolve` the same way.

### What the gate does

| Request | Answer |
| --- | --- |
| No token, no proof | **402** with `offers`, `billing` link and `PAYMENT-REQUIRED` (x402 offer of one plan) |
| `PAYMENT-SIGNATURE` (or `payment_signature` in the JSON body) | Members pins the proof to the offer, verifies, settles via pr402, grants; the route runs; return `access.token` to the buyer |
| `Authorization: Bearer <entitlement token>` | Verified offline against the JWKS; check or take runs; no payment |
| Invalid or expired token | **401** `token_invalid` — the buyer gets a new token, it is not charged again |

A buyer with no Members account pays as its wallet and becomes a member when the organization's enrollment is open (or a privilege rule admits the wallet). An invite-only organization refuses with 403 `membership_required` **before** money moves.

Do not call facilitator `/verify` or `/settle` yourself on this path — Members does.

## Self-hosted alternative

If the seller must sign its own JWTs, follow the wire contract in [SUBSCRIPTION_PATTERN.md](https://github.com/miraland-labs/x402/blob/main/SUBSCRIPTION_PATTERN.md): 402 **only** on `POST /api/v1/subscribe`, direct pr402 `/settle`, JWT only after `success: true`, Bearer on data routes. Reference implementation: [miralandlabs/solrisk](https://github.com/miralandlabs/solrisk) (per-call and subscription in one service).

## Related

- **Buyer side:** `pr402-buyer` → [subscription-client.md](../../pr402-buyer/references/subscription-client.md)
- **Pay-per-call seller:** [runtime-sdk.md](runtime-sdk.md)
- **Manifest / discovery:** [x402-resources-manifest.md](x402-resources-manifest.md)
