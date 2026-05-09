---
name: universalsettle-chain
description: >-
  Edits or audits the UniversalSettle Solana SplitVault program for x402 exact
  scheme settlement (api/program/cli layouts). Use when working in
  universalsettle/ or integrating exact-rail PDAs with pr402.
disable-model-invocation: true
---

# UniversalSettle (`exact` rail)

## Layout

Rust workspace [`universalsettle/`](../../../universalsettle/): `api/` (IDL-like API + builders), `program/` (`cdylib` on-chain), `cli/` (`universalsettle` binary).

## Commands (from workspace root)

```bash
cd universalsettle
cargo test
cargo build --release -p universalsettle-cli
```

Program-level SBF / `test-sbf` flows depend on installed Solana/Steel toolchain—follow [`universalsettle/README.md`](../../../universalsettle/README.md) and [`universalsettle/scripts/README.md`](../../../universalsettle/scripts/README.md).

## Semantics reminders

HTTP `POST /settle` on pr402 ≠ an on-chain “Settle” instruction; vault flow centers on **`CreateVault`**, **`Sweep`**, plus admin ops listed in README.

Formatting and Clippy: use [`x402-rust-solana-workflow`](../x402-rust-solana-workflow/SKILL.md).
