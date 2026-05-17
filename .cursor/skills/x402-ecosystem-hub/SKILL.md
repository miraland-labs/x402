---
name: x402-ecosystem-hub
description: >-
  Maps the x402 repository as a documentation and coordination hub (not a
  Cargo/workspace root) linking pr402, on-chain rails, the oracles workspace,
  starters, and paid-service examples. Use when navigating this repo, explaining
  ecosystem layout, locating project folders, or choosing which codebase to edit.
disable-model-invocation: true
---

# x402 ecosystem hub

## Verbatim ecosystem definition

x402 (see `x402/` folder—the repository root holding this `.cursor/skills/` tree) itself is a virtual hub project (NOT mono-workspace) which introduces several key projects under its x402 ecosystem:

1. pr402 Facilitator: which is x402 Facilitator implementation dedicated to Solana blockchain. (see `pr402/` folder), the project has its own github repo. Open Source.
2. universalsettle on-chain program: settlement rail for x402 `exact` scheme, usually for instant and small amount payment. (Planned Open Source)
3. sla-escrow on-chain program: settlement rail for x402 custom/extension schema `sla-escrow`, usually for relatively large amount with more delivery time payment. (Planned Open Source)
4. oracles workspace (`oracles/`), which is paired with the sla-escrow program and ships three sibling reference oracles (oracle-api-quality, oracle-onchain-transfer, oracle-file-delivery) sharing one oracle-common library. Each registers exactly one profile and serves as both a default oracle implementation when no other oracle service is available **and** an implementation reference for oracle developers with their own domain expertise. Open Source.
5. x402-seller-starter, an open source example project for any interested seller(Resource Provider)
6. x402-buyer-starter, an open source example project for any interested buyer agent(or human)
7. spl-token-balance-serverless project, which is a x402/pr402 based paid service which provides spl-token balance verification for any Solana wallets and tokens.
8. aethervane project, which is also a x402/pr402 based paid service which provides fortune teller services based on Eastern and Western ancient apporaches.

## Repo folder map

| Folder | Role |
|--------|------|
| `pr402/` | Solana x402 facilitator (Rust, Vercel); separate GitHub repo in production workflows |
| `universalsettle/` | On-chain SplitVault rail for `exact` (`api`, `program`, `cli`) |
| `sla-escrow/` | On-chain escrow rail for `sla-escrow` (`api`, `program`, `cli`) |
| `oracles/` | Multi-category oracle workspace (Rust/Axum); shared `oracle-common` plus three sibling binaries (`oracle-api-quality`, `oracle-onchain-transfer`, `oracle-file-delivery`) for SLA-Escrow |
| `x402-seller-starter/` | Seller RP example (Rust + Axum) |
| `x402-buyer-starter/` | Buyer demos (bash, TypeScript, Python) |
| `spl-token-balance-serverless/` | Paid SPL balance check service |
| `aethervane/` | Paid fortune-teller style reference (`aethervane-srv`, `aethervane-app`, `aethervane-shared`) |

## Documentation entrypoints

- Hub: [`README.md`](../../../README.md), [`ARCHITECTURE_OVERVIEW.md`](../../../ARCHITECTURE_OVERVIEW.md)
- Cross-program Devnet work: [`DEVNET_INTENSIVE_TEST_PLAN.md`](../../../DEVNET_INTENSIVE_TEST_PLAN.md), [`integration-tests/`](../../../integration-tests/)
- Follow project-local `README.md` for authoritative build and env instructions
