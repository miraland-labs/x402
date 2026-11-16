---
name: pr402-buyer
description: >-
  Integrate an x402 buyer agent on Solana via pr402 (ipay.sh): HTTP 402 challenges,
  build-exact-payment-tx, PAYMENT-SIGNATURE, MCP tools, createPay402Fetch, and Forge
  marketplace purchases. Use whenever the user builds a paying agent, auto-pays API
  calls, handles Payment-Required headers, mentions x402 buyer, pr402 buyer, X402Client,
  @pr402/client, @pr402/mcp-server, x402-buyer-starter, Members entitlement token,
  subscription JWT Bearer, forge-cli, agentic payments,
  or machine economy. If seller vs buyer is unclear, load **pr402** first.
metadata:
  author: miraland-labs
  version: "1.3.0"
---

# x402 buyer (pr402)

Help the user build a **buyer** that discovers paid resources, settles via pr402, and retries with proof.

Default rail: **`exact`** (SplitVault instant settlement via pr402). For **`sla-escrow`**, add oracle-specific fields — see [ipay.sh/agent-integration.md](https://ipay.sh/agent-integration.md) and [oracles Buyer Guide](https://github.com/miraland-labs/oracles/blob/main/docs/BUYER_GUIDE.md).

**Subscription APIs:** pay once (same exact steps 1–5 below), then send **`Authorization: Bearer`** on later calls — see [references/subscription-client.md](references/subscription-client.md) for Members seller gates and self-hosted `/subscribe` routes.

Reference repo: **[x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter)** (Bash / TypeScript / Python — **separate repo**).

Facilitator source and live docs: **[miralandlabs/pr402](https://github.com/miralandlabs/pr402)** (individual account — not the `miraland-labs` org).

## GitHub repos (x402 hub is virtual)

| Project | GitHub |
| --- | --- |
| pr402 facilitator + MCP source | [miralandlabs/pr402](https://github.com/miralandlabs/pr402) |
| Buyer starter | [miraland-labs/x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) |
| Seller starter | [miraland-labs/x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter) |
| Oracles workspace | [miraland-labs/oracles](https://github.com/miraland-labs/oracles) |
| x402 hub (docs + x402-cli only) | [miraland-labs/x402](https://github.com/miraland-labs/x402) |

## Pick a stack

| User context | Install | Skill reference |
| --- | --- | --- |
| Cursor / Claude Desktop / MCP host | `npx -y @pr402/mcp-server` | [references/mcp-and-sdk.md](references/mcp-and-sdk.md) |
| Node / TypeScript production agent | `npm i @pr402/client` | [references/mcp-and-sdk.md](references/mcp-and-sdk.md) |
| TypeScript starter/demo | `npm i @pr402/buyer-typescript` | Add the production safety checks below before using with funds |
| Quick CLI smoke test | `npm i -g @pr402/client` → `pr402-buy` | Same default flow as MCP — [references/mcp-and-sdk.md](references/mcp-and-sdk.md) |
| Python agent | starter `python/` | starter README |
| Bash / DevOps | starter `bash/` | minimal curl + sign flow |
| http402 Forge digital goods | `npm i -g @http402/forge-cli` | [references/forge-marketplace.md](references/forge-marketplace.md) |

## Facilitator URLs

**Default for examples and production integration:**

| | Recommended | Alternate (same APIs) |
| --- | --- | --- |
| **Production (Mainnet)** | `https://ipay.sh` | `https://agent.pay402.me` |

Set **`PR402_FACILITATOR_URL`** to the host the **seller documents** (usually `https://ipay.sh` on Mainnet).

Devnet testing only: `https://preview.ipay.sh` or `https://preview.agent.pay402.me`.

Confirm network: `GET https://ipay.sh/api/v1/facilitator/health`. Read wallet RPC from response — do not hardcode cluster RPC from docs.

## Golden path (`exact` scheme)

Execute in order:

1. **Request resource** — unpaid call returns **HTTP 402** + `PaymentRequired` (body and/or `PAYMENT-REQUIRED` header).
2. **Choose `accepts[]` line** — match payer wallet, network, asset, amount.
3. **Build tx** — `POST /api/v1/facilitator/build-exact-payment-tx` with `{ payer, accepted, resource }`.  
   Normalize `v2:solana:exact` → **`exact`** on the request body (canonical wire form).
4. **Sign** — deserialize base64 bincode `VersionedTransaction`; sign at `payerSignatureIndex`; paste signed tx into `verifyBodyTemplate.paymentPayload.payload.transaction`.
5. **Retry resource** — send **`PAYMENT-SIGNATURE`** as base64-encoded UTF-8 JSON. Raw JSON is compatibility-only. **Do not** call facilitator `/verify` or `/settle` first in the SDK/MCP path — the seller gate handles settlement.
6. **Seller settles** — seller SDK (or middleware) calls facilitator `/settle` directly; verification runs immediately before broadcast.
7. **Confirm** — HTTP 200 + optional **`PAYMENT-RESPONSE`** header with on-chain settlement metadata.

For **subscription** purchase, store the token the seller returns after the paid call and switch to Bearer auth — [references/subscription-client.md](references/subscription-client.md).

Full step detail: [references/exact-payment-flow.md](references/exact-payment-flow.md). Direct buyer-side `/settle` (manual curl / debugging only) is documented there under **Advanced**.

## Advanced: direct facilitator settlement

Use only when **not** retrying through a seller gate — manual curl, facilitator API debugging, or custom flows without HTTP 402 retry. **Not** what `pr402-buy`, MCP, or x402-buyer-starter do by default:

1. After step 4, `POST /api/v1/facilitator/settle` with the signed JSON body; `/settle` verifies internally.
2. Use `/verify` only as a diagnostic and never deliver based on its result. If used, call `/settle` immediately with the same proof.
3. Then retry the resource with `PAYMENT-SIGNATURE` if the seller still requires proof.

## Buyer safety requirements

- Accept only Solana `exact` rails unless deliberately implementing a separate scheme.
- Trust only official facilitator origins by default; require an explicit allowlist for self-hosted origins.
- Set an atomic-unit spend ceiling (`maxPaymentAmount` in `@pr402/client`).
- Reject build responses that change `scheme`, `network`, `asset`, `amount`, or `payTo`.
- Confirm `payerSignatureIndex` is a required signer slot owned by the buyer before signing.

## pr402 vs generic x402 (buyer pitfalls)

| Topic | pr402 reality |
| --- | --- |
| `payTo` | On-chain vault / escrow PDA — not "send to seller wallet" |
| Tx shape | Facilitator-built shell; do not add address lookup tables |
| Fee payer | Facilitator often pays Solana fees on **exact** — do not send legacy `buyerPaysTransactionFees` |
| Facilitator host | Must match seller's documented origin |
| Mint allowlist | Wrong `asset` → explicit 400 with approved mints list |
| Blockhash expiry | Rebuild + re-sign on `BLOCKHASH_EXPIRED` |
| Facilitator upstream | `502 FACILITATOR_UPSTREAM` → retry safely with backoff |

## TypeScript production pattern

```typescript
import { X402AgentClient } from "@pr402/client";

const client = new X402AgentClient(keypair, {
  maxPaymentAmount: "1000000", // atomic units
});

const res = await client.fetchWithAutoPay(
  "https://seller.example/api/premium",
  preferredMint,
  { method: "POST", body: "..." },
);
```

## When implementing for the user

1. **Prefer `@pr402/client` or MCP** over hand-rolling proof bodies; they share the hardened production path.
2. **Never commit payer keypairs** — env var `PR402_PAYER_KEYPAIR_JSON` or path outside repo.
3. **Fund the payer wallet** on Mainnet (production) or Devnet (when using `preview.ipay.sh`).
4. **Classify facilitator errors** — `PAYMENT_INVALID`: fix proof; `BLOCKHASH_EXPIRED`: rebuild; `FACILITATOR_UPSTREAM`: retry with backoff. Treat HTTP 200 JSON `error` fields as failure only as defensive starter handling.
5. **Scheme normalization** — always send wire `exact` to build endpoint; cached proofs may use either alias on verify.
6. **Forge vs HTTP 402** — Forge listings use `@http402/forge-client` / forge-mcp; generic APIs use pr402 buyer flow above.
7. **Subscription APIs** — if the seller returns a token after payment (Members gate or `/subscribe`), use [references/subscription-client.md](references/subscription-client.md); do not send `PAYMENT-SIGNATURE` on every data call.

## Live documentation

Production facilitator (default):

- [https://ipay.sh/agent-integration.md](https://ipay.sh/agent-integration.md) — canonical runbook
- [https://ipay.sh/quickstart-buyer.md](https://ipay.sh/quickstart-buyer.md) — SDK default + manual curl steps
- [x402-buyer-starter README](https://github.com/miraland-labs/x402-buyer-starter) — Bash / TypeScript / Python starter
- [https://ipay.sh/agent-tools.json](https://ipay.sh/agent-tools.json)
- [https://ipay.sh/openapi.json](https://ipay.sh/openapi.json)

Devnet equivalents live under `https://preview.ipay.sh/…` when testing on Devnet.

## Related

- **`pr402`** — entry router when integrator role is unclear
- **`pr402-seller`** — when the same project also sells APIs
- **`pr402-facilitator`** — only when modifying the Rust facilitator codebase
