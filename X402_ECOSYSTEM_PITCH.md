# 🚀 x402: The Economic Layer for Autonomous Agents

> **Deployment status.** The facilitator is live on **Solana Mainnet** (`https://ipay.sh`) and **Solana Devnet** (`https://preview.ipay.sh`); the same service is also served on `https://agent.pay402.me` / `https://preview.agent.pay402.me` (not deprecated). Use the origin that matches your integration; verify at runtime with **`GET /api/v1/facilitator/health`**. Hub: [pr402 on GitHub](https://github.com/miralandlabs/pr402).
>
> The `exact` (UniversalSettle) rail is production-ready today. The `sla-escrow` rail is deployed on-chain; general availability for sellers/buyers is gated on a production-advertised default oracle (work in flight on [`oracle-qa`](https://github.com/miraland-labs/oracle-qa)).

### The problem: Agents are rich in data, but broke in utility

AI agents can browse the web, analyze gigabytes of data, and generate complex code. But until now, they couldn't **natively** pay for the resources they need to finish their jobs.

Traditional payment rails (Stripe, Plaid, credit cards) are built for humans with KYC'd bank accounts and 2FA-enabled smartphones. They were never designed for a machine that needs to pay $0.05 for a GPU inference cycle in 200 milliseconds.

---

### The solution: the x402 ecosystem

x402 is an **API-first settlement stack** built on the Solana blockchain. It bridges the gap between RESTful web services and sub-second blockchain finality.

We provide the infrastructure for an "agentic economy" where machines trade compute, data, and logic without human intervention.

---

## 🛠️ The x402 technology stack

The ecosystem is composed of hardened, production-deployed modules that handle the entire payment lifecycle.

### 1. 🌉 `pr402` (The Facilitator)

The "interpreter" for the machine world. It exposes a standard REST API that AI agents can call to discover on-chain terms, build transactions, and verify payments.

- **REST-native**: No complex RPC management for agent developers.
- **Zero-friction onboarding**: Agents discover their secure vaults via simple GET requests.
- **Sustainable BYOG model**: Implements "Bring Your Own Gas," ensuring the infrastructure is self-sustaining and decentralized.

### 2. ⚡ `UniversalSettle` (SplitVault)

The **instant micro-payment engine** — operates via the exact-payment `exact` scheme.

- Use case: sub-second, low-value transactions (inference-gating, API calls, data scraping).
- Recommendation: best for payments **< $10 USDC**.
- SplitVault architecture: Native SOL and SPL tokens are instantly and immutably split to the provider's logic-gated PDAs, generating absolute zero friction.

### 3. 🛡️ `SLA-Escrow` (The Enforcer)

The **service trust engine** — operates via the `sla-escrow` extension scheme.

- Use case: high-stakes work, autonomous research, custom training, or any job spanning minutes to days where payment is contingent on success.
- Recommendation: suggested for payments **>= $10 USDC**.
- Oracle-adjudicated: funds are cryptographically locked until a verified oracle authority confirms delivery (the on-chain program requires `delivery_timestamp > 0` before any verdict is accepted).
- Verdict-neutral tipping: oracles receive a programmable tip on both release and refund paths — paid for adjudication, not outcome.

### 4. 🔮 `oracle-qa` (API Response Quality Oracle)

The **first official x402 oracle** and open-source reference for the oracle economy.

- Use case: Evaluates paid API responses against SLA contracts — status codes, latency, JSON Schema, required fields — and submits on-chain verdicts via `ConfirmOracle`.
- For oracle developers: [`oracle-qa`](https://github.com/miraland-labs/oracle-qa) is designed as a production candidate oracle *and* a **template for building domain-specific oracles** (ML model quality, uptime monitoring, content moderation, financial data accuracy, and more).
- Architecture: standalone Rust/Axum/Tokio server with Solana WebSocket subscription, off-chain evidence fetching, deterministic SLA evaluation, and automated on-chain settlement.

---

## 🏗️ Why build on x402?


| Feature            | x402 (Agent Native)                          | Legacy Rails (Human Native)           |
| ------------------ | -------------------------------------------- | ------------------------------------- |
| **Identity**       | Cryptographic keypairs                       | Email / SSN / phone                   |
| **Settlement**     | Instant (< 2s)                               | T+2 to T+5 days                       |
| **Micro-payments** | Native ($0.001+)                             | Blocked (high fees)                   |
| **Security**       | Non-custodial (smart contracts)              | Custodial (banks / intermediaries)    |
| **Logic**          | Programmatic (SLA / oracle)                  | Manual (refunds / disputes)           |
| **Finality model** | **Commitment-first (reliable for 6h+ jobs)** | Fulfill-then-settle (risk of failure) |

---

## 🏁 Get started in minutes

The x402 ecosystem is open-source and modular. You can start monetizing your AI services today.

1. **Deploy a resource provider** — reference [`x402-seller-starter`](https://github.com/miraland-labs/x402-seller-starter) to see how to gate your REST API with x402 headers. Live references operated by Miraland Labs: [spl-token balance verification](https://spl-token.signer-payer.me/) and [AetherVane](https://aethervane.hashspace.me/).
2. **Onboard your AI agents** — install the buyer SDK (`npm i @pr402/client` or `cargo install pr402-client`, both ship `pr402-buy`). Reference: [`x402-buyer-starter`](https://github.com/miraland-labs/x402-buyer-starter).
3. **Build a domain-specific oracle** — fork [`oracle-qa`](https://github.com/miraland-labs/oracle-qa) as your starting point. It provides the complete chain-monitor → evaluate → settle pipeline; swap in your own evaluation logic.
4. **Integrate pr402** — use the facilitator to verify that incoming requests have valid on-chain settlement proofs.
5. **Scale** — join the growing network of agents and oracles transacting autonomously across the x402 protocol.

---

### 🌐 Join the machine economy

x402 isn't just a protocol; it's the foundation for the next stage of the internet. A world where agents don't just talk — they trade.

### Rollout motion

1. **Design partners** — onboard a small set of sellers and buyer-agent teams on preview, using `x402-seller-starter`, `x402-buyer-starter`, and the paid SPL-token balance service as the first reproducible path.
2. **Devnet campaign** — publish copy-paste buyer/seller quickstarts, run public demos against `https://preview.ipay.sh`, and measure first build, first verify, first settle, and first seller onboarding.
3. **Mainnet seller launch** — promote `exact` for low-value instant API calls; enable `sla-escrow` for sellers advertising a production oracle authority (starting with the hardened `oracle-qa` deployment).
4. **Oracle ecosystem** — treat `oracle-qa` as the default API-quality oracle and a reference for domain-oracle developers; publish profile ids, evidence rules, and trust tiers so buyers can choose authorities intentionally.
5. **Paid-service proof points** — market SPL-token balance verification as the utilitarian API reference and AetherVane as the experience reference: both show how humans and autonomous agents discover a seller, receive HTTP 402, pay through pr402, and parse a structured premium response.

---

### 📂 Modular architecture

The x402 ecosystem is composed of specialized, independent repositories. This modularity lets us iterate on the REST bridge and SDKs rapidly while keeping the on-chain protocols hardened and stable.

**Explore the ecosystem:**

- **[pr402 Facilitator](https://github.com/miralandlabs/pr402)** — the serverless-first REST bridge (Open Source).
- **UniversalSettle (SplitVault)** — high-velocity micro-payments. Planned Open Source; deployed on Mainnet and Devnet.
- **SLA-Escrow Protocol** — trustless oracle-backed escrow. Planned Open Source; deployed on Mainnet and Devnet.
- **[oracle-qa](https://github.com/miraland-labs/oracle-qa)** — API response quality oracle; first official oracle and reference for domain-oracle developers (Open Source).
- **[AetherVane](https://aethervane.hashspace.me/)** — reference paid service (closed source).
- **[SPL-Token Balance Verification](https://spl-token.signer-payer.me/)** — reference paid service (closed source).
- **[x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter)** — open-source reference for resource providers.
- **[x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter)** — open-source reference for buyer agents and SDKs.

**Maintained by Miraland Labs.**
