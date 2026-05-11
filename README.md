# 🌐 x402 Ecosystem Hub: The Solana Agentic Economy

**x402** is a modular, trustless, API-first financial stack built on the Solana blockchain. It provides the protocol and infrastructure needed for AI-to-AI resource settlement, enabling autonomous agents to trade compute, data, and services with cryptographic certainty.

> **Deployment status.** The **pr402 facilitator** is live on **Solana Mainnet** and **Solana Devnet**. The on-chain programs (`universalsettle`, `sla-escrow`) are deployed on both clusters.
>
> **Recommended host:** `https://ipay.sh` (Mainnet) · `https://preview.ipay.sh` (Devnet).
> **Also served — same service, not deprecated:** `https://agent.pay402.me` (Mainnet) · `https://preview.agent.pay402.me` (Devnet). Use whichever origin your integration or seller documentation specifies, and keep one origin per environment.
>
> Confirm cluster and feature flags at runtime via **`GET /api/v1/facilitator/health`** on the host you call; see the [pr402 repository](https://github.com/miralandlabs/pr402) and **`GET /openapi.json`**.
>
> **`sla-escrow` readiness.** The SLA-Escrow on-chain program is deployed, but general-availability for sellers/buyers depends on a production-advertised default oracle. The reference oracle [`oracle-qa`](https://github.com/miraland-labs/oracle-qa) is being hardened for that role; until then, treat `sla-escrow` as available to integrators who operate their own `oracle_authority`.

---

## 🏛️ The Pillars of x402

The ecosystem is composed of specialized, independent modules that work together to provide a seamless "Payment Required" (HTTP 402) experience for the serverless age.

### 🌉 [pr402 Facilitator](https://github.com/miralandlabs/pr402)

- **Role**: The Bridge (REST-to-Solana Gateway).
- **Platform**: Rust / Vercel Serverless.
- **What it does**: Handles vault discovery, transaction building, and payment verification for off-chain agents.
- **Integrators (agents)**: facilitator **`GET /capabilities`** → **`agentManifest.payToSemantics`** (JSON).
- **Source**: Open Source.

### ⚡ UniversalSettle Protocol

- **Role**: The Payout (SplitVault Engine).
- **Platform**: Solana On-chain Program.
- **What it does**: High-velocity, fixed-fee settlements via the `exact` scheme with automated revenue splitting. Ideal for immediate, low-latency micro-payments (**< $10 USDC** recommendation).
- **Source**: **Planned Open Source** — repository not yet public. Deployed on Mainnet and Devnet.

### 🛡️ SLA-Escrow Protocol

- **Role**: The Enforcer (Service Level Agreement Trustee).
- **Platform**: Solana On-chain Program.
- **What it does**: Escrows funds via the `sla-escrow` scheme for high-value or long-running work. Suggested for payments **>= $10 USDC**. Requires a domain-specific Oracle authority to adjudicate delivery.
- **Source**: **Planned Open Source** — repository not yet public. Deployed on Mainnet and Devnet.

### ⚖️ [oracle-qa: API Response Quality Oracle](https://github.com/miraland-labs/oracle-qa)

- **Role**: First official x402 Oracle & reference implementation for oracle developers.
- **Platform**: Rust / Axum / Tokio (standalone server).
- **What it does**: Monitors SLA-Escrow delivery events via Solana WebSocket, evaluates API response quality against SLA contracts (status codes, latency, JSON Schema, required fields), and submits on-chain verdicts. Designed as both a production-candidate oracle and an open-source **template** for domain-specific oracles across any vertical.
- **Source**: Open Source.

### 📚 [Open-Source Seller Starter](https://github.com/miraland-labs/x402-seller-starter)

- **Role**: Open-source seller reference.
- **Platform**: Rust / Axum.
- **What it does**: A minimal baseline for resource providers. Builds x402 v2 challenge JSON and verifies incoming settlement proofs.

### 🏹 [Open-Source Buyer Starter](https://github.com/miraland-labs/x402-buyer-starter)

- **Role**: Open-source buyer/agent reference.
- **Platform**: Polyglot (Bash, TypeScript, Python).
- **What it does**: The definitive onboarding tool for AI agents. Demonstrates the full acquisition lifecycle (Challenge → Discovery → Build → Sign → Settle) with zero-dependency Bash and robust TS/Python SDKs.
- **Installable packages**: [`@pr402/client`](https://www.npmjs.com/package/@pr402/client) on npm and [`pr402-client`](https://crates.io/crates/pr402-client) on crates.io — both ship a `pr402-buy` CLI.

### 💎 Reference paid services (bootstrap sellers)

Miraland Labs operates two production paid services that act as third-party-style seller references on top of pr402. They are closed source but useful as live integration proof-points:

- **[SPL-Token Balance Verification](https://spl-token.signer-payer.me/)** — production-grade SPL balance gating over x402 (preview: [preview.spl-token.signer-payer.me](https://preview.spl-token.signer-payer.me/)).
- **[AetherVane](https://aethervane.hashspace.me/)** — deterministic, machine-consumable metaphysical readings (Bazi, Western tropical natal, Liu Yao, Mei Hua, onomancy, daily almanac), optional LLM interpretation, Postgres quotas (preview: [preview.aethervane.hashspace.me](https://preview.aethervane.hashspace.me/)).

---

## 📖 Global Documentation

- **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** — technical pillars, transaction lifecycle, security invariants.
- **[Ecosystem Pitch](X402_ECOSYSTEM_PITCH.md)** — why x402 is the payment layer for autonomous agents.

---

## 🚀 Vision

AI agents are rich in data but broke in utility. Traditional payment rails are built for humans with bank accounts; x402 is built for machines with keypairs. We enable a world where agents don't just talk — they trade.

---

## 🛠️ Repository layout

This repository is a **virtual hub**, not a monorepo. Each sub-project listed below is a standalone repository with its own Git history; clone them beside the hub when you want source code locally. A fresh hub clone intentionally contains only ecosystem-level documentation (the sub-project folders are ignored at the hub level — see `.gitignore`).

```bash
# Recommended local structure
x402/
├── README.md                     <-- you are here
├── ARCHITECTURE_OVERVIEW.md
├── X402_ECOSYSTEM_PITCH.md
├── pr402/                        <-- standalone repo (open source facilitator)
├── universalsettle/              <-- standalone repo (on-chain, planned open source)
├── sla-escrow/                   <-- standalone repo (on-chain, planned open source)
├── oracle-qa/                    <-- standalone repo (open-source oracle reference)
├── x402-seller-starter/          <-- standalone repo (open source)
├── x402-buyer-starter/           <-- standalone repo (open source)
├── spl-token-balance-serverless/ <-- reference paid service (closed source)
└── aethervane/                   <-- reference paid service (closed source)
```

---

**Maintained by**: [Miraland Labs](https://github.com/miraland-labs)
**Repository Hub**: [https://github.com/miraland-labs/x402](https://github.com/miraland-labs/x402)
