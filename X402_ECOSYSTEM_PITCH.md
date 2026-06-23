# 🚀 x402: The Economic Layer for Autonomous Agents

> **Deployment status.** The facilitator is live on **Solana Mainnet** (`https://ipay.sh`) and **Solana Devnet** (`https://preview.ipay.sh`); the same service is also served on `https://agent.pay402.me` / `https://preview.agent.pay402.me` (not deprecated). Use the origin that matches your integration; verify at runtime with **`GET /api/v1/facilitator/health`**. Hub: [pr402 on GitHub](https://github.com/miralandlabs/pr402).
>
> **Human docs:** [docs.ipay.sh](https://docs.ipay.sh) — seller checklist, buyer quickstart, [Choosing x402 on Solana](https://docs.ipay.sh/pr402-vs-alternatives.html) (facilitators vs buyer tools).
>
> **Both rails are live.** **`exact`** (UniversalSettle) is GA for instant pay-per-call. **`sla-escrow`** is deployed on-chain with reference oracles and an open-source flagship seller — **[x402-buy-spl-token](https://github.com/miralandlabs/x402-buy-spl-token)**.
>

HTTP reserved **402 Payment Required** in 1997; production checkout on APIs is live again on Solana. Scripts, agents, and backends still cannot use card rails natively — and high-frequency API use breaks per-request pricing. x402 puts USDC settlement in the response layer; **pr402** is our facilitator that makes that loop REST-native.

---

### The solution: the x402 ecosystem

x402 is an **API-first settlement stack** built on the Solana blockchain. It bridges the gap between RESTful web services and sub-second blockchain finality.

We provide the infrastructure for an "agentic economy" where machines trade compute, data, and logic without human intervention.

---

## 🛠️ The x402 technology stack

The ecosystem is composed of hardened, production-deployed modules that handle the entire payment lifecycle.

### 1. 🌉 `pr402` (The Facilitator)

The "interpreter" for the machine world. It exposes a standard REST API that AI agents and sellers use to discover on-chain terms, build transactions, verify payments, and settle on-chain.

- **REST-native**: No complex RPC management for agent developers.
- **Two Solana rails**: **`exact`** + **`sla-escrow`** (buyer escrow — not offered by standard x402 facilitators on Solana today).
- **Preview mirror**: `preview.ipay.sh` matches production feature-for-feature for safe rehearsal.
- **Sustainable BYOG model**: Buyers typically pay network fees; optional sponsorship paths on supported builds.

### Agent discovery (Layer 3)

Sellers publish payable APIs via **Seller Resource Manifest** (`/.well-known/x402-resources.json`) and/or wallet-signed registration at **`/resources`**. Buyer agents search **`GET /api/v1/facilitator/resources`** (not `GET /providers`). See [pr402 DISCOVERY.md](https://github.com/miralandlabs/pr402/blob/main/docs/DISCOVERY.md) and **`@pr402/discovery`**.

### 2. ⚡ `UniversalSettle` (SplitVault)

The **instant payment engine** — operates via the **`exact`** scheme.

- Use case: pay-per-call APIs, inference gating, wallet analytics.
- **Reference seller**: **[solrisk](https://github.com/miralandlabs/solrisk)** — [`solrisk.signer-payer.me`](https://solrisk.signer-payer.me/) · `$0.05 USDC` wallet risk score per `GET /api/v1/wallet-risk`.

### 3. 🛡️ `SLA-Escrow` (The Enforcer)

The **conditional delivery engine** — operates via the **`sla-escrow`** scheme.

- Use case: fixed-price deliverables where buyers need escrow until proof of delivery (tokens, credits, jobs, files).
- **Reference seller**: **[x402-buy-spl-token](https://github.com/miralandlabs/x402-buy-spl-token)** — USDC escrow → SPL delivery → oracle-verified release; human storefront + agent API on [spl-token.hashspace.me](https://spl-token.hashspace.me).
- Oracle-adjudicated: funds release only after delivery on-chain and oracle `ConfirmOracle`.
- Verdict-neutral tipping: oracles paid for adjudication, not outcome.

### 4. 🔮 Oracle Workspace (multi-category reference oracles)

The **oracle layer for sla-escrow** — open-source references in [`miraland-labs/oracles`](https://github.com/miralandlabs/oracles).

- Three sibling binaries: **api-quality**, **onchain-transfer**, **file-delivery** on shared **oracle-common**.
- **x402-buy-spl-token** integrates **onchain-transfer** for SPL delivery verification.
- Fork a profile, swap evaluator logic, register your authority — compete on domain depth, not payment plumbing.

---

## 🏗️ Why build on x402?

| Feature            | x402 (Agent Native)                          | Legacy Rails (Human Native)           |
| ------------------ | -------------------------------------------- | ------------------------------------- |
| **Identity**       | Cryptographic keypairs                       | Email / SSN / phone                   |
| **Settlement**     | Instant (`exact`) or escrow (`sla-escrow`)   | T+2 to T+5 days                       |
| **Micro-payments** | Native (~5¢+ on pr402 with transparent fees) | Blocked (high fees)                   |
| **Security**       | Non-custodial (smart contracts)              | Custodial (banks / intermediaries)    |
| **Logic**          | Programmatic (SLA / oracle)                  | Manual (refunds / disputes)           |
| **Finality model** | **Commitment-first (reliable for long jobs)** | Fulfill-then-settle (risk of failure) |

---

## 🏁 Get started in minutes

The x402 ecosystem is open-source and modular.

| Goal | Start here |
|------|------------|
| **Sell with escrow** (tokens, deliverables) | Fork **[x402-buy-spl-token](https://github.com/miralandlabs/x402-buy-spl-token)** · live demo [preview.spl-token.hashspace.me](https://preview.spl-token.hashspace.me) |
| **Sell instant JSON API** | Fork **[solrisk](https://github.com/miralandlabs/solrisk)** · live [solrisk.signer-payer.me](https://solrisk.signer-payer.me/) · or **[x402-seller-starter](https://github.com/miralandlabs/x402-seller-starter)** |
| **Pay as a buyer agent** | `npm i -g @pr402/client` or **[x402-buyer-starter](https://github.com/miralandlabs/x402-buyer-starter)** |
| **Run an oracle** | **[oracles/](https://github.com/miralandlabs/oracles)** — clone closest profile |
| **Integrate pr402 only** | [docs.ipay.sh/start-here.html](https://docs.ipay.sh/start-here.html) |

**Operated examples (not open source):** [spl-token balance check](https://spl-token.signer-payer.me/) · [AetherVane](https://aethervane.hashspace.me/).

---

### Next step

Start with [docs.ipay.sh/start-here](https://docs.ipay.sh/start-here.html) to ship your first paid route.

### Rollout motion (updated)

1. **Open-source reference sellers** — **`x402-buy-spl-token`** (`sla-escrow`) and **`solrisk`** (`exact`) as cloneable proof points; Devnet rehearsal via **`preview.ipay.sh`** + **`preview.spl-token.hashspace.me`**.
2. **Seller docs** — [Start here · Seller checklist](https://docs.ipay.sh/start-here.html) and [Choosing x402 on Solana](https://docs.ipay.sh/pr402-vs-alternatives.html) published on docs.ipay.sh.
3. **Mainnet sellers** — promote **`exact`** for instant APIs; promote **`sla-escrow`** where buyers need escrow (token shops, jobs, file delivery).
4. **Oracle ecosystem** — grow vertical oracles atop [`oracles/`](https://github.com/miraland-labs/oracles); register authorities in pr402 discovery.
5. **Operated services** — spl-token balance + AetherVane remain live **`exact`** examples; new builders should fork **solrisk** or **x402-buy-spl-token** instead.

---

### 📂 Modular architecture

The x402 ecosystem is composed of specialized, independent repositories.

**Infrastructure (Miraland Labs operates — open source where noted):**

- **[pr402 Facilitator](https://github.com/miralandlabs/pr402)** — serverless REST bridge (Open Source).
- **UniversalSettle** · **SLA-Escrow** — on-chain programs (Planned Open Source).
- **[oracles/](https://github.com/miraland-labs/oracles)** — oracle workspace (Open Source).

**Reference sellers (Open Source — fork these):**

- **[x402-buy-spl-token](https://github.com/miralandlabs/x402-buy-spl-token)** — **`sla-escrow`** · SPL token shop + storefront.
- **[solrisk](https://github.com/miralandlabs/solrisk)** — **`exact`** · wallet risk scoring · [solrisk.signer-payer.me](https://solrisk.signer-payer.me/)

**Starters:**

- **[x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter)** · **[x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter)**.

**Operated only (closed source):**

- **[SPL-Token Balance](https://spl-token.signer-payer.me/)** · **[AetherVane](https://aethervane.hashspace.me/)**.

---

**Maintained by Miraland Labs.**
