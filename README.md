# 🌐 x402 Ecosystem Hub: The Solana Agentic Economy

**x402** is a modular, trustless, and API-first financial stack built on the Solana blockchain. It provides the protocol and infrastructure needed for AI-to-AI resource settlement, enabling purely autonomous agents to trade compute, data, and services with cryptographic certainty.

> [!NOTE]
> **Pre-Launch Environment:** Before the full platform announces "Go-Live", all development and testing connect to the **Solana Devnet** using our preview environment domain: `https://preview.agent.pay402.me`. The official product ecosystem relies on our dedicated `pay402.me` domain root.

---

## 🏛️ The Pillars of x402

The ecosystem is composed of specialized, independent modules that work together to provide a seamless "Payment-Required" (HTTP 402) experience for the serverless age.

### 🌉 [pr402 Facilitator](https://github.com/miralandlabs/pr402)
*   **Role**: The Bridge (REST-to-Solana Gateway).
*   **Platform**: Rust / Vercel Serverless.
*   **What it does**: Handles vault discovery, transaction building, and payment verification for off-chain agents.

### ⚡ [UniversalSettle Protocol](https://github.com/miraland-labs/universalsettle)
*   **Role**: The Payout (SplitVault Engine).
*   **Platform**: Solana On-chain Program (Planned Open Source).
*   **What it does**: High-velocity, fixed-fee settlements via the `exact` scheme with automated revenue splitting. Ideal for immediate, low-latency micro-payments (**< $10 USDC** recommendation).

### 🛡️ [SLA-Escrow Protocol](https://github.com/miraland-labs/sla-escrow)
*   **Role**: The Enforcer (Service Level Agreement Trustee).
*   **Platform**: Solana On-chain Program (Planned Open Source).
*   **What it does**: Escrows funds via the `sla-escrow` scheme for high-value or long-running work. Suggested for payments **>= $10 USDC**. Requires domain-specific Oracles for verification (recruiting these Oracle developers is a key ecosystem goal).

### 💎 [Solana SPL-Token Balance Verification](https://preview.spl-token.signer-payer.me/)
*   **Role**: Miraland Labs Official Paid Service.
*   **Platform**: Rust / Vercel Serverless (Currently Closed Source).
*   **What it does**: A production-grade service provided officially by Miraland Labs. It demonstrates real-world API token-balance gating over x402.

### 🔮 [AetherVane Fortune Teller](https://preview.aethervane.signer-payer.me/)
*   **Role**: Reference Paid Service (Agentic Metaphysics).
*   **Platform**: Rust / Vercel Serverless (Closed Source).
*   **What it does**: Provides deterministic, machine-consumable Chinese metaphysical readings (Liu Yao, Mei Hua). Serves as a high-fidelity example of complex data payloads delivered over x402.

### ⚖️ [Oracle-QA: API Response Quality Oracle](https://github.com/miraland-labs/oracle-qa)
*   **Role**: First Official x402 Oracle & Reference Implementation for Oracle Developers.
*   **Platform**: Rust / Axum / Tokio (Standalone Server).
*   **What it does**: Monitors SLA-Escrow delivery events via Solana WebSocket, evaluates API response quality against SLA contracts (status codes, latency, JSON Schema, required fields), and submits on-chain verdicts. Designed as both a production-ready oracle and an open-source reference for developers building domain-specific oracles across any vertical.

### 📚 [Open-Source Seller Starter](https://github.com/miraland-labs/x402-seller-starter)
*   **Role**: Open-source Seller Reference.
*   **Platform**: Rust / Axum.
*   **What it does**: A minimal baseline for resource providers. Builds x402 v2 challenge JSON and verifies incoming settlement proofs.

### 🏹 [Open-Source Buyer Starter](https://github.com/miraland-labs/x402-buyer-starter)
*   **Role**: Open-source Buyer/Agent Reference.
*   **Platform**: Polyglot (Bash, TypeScript, Python).
*   **What it does**: The definitive onboarding tool for AI agents (MCP, OpenClaw). Demonstrates the full acquisition lifecycle (Challenge → Discovery → Build → Sign → Settle) with zero-dependency Bash and robust TS/Python SDKs.

---

## 📖 Global Documentation

*   **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)**: Deep dive into the technical pillars, transaction lifecycles, and security invariants.
*   **[Ecosystem Pitch](X402_ECOSYSTEM_PITCH.md)**: The marketing perspective on why x402 is the foundation for the next stage of the internet.

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
├── aethervane-serverless/   <-- Paid Service (Closed Source)
├── x402-seller-starter/    <-- Demo Reference (Open Source)
└── x402-buyer-starter/     <-- Agent SDK Reference (Open Source)
```

---

**Maintained by**: [Miraland Labs](https://github.com/miraland-labs) & [MiralandLabs](https://github.com/miralandlabs)
**Repository Hub**: [https://github.com/miraland-labs/x402](https://github.com/miraland-labs/x402)
