# 🌐 x402 Ecosystem Hub: The Solana Agentic Economy

**x402** is a modular, trustless, and API-first financial stack built on the Solana blockchain. It provides the protocol and infrastructure needed for AI-to-AI resource settlement, enabling purely autonomous agents to trade compute, data, and services with cryptographic certainty.

---

## 🏛️ The 4 Pillars of x402

The ecosystem is composed of four specialized, independent modules that work together to provide a seamless "Payment-Required" (HTTP 402) experience for the serverless age.

### 🌉 [pr402 Facilitator](https://github.com/miralandlabs/pr402)
*   **Role**: The Bridge (REST-to-Solana Gateway).
*   **Platform**: Rust / Vercel Serverless.
*   **What it does**: Handles vault discovery, transaction building, and payment verification for off-chain agents.

### ⚡ [UniversalSettle Protocol](https://github.com/miraland-labs/universalsettle)
*   **Role**: The Payout (SplitVault Engine).
*   **Platform**: Solana On-chain Program(Planned Open Source).
*   **What it does**: High-velocity, fix-fee settlements with automated revenue splitting and 0-data SOL storage.

### 🛡️ [SLA-Escrow Protocol](https://github.com/miraland-labs/sla-escrow)
*   **Role**: The enforcer (Service Level Agreement Trustee).
*   **Platform**: Solana On-chain Program(Planned Open Source).
*   **What it does**: Oracle-adjudicated escrows with verdict-neutral tipping and "Bring Your Own Gas" (BYOG) defaults.

### 💎 [Reference Resource Provider](https://github.com/miralandlabs/spl-token-balance-serverless)
*   **Role**: The Service (Gated API Example).
*   **Platform**: Rust / Vercel Serverless.
*   **What it does**: Demonstrates how to gate a real-world API using the x402 protocol headers.

### 📚 **x402-seller-starter** (this hub folder)
*   **Role**: Minimal open-source seller reference (library + Axum example).
*   **Platform**: Rust / Axum (local or any host).
*   **What it does**: Builds x402 v2 `Payment Required` JSON from env and optionally calls pr402 `verify`/`settle` when the buyer sends `X-PAYMENT`. Apache-2.0, fee-free—use as a copy-paste baseline; see **`x402-seller-starter/README.md`**.

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
├── pr402/                  <-- Independent Repo
├── universalsettle/        <-- Independent Repo
├── sla-escrow/             <-- Independent Repo
├── spl-token-balance-serverless/ <-- Independent Repo
└── x402-seller-starter/   <-- Open seller reference (library + Axum example; optional own repo)
```

---

**Maintained by**: [Miraland Labs](https://github.com/miraland-labs) & [MiralandLabs](https://github.com/miralandlabs)
**Repository Hub**: [https://github.com/miraland-labs/x402](https://github.com/miraland-labs/x402)
