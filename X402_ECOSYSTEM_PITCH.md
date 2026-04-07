# 🚀 x402: The Economic Layer for Autonomous Agents

> [!NOTE]
> **Pre-Launch Environment:** Before the full platform announces "Go-Live", all development and testing connect to the **Solana Devnet** using our preview environment domain: `https://preview.agent.pay402.me`. The official product ecosystem relies on our dedicated `pay402.me` domain root.

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

The **Instant Micro-Payment Engine**. Operates via the exact-payment `exact` scheme. 

- **Use Case**: Sub-second, low-value transactions (inference-gating, API calls, data scraping).
- **Recommendation**: Best for payments **< $10 USDC**.
- **SplitVault Architecture**: Native SOL and SPL tokens are instantly and immutably split to the provider's logic-gated PDAs, generating absolute zero friction.

### 3. 🛡️ `SLA-Escrow` (The Enforcer)

The **Service Trust Engine**. Operates via the `sla-escrow` extension scheme.

- **Use Case**: High-stakes work, autonomous research, custom training, or any job spanning minutes to days where payment is contingent on success.
- **Recommendation**: Suggested for larger transactions **>= $10 USDC**.
- **Oracle-Adjudicated**: Funds are cryptographically locked until a verified domain-specific Oracle confirms delivery. 
- **Verdict-Neutral Tipping**: Oracles are tipped for their *work* of adjudication, eliminating bias.

### 4. 🔮 `oracle-qa` (API Response Quality Oracle)

The **First Official x402 Oracle** and open-source reference for the Oracle Economy.

- **Use Case**: Evaluates paid API responses against SLA contracts — status codes, latency, JSON Schema, required fields — and submits on-chain verdicts via `ConfirmOracle`.
- **For Oracle Developers**: `[oracle-qa](https://github.com/miraland-labs/oracle-qa)` is designed as a production-ready oracle and a **template for building domain-specific oracles** (ML model quality, uptime monitoring, content moderation, financial data accuracy, and more).
- **Architecture**: Standalone Rust/Axum/Tokio server with Solana WebSocket subscription, off-chain evidence fetching, deterministic SLA evaluation, and automated on-chain settlement.

---

## 🏗️ Why Build on x402?


| Feature            | x402 (Agent Native)                          | Legacy Rails (Human Native)           |
| ------------------ | -------------------------------------------- | ------------------------------------- |
| **Identity**       | Cryptographic Keypairs                       | Email / SSN / Phone                   |
| **Settlement**     | Instant (< 2s)                               | T+2 to T+5 Days                       |
| **Micro-Payments** | Native ($0.001+)                             | Blocked (High Fees)                   |
| **Security**       | Non-Custodial (Smart Contracts)              | Custodial (Banks/Intermediaries)      |
| **Logic**          | Programmatic (SLA/Oracle)                    | Manual (Refunds/Disputes)             |
| **Finality Model** | **Commitment-First (Reliable for 6h+ jobs)** | Fulfill-then-Settle (Risk of Failure) |


---

## 🏁 Get Started in Minutes

The x402 ecosystem is open-source and modular. You can start monetizing your AI services today.

1. **Deploy a Resource Provider**: Reference our `[x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter)` open-source demo to see how to gate your REST API with x402 headers. Or use our official paid services like `[spl-token balance verification](https://preview.spl-token.signer-payer.me/)` and `[aethervane-serverless](https://preview.aethervane.signer-payer.me/)` for production-grade API gating.
2. **Onboard Your AI Agents**: Start with the `[x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter)` to integrate the agentic payment lifecycle into your AI (supporting Bash, TypeScript, and Python).
3. **Build a Domain-Specific Oracle**: Fork `[oracle-qa](https://github.com/miraland-labs/oracle-qa)` as your starting point. It provides the complete chain-monitor → evaluate → settle pipeline; swap in your own evaluation logic for any domain (ML quality, uptime, content moderation, etc.).
4. **Integrate pr402**: Use the facilitator to verify that incoming requests have valid on-chain settlement proofs.
5. **Scale**: Join the growing network of agents and oracles transacting autonomously across the x402 protocol.

---

### 🌐 Join the Machine Economy

x402 isn't just a protocol; it's the foundation for the next stage of the internet. A world where agents don't just talk—they trade.

---

### 📂 Modular Architecture

The x402 ecosystem is composed of specialized, independent repositories. This modularity ensures we can iterate on the REST bridge and SDKs rapidly while keeping our core on-chain protocols hardened and stable.

**Explore the Ecosystem:**

- **[pr402 Facilitator](https://github.com/miralandlabs/pr402)**: The serverless-first REST Bridge (Open Source).
- **[UniversalSettle (SplitVault)](https://github.com/miraland-labs/universalsettle)**: High-velocity micro-payments (Planned Open Source).
- **[SLA-Escrow Protocol](https://github.com/miraland-labs/sla-escrow)**: Trustless oracle-backed escrow (Planned Open Source).
- **[oracle-qa](https://github.com/miraland-labs/oracle-qa)**: API Response Quality Oracle — first official oracle and reference implementation for oracle developers (Open Source).
- **[AetherVane Serverless](https://preview.aethervane.signer-payer.me/)**: Paid service for metaphysical data delivery (Closed Source).
- **[SPL-Token Balance Verification](https://preview.spl-token.signer-payer.me/)**: Paid service for API balance gating (Closed Source).
- **[x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter)**: Open-source reference for resource providers.
- **[x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter)**: Open-source reference for buyer agents and SDKs.

**Maintained by Miraland Labs & MiralandLabs.**