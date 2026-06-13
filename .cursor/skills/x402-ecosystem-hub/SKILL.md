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
7. x402-buy-spl-token, open source **sla-escrow** reference seller (SPL token shop + human storefront; github.com/miralandlabs/x402-buy-spl-token)
8. solrisk, open source **exact** reference seller (wallet risk scoring API; [solrisk.signer-payer.me](https://solrisk.signer-payer.me/); github.com/miralandlabs/solrisk)
9. spl-token-balance-serverless project, operated paid service — SPL balance verification (closed source)
10. aethervane project, operated paid service — fortune teller readings (closed source)
11. rwa-issuer-portal — RWA KYC system of record (open source, Vercel)
12. rwa-kyc-sync — RWA ops sync worker: portal feed → on-chain KycRecord (open source, VPS)
13. rwa-kyc-hook — multi-issuer Token-2022 Transfer Hook (open source, on-chain)
14. x402-buy-rwa-token — RWA primary issuance seller (open source, sla-escrow)
15. oracle-rwa-transfer — RWA delivery oracle (in oracles workspace)

## Repo folder map

| Folder | Role |
|--------|------|
| `pr402/` | Solana x402 facilitator (Rust, Vercel); separate GitHub repo in production workflows |
| `universalsettle/` | On-chain SplitVault rail for `exact` (`api`, `program`, `cli`) |
| `sla-escrow/` | On-chain escrow rail for `sla-escrow` (`api`, `program`, `cli`) |
| `oracles/` | Multi-category oracle workspace (Rust/Axum); shared `oracle-common` plus three sibling binaries (`oracle-api-quality`, `oracle-onchain-transfer`, `oracle-file-delivery`) for SLA-Escrow |
| `x402-seller-lab-express/` | **Hands-on lab** — TypeScript + Express weather API (exact pay-per-call) |
| `x402-seller-starter/` | Seller RP example (Rust + Axum) |
| `x402-buyer-starter/` | Buyer demos (bash, TypeScript, Python) |
| `x402-buy-spl-token/` | **sla-escrow** reference seller — SPL shop (open source) |
| `solrisk/` | **exact** reference seller — wallet risk API (open source) |
| `spl-token-balance-serverless/` | Operated SPL balance check (closed source) |
| `aethervane/` | Operated readings API (closed source) |
| `rwa-issuer-portal/` | RWA KYC portal — records only (open source, Vercel) |
| `rwa-kyc-sync/` | RWA ops sync worker — portal → hook CLI (open source, VPS) |
| `rwa-kyc-hook/` | RWA Transfer Hook on-chain program (open source) |
| `x402-buy-rwa-token/` | RWA primary issuance seller (open source) |

## Documentation entrypoints

- Hub: [`README.md`](../../../README.md), [`ARCHITECTURE_OVERVIEW.md`](../../../ARCHITECTURE_OVERVIEW.md), [`RWA_OPS_RUNBOOK.md`](../../../RWA_OPS_RUNBOOK.md)
- Cross-program Devnet work: [`DEVNET_INTENSIVE_TEST_PLAN.md`](../../../DEVNET_INTENSIVE_TEST_PLAN.md), [`integration-tests/`](../../../integration-tests/)
- Follow project-local `README.md` for authoritative build and env instructions
