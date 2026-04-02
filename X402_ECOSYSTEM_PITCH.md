# 🚀 x402: The Economic Layer for Autonomous Agents

### The Problem: Agents are Rich in Data, but Broke in Utility
AI Agents can browse the web, analyze gigabytes of data, and generate complex code. But until now, they couldn't **natively** pay for the resources they need to finish their jobs. 

Traditional payment rails (Stripe, Plaid, Credit Cards) are built for humans with KYCd bank accounts and 2FA-enabled smartphones. They were never designed for a machine that needs to pay $0.05 for a GPU inference cycle in 200 milliseconds.

---

### The Solution: x402 Ecosystem
x402 is an **API-first settlement stack** built on the Solana blockchain. It bridges the gap between RESTful web services and sub-second blockchain finality. 

We provide the infrastructure for an "Agentic Economy" where machines trade compute, data, and logic without human intervention.

---

## 🛠️ The x402 Technology Stack

Our ecosystem is composed of hardened, production-ready modules that handle the entire payment lifecycle:

### 1. 🌉 `pr402` (The Facilitator)
The "Interpreter" for the machine world. It exposes a standard REST API that AI Agents can call to discover on-chain terms, build transactions, and verify payments.
- **REST-Native**: No complex RPC management for agent developers.
- **Zero-Friction Onboarding**: Agents can discover their secure vaults via simple GET requests.
- **Sustainable BYOG Model**: Implements "Bring Your Own Gas," ensuring the infrastructure is self-sustaining and decentralized.

### 2. ⚡ `UniversalSettle` (SplitVault)
The "High-Velocity" payment engine. Designed for sub-second, low-value micro-transactions (inference-gating, API calls, data scraping).
- **SplitVault Architecture**: Native SOL and SPL tokens (USDC, USDT) are instantly and immutably split between the provider and the platform.
- **Non-Custodial**: Funds move directly to logic-gated PDAs, never touching a centralized middleman.

### 3. 🛡️ `SLA-Escrow` (The Enforcer)
The "Trust" engine for high-stakes work. Ideal for long-running autonomous research, custom training, or any job where payment is contingent on success.
- **Oracle-Adjudicated**: Funds are locked until a verified Oracle confirms job delivery.
- **Verdict-Neutral Tipping**: A breakthrough in incentive design—Oracles are tipped for their *work* of adjudication, not for the *outcome*, eliminating bias in the settlement process.

---

## 🏗️ Why Build on x402?

| Feature | x402 (Agent Native) | Legacy Rails (Human Native) |
| :--- | :--- | :--- |
| **Identity** | Cryptographic Keypairs | Email / SSN / Phone |
| **Settlement** | Instant (< 2s) | T+2 to T+5 Days |
| **Micro-Payments** | Native ($0.001+) | Blocked (High Fees) |
| **Security** | Non-Custodial (Smart Contracts) | Custodial (Banks/Intermediaries) |
| **Logic** | Programmatic (SLA/Oracle) | Manual (Refunds/Disputes) |
| **Finality Model** | **Commitment-First (Reliable for 6h+ jobs)** | Fulfill-then-Settle (Risk of Failure) |

---

## 🏁 Get Started in Minutes

The x402 ecosystem is open-source and modular. You can start monetizing your AI services today.

1.  **Deploy a Resource Provider**: Reference our `spl-token-balance-serverless` example to see how to gate your REST API with x402 headers.
2.  **Integrate pr402**: Use the facilitator to verify that incoming requests have valid on-chain settlement.
3.  **Scale**: Join the growing network of agents that are already transacting across the x402 protocol.

---

### 🌐 Join the Machine Economy
x402 isn't just a protocol; it's the foundation for the next stage of the internet. A world where agents don't just talk—they trade.

---

### 📂 Modular Architecture
The x402 ecosystem is composed of four specialized, independent repositories. This modularity ensures we can iterate on the REST bridge rapidly while keeping our core on-chain protocols hardened and stable.

**Explore the Ecosystem:**
- **[pr402 Facilitator](https://github.com/miralandlabs/pr402)**: The serverless-first REST Bridge.
- **[UniversalSettle (SplitVault)](https://github.com/miraland-labs/universalsettle)**: High-velocity micro-payments.
- **[SLA-Escrow Protocol](https://github.com/miraland-labs/sla-escrow)**: Trustless oracle-backed escrow.
- **[Reference Resource Provider](https://github.com/miralandlabs/spl-token-balance-serverless)**: Example serverless API gating.

**Maintained by Miraland Labs & MiralandLabs.**
