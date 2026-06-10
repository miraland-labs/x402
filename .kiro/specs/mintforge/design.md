# Design Document — Mintforge (as built)

## Overview

**Mintforge** is a standalone Rust repo ([miralandlabs/mintforge](https://github.com/miralandlabs/mintforge)): a single-binary Axum HTTP service for **BYOI (Bring Your Own Image) NFT minting** on Solana, gated by x402 v2 micropayments via the pr402 facilitator.

**Production scope:** upload/soulbound mint, managed metadata updates, receipt mints, access passes, and access revocation. **AI image generation is not implemented** and not deployed.

### Design goals

1. **Agent-first payments** — HTTP 402 discovery, pay, retry; no buyer accounts.
2. **Low operational surface** — one binary, SQLite (no Redis, no Postgres), Pinata for IPFS.
3. **Dual cluster** — devnet and mainnet via `SOLANA_CLUSTER` and separate VPS data dirs.
4. **Deploy parity with oracles** — `scripts/docker/` layout mirrors sibling projects.

## High-level flow

```
Buyer → POST /api/v1/mint (+ optional PAYMENT-SIGNATURE)
     → PaymentGate (402 | verify | settle | idempotency)
     → SQLite mint_jobs (pending) + Notify workers
     → Pinata upload → Metaplex Core mint (hot wallet)
     → GET /api/v1/jobs/{id} (free poll)
```

## Technology stack

| Concern | Choice |
|---------|--------|
| Runtime | `tokio 1.49` |
| HTTP | `axum 0.8`, `tower-http` (trace, body limit) |
| SQLite | `deadpool-sqlite 0.12`, `rusqlite 0.37` (bundled) |
| HTTP client | `reqwest 0.12` (rustls, redirects disabled for SSRF) |
| Solana | `solana-client` / `solana-sdk 3.0`, `mpl-core 0.12` |
| x402 | Inlined in `src/x402/` (wire, facilitator, gate) |
| Receipt images | `resvg` / `usvg` (deterministic PNG) |

No Redis, no external `x402-seller-starter` crate.

## Module structure

```
mintforge/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── config.rs
│   ├── state.rs
│   ├── pricing.rs          # 6 ServiceTier variants
│   ├── authority.rs
│   ├── pipeline.rs
│   ├── validate.rs
│   ├── x402/               # gate, wire, facilitator
│   ├── routes/             # mint, assets, receipt, access_pass, …
│   ├── worker/             # mint_worker, cleanup
│   ├── storage/            # pinata, optional irys, receipt_image
│   ├── mint/
│   └── db/
├── scripts/docker/         # sole deploy path
└── docs/ARCHITECTURE.md
```

## AppState

Built at startup:

- Resolve `pay_to` (vault PDA from merchant or `X402_PAY_TO`)
- **Require Pinata** credentials
- Open SQLite, load cluster config, hot wallet keypair
- HTTP client with redirect policy `none`

## Payment gate

Implemented in handlers via `PaymentGate::check`, not a global Tower layer.

1. No signature → build 402 from tier `accepts` (SQLite parameters)
2. Verify + settle via facilitator
3. Idempotency on `(signature, path)`; conflict → cached body
4. Response includes `PAYMENT-RESPONSE` on success

## Job queue

- Table: `mint_jobs` with status transitions
- Workers: `claim_next_pending` under `BEGIN IMMEDIATE`
- Wake: `tokio::sync::Notify` after insert
- Concurrency: `JOB_QUEUE_CONCURRENCY` (default 4)
- Panic recovery: supervisor restarts worker tasks

## Storage

- **Pinata** (required): image + metadata JSON → IPFS URIs
- **Irys/Arweave** (optional): `ARWEAVE_ENABLED` + key; chain tries Irys then Pinata
- Local uploads under `MINTFORGE_DATA_DIR/uploads/`; cleanup by `DATA_RETAIN_DAYS`

## Service tiers & routes

| Tier ID | Route |
|---------|-------|
| `upload-mint` | `POST /api/v1/mint` |
| `soulbound-mint` | `POST /api/v1/mint` (`soulbound: true`) |
| `metadata-update` | `PATCH /api/v1/assets/{mint}/metadata` |
| `receipt-mint` | `POST /api/v1/mint/receipt` |
| `access-pass-mint` | `POST /api/v1/mint/access-pass` |
| `revoke-access` | `POST /api/v1/assets/{mint}/revoke-access` |

Pricing: SQLite `parameters` (`service=mintforge`, `endpoint=<tier id>`, `param_name=X402_ACCEPTS_JSON`). Startup validates all six tiers.

## Update authority

| Policy | Endpoints | Default |
|--------|-----------|---------|
| `DefaultTransfer` | BYOI / soulbound mint | `transfer_to_owner`; optional `retain_engine` |
| `ForcedRetain` | receipt, access-pass | always `retain_engine` |

Metadata PATCH requires engine authority + payer == owner. Revoke requires payer == merchant.

## Security

- SSRF: `validate_fetchable_url` on user `image_url` (DNS, private IP block)
- No HTTP redirects on outbound fetch
- `file://` blocked for user-supplied URLs
- Rate limit on public routes; trusted proxy IPs for client IP
- 12 MB request body cap

## Deployment

All artifacts under `scripts/docker/`:

- **`mintforge-bootstrap.sh`** — fresh VPS one-liner (clone + install)
- `mintforge-install.sh`, `mintforge-deploy.sh`, `seed-parameters.sh`
- `parameters-seed-{devnet,mainnet}.sql` (6 rows each)
- `x402-resources.json` (6 resources)
- systemd units, nginx helper, Dockerfile (build context = repo root)

Dual cluster on one host: separate env, DB, secrets, ports (8081 devnet, 8091 mainnet). Mirrors oracle layout (4021/4031).

## Health

`GET /health` → 200 if SQLite OK; 503 if DB down. No queue health check (queue is SQLite).

## Intentionally removed

- Generative routes and `EngineProvider` trait implementations
- Redis LIST / BLPOP queue
- Premium provider stubs
- `deploy/` duplicate tree (use `scripts/docker/` only)

## Discovery

- `GET /api/v1/capabilities` — tiers, prices, primary BYOI flow, NFT ops
- `GET /.well-known/x402-resources.json` — pr402 enrollment manifest
