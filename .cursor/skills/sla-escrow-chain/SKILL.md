---
name: sla-escrow-chain
description: >-
  Edits or audits the SLA-Escrow Solana program for x402 sla-escrow scheme:
  escrow funding, oracle confirmation, refunds/releases. Use when working in
  sla-escrow/ or pairing oracle / facilitator metadata with escrow PDAs.
disable-model-invocation: true
---

# SLA-Escrow (`sla-escrow` rail)

## Layout

Rust workspace [`sla-escrow/`](../../../sla-escrow/): `api/` (types, events, `EscrowSdk`), `program/`, `cli/` (`sla-escrow`).

## Commands (from workspace root)

```bash
cd sla-escrow
cargo test
cargo build --release -p sla-escrow-cli --features admin
```

Cross-project checklist before risky releases: README points to hub Devnet docs and `cargo clippy --all-targets` + full tests.

Facilitator HTTP flows live in [`pr402`](../pr402-facilitator/SKILL.md) (`build-sla-escrow-payment-tx`, verify, settle)—do not duplicate wire formats here.

Rust quality defaults: [`x402-rust-solana-workflow`](../x402-rust-solana-workflow/SKILL.md).
