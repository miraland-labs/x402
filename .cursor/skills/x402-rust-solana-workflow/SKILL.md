---
name: x402-rust-solana-workflow
description: >-
  Runs formatting, Clippy, tests, and builds for Rust crates and Solana program
  workspaces under the x402 hub. Use when editing any `Cargo.toml` project
  here, before proposing a PR, or when the user asks for fmt/clippy/test/build
  commands.
disable-model-invocation: true
---

# Rust / Solana workflow (x402 tree)

## Scope

Execute from the directory that contains the **workspace** or **crate** root `Cargo.toml` (examples: `pr402/`, `oracle-qa/`, `universalsettle/`, `sla-escrow/`, `spl-token-balance-serverless/`, `aethervane/`, `x402-seller-starter/`).

## Standard quality loop

Preferred order:

1. **Format (nightly toolchain)** — aligns with teams that rely on nightly `rustfmt` options:

```bash
cargo +nightly fmt --all
```

If nightly is unavailable, fall back to `cargo fmt --all` and note the deviation.

2. **Clippy — all targets (fail on warnings optional)**

```bash
cargo clippy --all-targets --all-features -- -D warnings
```

Drop `--all-features` if a crate documents mutually exclusive features. Omit `-D warnings` only when fixing pre-existing warnings is out of scope.

3. **Tests**

```bash
cargo test
```

For Solana **on-chain program** workspaces that document SBF/Lite tests (`universalsettle`, `sla-escrow`): also run the workflow the README names (commonly `cargo test-sbf` or the project’s Steel/Solana test script) when Solana tooling is installed.

4. **Release build** (bins or libs as needed)

```bash
cargo build --release
```

Package-specific binaries (examples from READMEs):

- `universalsettle`: `cargo build --release -p universalsettle-cli`
- `sla-escrow` admin CLI: `cargo build --release -p sla-escrow-cli --features admin`

## Workspace vs single crate

- Workspace roots list `members = [...]`; run commands at that root unless you intentionally target `-p package`.
- `pr402` is a single package with optional feature `facilitator-http`; use `--features facilitator-http` when compiling or testing SDK client code paths.
