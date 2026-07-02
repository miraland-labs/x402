---
name: pr402-facilitator
description: >-
  Develops or integrates the Rust pr402 facilitator: x402 REST gateway for
  Solana, Vercel entrypoint `facilitator`, optional `facilitator-http` client
  SDK. Use when changing verify/settle/onboard flows, facilitator env config, or
  OpenAPI-aligned HTTP handlers under pr402/.
disable-model-invocation: true
---

# pr402 facilitator

## Purpose

Rust **x402 facilitator** dedicated to Solana: discovery, TX building (`build-exact-payment-tx`, `build-sla-escrow-payment-tx`), `verify`, `settle`, seller onboarding endpoints. Deployed serverlessly (see `pr402/vercel.json` and local `README.md`).

## Repo location

Authoritative open-source repo: **[miralandlabs/pr402](https://github.com/miralandlabs/pr402)** (individual GitHub account — not `miraland-labs`).

When working inside a local hub checkout, sources may appear under a sibling `pr402/` folder next to the [x402 hub](https://github.com/miraland-labs/x402); that folder is a **separate clone**, not part of a monorepo.

## Build & test hints

See skill [`x402-rust-solana-workflow`](../x402-rust-solana-workflow/SKILL.md).

Common variants:

```bash
git clone https://github.com/miralandlabs/pr402.git && cd pr402
cargo test
cargo build --release
cargo build --features facilitator-http # SDK / HTTP client feature
```

## Integration pointers

- Machine-readable surface: [ipay.sh/openapi.json](https://ipay.sh/openapi.json), `/api/v1/facilitator/capabilities`, health on `/api/v1/facilitator/health`.
- Buyer/seller narratives: [ipay.sh/agent-integration.md](https://ipay.sh/agent-integration.md), `/quickstart-*.md` on the deployment.
- On-chain coupling: consumes published `universalsettle-api` and `sla-escrow-api` crates ([miraland-labs/universalsettle](https://github.com/miraland-labs/universalsettle), [miraland-labs/sla-escrow](https://github.com/miraland-labs/sla-escrow)).
