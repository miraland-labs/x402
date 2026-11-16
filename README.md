# 🌐 x402 Ecosystem Hub: The Solana Agentic Economy

**x402** is a modular, trustless, API-first financial stack built on the Solana blockchain. It provides the protocol and infrastructure for AI-to-AI resource settlement, enabling autonomous agents to trade compute, data, and services with cryptographic certainty.

> [!NOTE]
> **Virtual Hub Layout:** This repository is a virtual hub, not a monorepo. Each sub-project is a standalone repository. Clone them alongside this hub for local development.

---

## 🚀 Developer Integration Roadmap

If you are new to the x402 ecosystem, select your path below to get started immediately:

### 1. I am a Seller (Resource Provider)
*You run a web API (REST, GraphQL, etc.) and want to monetize it via HTTP 402.*
* **Pick a Rail:** Choose between **`exact`** (instant, low-latency payouts) or **`sla-escrow`** (escrow protection for conditional delivery).
* **Get Started (`exact` rail, pay-per-call):** Walk through the hands-on [x402-seller-lab-express](https://github.com/miraland-labs/x402-seller-lab-express/) or fork [x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter/) (Rust, TypeScript, Python).
* **Subscriptions, packs and plans:** Use [Members](https://api.members.miraland.io/llms.txt) (`npm i @miraland-labs/members`) — its seller gate settles through pr402 on the `exact` rail. Self-hosted alternative: [Subscription Pattern](SUBSCRIPTION_PATTERN.md).
* **Get Started (`sla-escrow` rail):** Read the [Seller Oracle Integration Guide](https://github.com/miraland-labs/oracles/blob/main/docs/SELLER_GUIDE.md), then fork the reference seller [x402-buy-spl-token](https://github.com/miralandlabs/x402-buy-spl-token).

### 2. I am a Buyer (Payer/Agent Developer)
*You build autonomous agents, wallets, or clients that need to pay for premium resources.*
* **Get Started (MCP/Cursor):** Run `npx -y @pr402/mcp-server` or install the SDK `npm i @pr402/client`. Starter code: [x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter/).
* **Exact Payments Guide:** Read the [Buyer Exact Quickstart](https://github.com/miralandlabs/pr402/blob/main/docs-site/quickstart-buyer.md).
* **Escrow Payments Guide:** Read the [Buyer Escrow Integration Guide](https://github.com/miraland-labs/oracles/blob/main/docs/BUYER_GUIDE.md).

### Agent Skills ([skills.sh](https://www.skills.sh/))
Install pr402 integrator skills into Cursor, Claude Code, Copilot, and other agents:

```bash
npx skills add miraland-labs/x402-agent-skills --skill pr402 --skill pr402-seller --skill pr402-buyer -y
npx skills add miraland-labs/x402-agent-skills --skill pr402
npx skills add miraland-labs/x402-agent-skills --skill pr402-seller
npx skills add miraland-labs/x402-agent-skills --skill pr402-buyer
```

Skills source: [miraland-labs/x402-agent-skills](https://github.com/miraland-labs/x402-agent-skills) (public). Hub mirror: [`skills/pr402`](skills/pr402/), [`skills/pr402-seller`](skills/pr402-seller/), and [`skills/pr402-buyer`](skills/pr402-buyer/). See [`.cursor/skills/INTEGRATOR_SKILLS.md`](.cursor/skills/INTEGRATOR_SKILLS.md). Starter code remains in [x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter) and [x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter).

### 3. I am an Oracle Developer or Operator
*You want to build or host a verification oracle for conditional `sla-escrow` payments.*
* **Get Started:** Follow the step-by-step [Oracle Developer Guide](https://github.com/miraland-labs/oracles/blob/main/docs/ORACLE_DEVELOPER_GUIDE.md).
* **Reference Workspace:** Explore the [oracles](https://github.com/miraland-labs/oracles/) folder containing the shared library and three reference oracle crates.

### 4. I am a Protocol / On-chain Developer
*You want to inspect, deploy, or extend the core settlement contracts.*
* **Core Engines:** UniversalSettle (SplitVault) and SLA-Escrow — source planned open source; program IDs and config are served by `GET /api/v1/facilitator/supported`.
* **Facilitator Gateway:** Inspect the [pr402 Facilitator](https://github.com/miralandlabs/pr402/) REST-to-Solana gateway.

---

## 🏛️ Ecosystem Pillars at a Glance

| Pillar | Role | Type | Description |
| :--- | :--- | :--- | :--- |
| **[pr402 Facilitator](https://github.com/miralandlabs/pr402/)** | REST-to-Solana Gateway | Rust/Vercel | Handles vault discovery, transaction building, and settlement verification. |
| **UniversalSettle** | Payout Engine (`exact` rail) | On-chain Program | Facilitates high-velocity payouts and automated revenue splitting. |
| **SLA-Escrow** | Escrow Enforcer (`sla-escrow` rail) | On-chain Program | Holds funds in escrow until delivery is verified by a trusted oracle. |
| **[Oracles Workspace](https://github.com/miraland-labs/oracles/)** | Adjudication Engine | Rust Workspace | Houses reference oracles (API Quality, Transfer, File Delivery) and specs. |
| **[Members](https://members.miraland.io)** | Subscriptions & Entitlements | Hosted service + SDK | Plans, packs and subscriptions paid through pr402; sign-in and entitlement tokens for apps. |
| **[x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter/)** | Seller Starter | Rust / TS / Python | Minimal pay-per-call 402 gate on the `exact` rail. |
| **[x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter/)** | Buyer Starter | Bash / TS / Python | Paying agent: 402 → build → sign → retry. |

---

## 📖 Global Documentation Directory

* **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** — Core design principles, transaction lifecycles, and security invariants.
* **[Subscription Pattern](SUBSCRIPTION_PATTERN.md)** — Blueprint for mapping recurring subscriptions (hourly/daily/monthly) to the `exact` rail.
* **[Ecosystem Pitch](X402_ECOSYSTEM_PITCH.md)** — Detailed rationale behind the x402 protocol and agentic economy.

## 🗄️ Archived

Read-only, kept for reference; do not build on them: `subscription-auth`, `x402-subscription-client`, `x402-subscription-seller`, `x402-subscription-starter` (superseded by Members), `langchain-pr402`, `x402-buy-rwa-token`, `rwa-issuer-portal`, `rwa-kyc-hook`, `rwa-kyc-sync`, `pr402-chat`, `pr402-link`, `aethervane`, `promptlean`, `intelligence-gateway-oss`, `intelligence-gateway-private`, `pack-auth`.

---

**Maintained by**: [Miraland Labs](https://github.com/miraland-labs)  
**Repository Hub**: [github.com/miraland-labs/x402](https://github.com/miraland-labs/x402)
