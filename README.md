# 🌐 x402 Ecosystem Hub: The Solana Agentic Economy

**x402** is a modular, trustless, and API-first financial stack built on the Solana blockchain. It provides the protocol and infrastructure needed for AI-to-AI resource settlement, enabling purely autonomous agents to trade compute, data, and services with cryptographic certainty.

> [!NOTE]
> **Launch phase (experimental):** The pr402 facilitator is available as **Production** `https://agent.pay402.me` (Solana Mainnet) and **Preview** `https://preview.agent.pay402.me` (Solana Devnet). Treat both as **experimental** — **use at your own risk**. Confirm cluster and endpoints with **`GET /api/v1/facilitator/health`** on the host you use; see [`pr402/README.md`](pr402/README.md) and **`GET /openapi.json`** on that host.

---

## 🏛️ The Pillars of x402

The ecosystem is composed of specialized, independent modules that work together to provide a seamless "Payment-Required" (HTTP 402) experience for the serverless age.

### 🌉 [pr402 Facilitator](https://github.com/miralandlabs/pr402)

- **Role**: The Bridge (REST-to-Solana Gateway).
- **Platform**: Rust / Vercel Serverless.
- **What it does**: Handles vault discovery, transaction building, and payment verification for off-chain agents.
- **Integrators (agents)**: facilitator **`GET /capabilities`** → **`agentManifest.payToSemantics`**; hub note [`docs/facilitator-onboard-supported-and-tx-building.md`](docs/facilitator-onboard-supported-and-tx-building.md).

### ⚡ [UniversalSettle Protocol](https://github.com/miraland-labs/universalsettle)

- **Role**: The Payout (SplitVault Engine).
- **Platform**: Solana On-chain Program (Planned Open Source).
- **What it does**: High-velocity, fixed-fee settlements via the `exact` scheme with automated revenue splitting. Ideal for immediate, low-latency micro-payments (**< $10 USDC** recommendation).

### 🛡️ [SLA-Escrow Protocol](https://github.com/miraland-labs/sla-escrow)

- **Role**: The Enforcer (Service Level Agreement Trustee).
- **Platform**: Solana On-chain Program (Planned Open Source).
- **What it does**: Escrows funds via the `sla-escrow` scheme for high-value or long-running work. Suggested for payments **>= $10 USDC**. Requires domain-specific Oracles for verification (recruiting these Oracle developers is a key ecosystem goal).

### 💎 [Solana SPL-Token Balance Verification](https://spl-token.signer-payer.me/)

- **Role**: Miraland Labs Official Paid Service.
- **Platform**: Rust / Vercel Serverless (Currently Closed Source).
- **What it does**: A production-grade service provided officially by Miraland Labs. It demonstrates real-world API token-balance gating over x402.
- **Preview**: [preview.spl-token.signer-payer.me](https://preview.spl-token.signer-payer.me/)

### 🔮 [AetherVane Fortune Teller](https://aethervane.hashspace.me/)

- **Role**: Reference Paid Service (Agentic Metaphysics).
- **Platform**: Rust workspace on Vercel — `aethervane-srv` (x402-gated HTTP API), `aethervane-app` (web client), `aethervane-shared` (Closed Source).
- **What it does**: Deterministic, machine-consumable readings across multiple engines — Bazi (Four Pillars), Western tropical natal (Swiss Ephemeris–based), Liu Yao, Mei Hua, onomancy (81-number), and daily almanac — with optional LLM-backed interpretation and PostgreSQL-backed quotas. Succeeds the slimmer `aethervane-serverless` preview; same x402 payment pattern, richer surface area for agents.
- **Preview**: [preview.aethervane.hashspace.me](https://preview.aethervane.hashspace.me/)

### ⚖️ [Oracle-QA: API Response Quality Oracle](https://github.com/miraland-labs/oracle-qa)

- **Role**: First Official x402 Oracle & Reference Implementation for Oracle Developers.
- **Platform**: Rust / Axum / Tokio (Standalone Server).
- **What it does**: Monitors SLA-Escrow delivery events via Solana WebSocket, evaluates API response quality against SLA contracts (status codes, latency, JSON Schema, required fields), and submits on-chain verdicts. Designed as both a production-ready oracle and an open-source reference for developers building domain-specific oracles across any vertical.

### 📚 [Open-Source Seller Starter](https://github.com/miraland-labs/x402-seller-starter)

- **Role**: Open-source Seller Reference.
- **Platform**: Rust / Axum.
- **What it does**: A minimal baseline for resource providers. Builds x402 v2 challenge JSON and verifies incoming settlement proofs.

### 🏹 [Open-Source Buyer Starter](https://github.com/miraland-labs/x402-buyer-starter)

- **Role**: Open-source Buyer/Agent Reference.
- **Platform**: Polyglot (Bash, TypeScript, Python).
- **What it does**: The definitive onboarding tool for AI agents (MCP, OpenClaw). Demonstrates the full acquisition lifecycle (Challenge → Discovery → Build → Sign → Settle) with zero-dependency Bash and robust TS/Python SDKs.

---

## 📖 Global Documentation

- **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)**: Deep dive into the technical pillars, transaction lifecycles, and security invariants.
- **[Ecosystem Pitch](X402_ECOSYSTEM_PITCH.md)**: The marketing perspective on why x402 is the foundation for the next stage of the internet.

---

## 🚀 Vision

AI Agents are rich in data but broke in utility. Traditional payment rails are built for humans with bank accounts; x402 is built for machines with keypairs. We enable a world where agents don't just talk—they trade.

---

## 🛠️ Contribution and Local Development

We recommend a **"Hub-and-Spoke"** development model. You can clone this hub and then clone the standalone projects into their respective folders:

```bash
# Recommended Local Structure
x402/
├── README.md               <-- You are here
├── ARCHITECTURE_OVERVIEW.md
├── X402_ECOSYSTEM_PITCH.md
├── pr402/                  <-- Independent Repo (Open Source Facilitator)
├── universalsettle/        <-- Independent Repo (Planned Open Source)
├── sla-escrow/             <-- Independent Repo (Planned Open Source)
├── oracle-qa/              <-- Independent Repo (Open Source Oracle Reference)
├── spl-token-balance-serverless/ <-- Paid Service (Closed Source)
├── aethervane/               <-- Paid Service: AetherVane API + app (Closed Source; replaces aethervane-serverless)
├── x402-seller-starter/    <-- Demo Reference (Open Source)
└── x402-buyer-starter/     <-- Agent SDK Reference (Open Source)
```

---

**Maintained by**: [Miraland Labs](https://github.com/miraland-labs) & [MiralandLabs](https://github.com/miralandlabs)
**Repository Hub**: [https://github.com/miraland-labs/x402](https://github.com/miraland-labs/x402)