---
name: pr402
description: >-
  Entry point for x402 integrations on Solana via pr402 (ipay.sh). Use when the user
  mentions pr402, x402 on Solana, ipay.sh, agentic payments, or HTTP 402 but the role
  (seller vs buyer) is unclear — or when orienting before picking a stack. Route to
  pr402-seller for monetizing APIs and pr402-buyer for paying agents. Do not implement
  seller or buyer flows here; hand off to the specialist skill.
metadata:
  author: miraland-labs
  version: "1.2.0"
---

# pr402 (x402 on Solana)

**Router skill only.** Orient the user, pick seller vs buyer, then continue in the specialist skill — do not implement gates, payments, or SDK wiring in this file.

## Choose a path

| User goal | Load / install | Starter repo |
| --- | --- | --- |
| Monetize an HTTP API (402 gate, SplitVault, discovery) | **`pr402-seller`** | [x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter) |
| Subscriptions, packs and plans (hourly/daily/monthly on exact) | **`pr402-seller`** → subscription reference | [`@miraland-labs/members`](https://www.npmjs.com/package/@miraland-labs/members) |
| Build a paying agent (402 challenge → pay → retry with proof) | **`pr402-buyer`** | [x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) |
| Buy subscription access (pay once → Bearer token) | **`pr402-buyer`** → subscription reference | [x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) + `@pr402/client` |
| Both seller and buyer in one product | Install **both** specialist skills | Both starters above |
| Conditional delivery / oracle escrow | Stop — **`sla-escrow`** rail + [oracles](https://github.com/miraland-labs/oracles) | Not covered by default integrator skills |

**Default rail for new integrators:** **`exact`** (SplitVault instant settlement via pr402). Treat **`sla-escrow`** as a separate path.

## Install (skills CLI)

All integrator skills (`-y`), or one at a time (interactive):

```bash
npx skills add miraland-labs/x402-agent-skills --skill pr402 --skill pr402-seller --skill pr402-buyer -y
npx skills add miraland-labs/x402-agent-skills --skill pr402
npx skills add miraland-labs/x402-agent-skills --skill pr402-seller
npx skills add miraland-labs/x402-agent-skills --skill pr402-buyer
```

List all skills in this repo:

```bash
npx skills add miraland-labs/x402-agent-skills --list
```

Skills.sh listing: [miraland-labs/x402-agent-skills](https://skills.sh/miraland-labs/x402-agent-skills).

## Shared production defaults

| | URL |
| --- | --- |
| Facilitator (Mainnet) | `https://ipay.sh` |
| Facilitator API prefix | `/api/v1/facilitator` |
| Devnet / preview testing | `https://preview.ipay.sh` |
| Canonical runbook | [ipay.sh/agent-integration.md](https://ipay.sh/agent-integration.md) |
| OpenAPI | [ipay.sh/openapi.json](https://ipay.sh/openapi.json) |
| MCP tool catalog | [ipay.sh/agent-tools.json](https://ipay.sh/agent-tools.json) |

## GitHub layout (virtual hub)

The [x402 hub](https://github.com/miraland-labs/x402) coordinates docs and **x402-cli** only. Clone each project from its own repo:

| Project | GitHub |
| --- | --- |
| pr402 SDK / MCP source | [miralandlabs/pr402](https://github.com/miralandlabs/pr402) (individual account — not `miraland-labs`) |
| Seller starter | [miraland-labs/x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter) |
| Buyer starter | [miraland-labs/x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) |
| Agent skills (this repo) | [miraland-labs/x402-agent-skills](https://github.com/miraland-labs/x402-agent-skills) |
| Oracles / escrow | [miraland-labs/oracles](https://github.com/miraland-labs/oracles) |
| Subscriptions and plans (hosted) | Members: [`@miraland-labs/members`](https://www.npmjs.com/package/@miraland-labs/members) · [api.members.miraland.io/llms.txt](https://api.members.miraland.io/llms.txt) |

## Agent workflow

1. **Clarify role** — seller (accepts USDC for API calls) vs buyer (pays for API calls) vs both.
2. **Hand off** — open `pr402-seller` or `pr402-buyer` (install if missing) for step-by-step implementation.
3. **Prefer starters + published SDK/MCP** over hand-rolling verify/settle payloads unless debugging.
4. **Never commit keypairs** — merchant/payer secrets via env vars outside the repo.
5. **Forge marketplace** (digital goods) — buyer path may use `@http402/forge-client`; see **`pr402-buyer`** references.

## Quick pointers (not full runbooks)

| Need | Where |
| --- | --- |
| Seller onboarding CLI | **`pr402-seller`** → `references/onboarding-cli.md` |
| Seller runtime SDK gate | **`pr402-seller`** → `references/runtime-sdk.md` |
| Buyer MCP / `createPay402Fetch` | **`pr402-buyer`** → `references/mcp-and-sdk.md` |
| Buyer HTTP 402 retry flow | **`pr402-buyer`** → `references/exact-payment-flow.md` |
| Subscription seller (Members gate) | **`pr402-seller`** → `references/subscription-exact-rail.md` |
| Subscription buyer (pay once + Bearer) | **`pr402-buyer`** → `references/subscription-client.md` |
| Forge purchases | **`pr402-buyer`** → `references/forge-marketplace.md` |

## Related skills

- **`pr402-seller`** — monetize HTTP APIs
- **`pr402-buyer`** — paying agents and MCP hosts
