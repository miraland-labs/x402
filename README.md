# 🌐 x402 Ecosystem Hub: The Solana Agentic Economy

**x402** is a modular, trustless, API-first financial stack built on the Solana blockchain. It provides the protocol and infrastructure needed for AI-to-AI resource settlement, enabling autonomous agents to trade compute, data, and services with cryptographic certainty.

> **Deployment status.** The **pr402 facilitator** is live on **Solana Mainnet** and **Solana Devnet**. The on-chain programs (`universalsettle`, `sla-escrow`) are deployed on both clusters.
>
> **Recommended host:** `https://ipay.sh` (Mainnet) · `https://preview.ipay.sh` (Devnet).
> **Also served — same service, not deprecated:** `https://agent.pay402.me` (Mainnet) · `https://preview.agent.pay402.me` (Devnet). Use whichever origin your integration or seller documentation specifies, and keep one origin per environment.
>
> Confirm cluster and feature flags at runtime via **`GET /api/v1/facilitator/health`** on the host you call; see the [pr402 repository](https://github.com/miralandlabs/pr402) and **`GET /openapi.json`**.
>
> **Seller docs (human):** [docs.ipay.sh](https://docs.ipay.sh) — [Start here](https://docs.ipay.sh/start-here.html) · [Choosing x402 on Solana](https://docs.ipay.sh/pr402-vs-alternatives.html) (facilitators vs buyer tools).
>
> **`sla-escrow` readiness.** The SLA-Escrow on-chain program is deployed on Mainnet and Devnet. Production sellers choose a trusted `oracle_authority`; reference oracles ship in [`miraland-labs/oracles`](https://github.com/miralandlabs/oracles) (api-quality, onchain-transfer, file-delivery). The open-source **[x402-buy-spl-token](https://github.com/miralandlabs/x402-buy-spl-token)** reference seller demonstrates the full escrow path on live preview/production hosts.

---

## 🏛️ The Pillars of x402

The ecosystem is composed of specialized, independent modules that work together to provide a seamless "Payment Required" (HTTP 402) experience for the serverless age.

### 🌉 [pr402 Facilitator](https://github.com/miralandlabs/pr402)

- **Role**: The Bridge (REST-to-Solana Gateway).
- **Platform**: Rust / Vercel Serverless.
- **What it does**: Handles vault discovery, transaction building, payment verification, and settlement for off-chain agents. Supports **`exact`** (UniversalSettle) and **`sla-escrow`** (SLA-Escrow).
- **Integrators (agents)**: facilitator **`GET /capabilities`** → **`agentManifest.payToSemantics`** (JSON).
- **Source**: Open Source.

### ⚡ UniversalSettle Protocol

- **Role**: The Payout (SplitVault Engine).
- **Platform**: Solana On-chain Program.
- **What it does**: High-velocity settlements via the `exact` scheme with automated revenue splitting. Ideal for immediate, low-latency pay-per-call APIs.
- **Source**: **Planned Open Source** — repository not yet public. Deployed on Mainnet and Devnet.

### 🛡️ SLA-Escrow Protocol

- **Role**: The Enforcer (Service Level Agreement Trustee).
- **Platform**: Solana On-chain Program.
- **What it does**: Escrows funds via the `sla-escrow` scheme for conditional delivery. Funds release (or refund) only after seller delivery and oracle verdict.
- **Source**: **Planned Open Source** — repository not yet public. Deployed on Mainnet and Devnet.

### ⚖️ [Oracles Workspace](https://github.com/miralandlabs/oracles)

- **Role**: Reference oracles for the `sla-escrow` rail and a template for domain-oracle developers.
- **Platform**: Rust / Axum / Tokio / Postgres (standalone services on Ubuntu 24.04 + systemd).
- **What it ships**: shared `oracle-common` plus three sibling binaries — **api-quality**, **onchain-transfer**, **file-delivery**.
- **Source**: Open Source.

### 📚 [Open-Source Seller Starter](https://github.com/miraland-labs/x402-seller-starter)

- **Role**: Minimal seller baseline (Rust / Axum) — 402 + forward proof to pr402.

### 🏹 [Open-Source Buyer Starter](https://github.com/miraland-labs/x402-buyer-starter)

- **Role**: Buyer/agent onboarding (Bash, TypeScript, Python).
- **Installable packages**: [`@pr402/client`](https://www.npmjs.com/package/@pr402/client), [`@pr402/mcp-server`](https://www.npmjs.com/package/@pr402/mcp-server) (MCP / Cursor), [`langchain-pr402`](https://pypi.org/project/langchain-pr402/) (Python LangChain), and [`pr402-client`](https://crates.io/crates/pr402-client) — npm/rust ship `pr402-buy`.

---

## 💎 Reference paid services (live proof points)

Miraland Labs operates production services on pr402. **Open-source references** are meant to be forked; **closed-source** services remain operated examples only.

### Open source — clone and ship

| Project | Rail | What it proves | Live hosts |
|--------|------|----------------|------------|
| **[x402-buy-spl-token](https://github.com/miralandlabs/x402-buy-spl-token)** | **`sla-escrow`** | USDC into escrow → SPL delivery → `SubmitDelivery` → **oracle-onchain-transfer** → release. Seller-quoted session totals (`quantity`), human storefront + agent API. Binding: `x402/informative/bindings/buy-spl-token/v1`. | [spl-token.hashspace.me](https://spl-token.hashspace.me) · [preview.spl-token.hashspace.me](https://preview.spl-token.hashspace.me) |
| **[solrisk](https://github.com/miralandlabs/solrisk)** | **`exact`** | Pay-per-call wallet risk scoring ($0.05 USDC) — chain signals, allow/deny labels, versioned formula. | [solrisk.signer-payer.me](https://solrisk.signer-payer.me/) |

**Start with x402-buy-spl-token** if you sell **conditional delivery** (tokens, credits, files, jobs). **Start with solrisk** if you sell **instant JSON** behind a fixed per-call price on **`exact`**.

### Operated only (closed source)

- **[SPL-Token Balance Verification](https://spl-token.signer-payer.me/)** — **`exact`** rail; SPL balance gating (preview: [preview.spl-token.signer-payer.me](https://preview.spl-token.signer-payer.me/)).
- **[AetherVane](https://aethervane.hashspace.me/)** — **`exact`** rail; machine-consumable metaphysical readings + optional LLM layer (preview: [preview.aethervane.hashspace.me](https://preview.aethervane.hashspace.me/)).

---

## 📖 Global Documentation

- **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** — technical pillars, transaction lifecycle, security invariants.
- **[Ecosystem Pitch](X402_ECOSYSTEM_PITCH.md)** — why x402 is the payment layer for autonomous agents.
- **pr402 human docs:** [docs.ipay.sh](https://docs.ipay.sh) — seller checklist, buyer quickstart, facilitator comparison.

---

## 🚀 Vision

AI agents are rich in data but broke in utility. Traditional payment rails are built for humans with bank accounts; x402 is built for machines with keypairs. We enable a world where agents don't just talk — they trade.

---

## 🛠️ Repository layout

This repository is a **virtual hub**, not a monorepo. Each sub-project is a standalone repository with its own Git history; clone them beside the hub when you want source locally. Sub-project folders are listed in `.gitignore` at the hub level.

```bash
# Recommended local structure
x402/
├── README.md                     <-- you are here
├── ARCHITECTURE_OVERVIEW.md
├── X402_ECOSYSTEM_PITCH.md
├── pr402/                        <-- facilitator (open source)
├── universalsettle/              <-- on-chain exact rail (planned OSS)
├── sla-escrow/                   <-- on-chain escrow rail (planned OSS)
├── oracles/                      <-- oracle workspace (open source)
├── x402-seller-starter/          <-- minimal seller example (open source)
├── x402-buyer-starter/           <-- buyer example (open source)
├── x402-buy-spl-token/           <-- sla-escrow reference seller (open source) ★
├── solrisk/                      <-- exact-rail reference seller (open source) ★
├── spl-token-balance-serverless/ <-- operated balance API (closed source)
└── aethervane/                   <-- operated readings API (closed source)
```

---

**Maintained by**: [Miraland Labs](https://github.com/miraland-labs)
**Repository Hub**: [https://github.com/miraland-labs/x402](https://github.com/miraland-labs/x402)
