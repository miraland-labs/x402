# 🌐 x402 Ecosystem Hub: The Solana Agentic Economy

**x402** is a modular, trustless, and API-first financial stack built on the Solana blockchain. It provides the protocol and infrastructure needed for AI-to-AI resource settlement, enabling purely autonomous agents to trade compute, data, and services with cryptographic certainty.

---

## 🏛️ The 5 Pillars of x402

The ecosystem is composed of five specialized, independent modules that work together to provide a seamless "Payment-Required" (HTTP 402) experience for the serverless age.

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

### 💎 Official Paid Service (`spl-token-balance-serverless`)
*   **Role**: Miraland Labs Official Paid Service.
*   **Platform**: Rust / Vercel Serverless (may be closed source).
*   **What it does**: A premium, out-of-the-box service provided officially by Miraland Labs. It acts as a production-grade backend service demonstrating real-world API token-balance gating over x402.

### 📚 Open-Source Starter (`x402-seller-starter`)
*   **Role**: Open-source Seller Demo / Reference Implementation.
*   **Platform**: Rust / Axum (local or any host).
*   **What it does**: Your minimal open-source seller reference implementation. It builds x402 v2 `Payment Required` JSON and optionally calls pr402 `verify`/`settle` when the buyer sends `X-PAYMENT`. Use this as your copy-paste baseline to build your own resource provider.

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
├── spl-token-balance-serverless/ <-- Paid Service (May be Closed Source)
└── x402-seller-starter/   <-- Demo/Reference Implementation (Open Source)
```

---

**Maintained by**: [Miraland Labs](https://github.com/miraland-labs) & [MiralandLabs](https://github.com/miralandlabs)
**Repository Hub**: [https://github.com/miraland-labs/x402](https://github.com/miraland-labs/x402)
