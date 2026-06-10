# Requirements Document — Mintforge (as built)

## Introduction

**Mintforge** is a pay-per-use **BYOI NFT minting** service for autonomous agents and humans. Buyers pay via x402 v2 on Solana; Mintforge uploads metadata to IPFS (Pinata) and mints Metaplex Core assets. **There is no AI image generation** in the current product scope.

- **Repo:** [github.com/miralandlabs/mintforge](https://github.com/miralandlabs/mintforge) (standalone; not an x402 monorepo member for deployment)
- **Runtime:** Rust / Tokio / Axum, SQLite WAL, systemd + Docker on VPS
- **Payments:** pr402 facilitator (verify + settle)
- **Storage:** Pinata required; optional Arweave via Irys

---

## Glossary

| Term | Meaning |
|------|---------|
| **Buyer** | Agent or human paying x402 and calling the API |
| **Merchant wallet** | `X402_MERCHANT_WALLET` — seller identity, vault derivation |
| **Hot wallet** | Keypair signing on-chain txs and paying rent |
| **BYOI** | Bring Your Own Image — buyer supplies URL or multipart upload |
| **Service tier** | Priced x402 resource (`upload-mint`, etc.) |
| **Mint job** | Async work unit: upload + mint, tracked in SQLite |
| **Payment receipt** | Verified payment record for idempotency |

---

## Requirement 1: x402 payment gate

1. Chargeable endpoints without `PAYMENT-SIGNATURE` return HTTP 402 with x402 v2 `accepts` for the resolved tier.
2. With signature: verify (and settle) via facilitator within configured timeout.
3. Failed verification → 402; request not processed.
4. Idempotency key = SHA-256(signature ‖ canonical path); duplicate → original success response.
5. Successful chargeable responses include `PAYMENT-RESPONSE`.
6. `GET /.well-known/x402-resources.json` lists enrolled resources without payment.

---

## Requirement 2: BYOI mint

1. `POST /api/v1/mint` accepts JSON (`image_url` or existing `media_asset_id`) or `multipart/form-data` (`image` file).
2. Tier `upload-mint` unless `soulbound: true` → tier `soulbound-mint`.
3. Validates `receiver_wallet`, image size (max 10MB), content type, and SSRF-safe URL fetch.
4. Returns HTTP 202 with `job_id`; mint completes asynchronously.
5. `GET /api/v1/jobs/{job_id}` is free and returns status until `confirmed` or `failed`.
6. Default update authority: transfer to owner; optional `retain_engine` for managed assets.
7. Soulbound: one active soulbound identity per wallet (DB constraint + application check).
8. Multipart supports the same fields as JSON including `soulbound`, `agent_manifest`, collection options.

---

## Requirement 3: Managed NFT operations

1. **Metadata update** — `PATCH /api/v1/assets/{mint}/metadata` when engine retained authority; payer must be owner.
2. **Receipt mint** — `POST /api/v1/mint/receipt` with job hashes; deterministic receipt PNG; forced `retain_engine`.
3. **Access pass** — `POST /api/v1/mint/access-pass` with expiry; forced `retain_engine`.
4. **Verify access** — free `GET /api/v1/verify-access/{mint}`.
5. **Revoke** — `POST /api/v1/assets/{mint}/revoke-access`; payer must be merchant wallet.

---

## Requirement 4: Pricing

1. Six tiers (see design doc) each require `X402_ACCEPTS_JSON` in SQLite or env fallback.
2. Startup fails if any tier is missing pricing (`validate_pricing_config`).
3. Accepts JSON supports `usdc` and `spl` kinds (same pattern as sibling x402 services).
4. Per-cluster USDC mint (devnet vs mainnet) enforced at payment gate.
5. Operator seeds via `scripts/docker/seed-parameters.sh`; edits via host `sqlite3` CLI.

---

## Requirement 5: Job processing

1. Jobs stored in SQLite `mint_jobs`; no Redis.
2. Worker pool claims jobs atomically (`BEGIN IMMEDIATE`).
3. Pipeline: fetch/validate image → Pinata upload → Metaplex Core mint → update status.
4. Configurable concurrency (`JOB_QUEUE_CONCURRENCY`).
5. Failed jobs record error reason; payment idempotency prevents double charge on retry with same signature.

---

## Requirement 6: Storage

1. Pinata JWT or API key + secret **required** at startup.
2. Image and metadata JSON uploaded before mint tx.
3. Optional Irys when `ARWEAVE_ENABLED` and key present.
4. Local upload files cleaned per `DATA_RETAIN_DAYS` under `uploads/` only.

---

## Requirement 7: Health & observability

1. `GET /health` returns 200 when SQLite reachable; 503 when not.
2. Response includes `version` and `cluster`.
3. Structured logging via `tracing` / `RUST_LOG`.

---

## Requirement 8: Deployment

1. Docker image built from repo root (`scripts/docker/Dockerfile`).
2. systemd units per cluster; host-mounted SQLite data and hot wallet secret.
3. nginx optional for TLS; app binds loopback by default.
4. Dual cluster: isolated DB, secrets, image tags, ports.
5. Rollback via `:previous` image tag on failed health check.

---

## Requirement 9: Discovery & capabilities

1. `GET /api/v1/capabilities` documents primary BYOI flow, image limits, NFT operations, per-tier prices, facilitator URL, `pay_to`.
2. No generative provider listings.
3. Public rate limit on free discovery endpoints.

---

## Requirement 10: Security

1. Block SSRF on user `image_url` (private/link-local IPs after DNS resolve).
2. Disable HTTP redirects on outbound image fetch.
3. Restrict local file reads to data directory for worker paths.
4. 12 MB global request body limit.
5. Trusted proxy configuration for rate-limit client IP.

---

## Out of scope (removed)

The following were in earlier drafts and are **not** implemented:

- `POST /api/v1/generate`, `POST /api/v1/generate-and-mint`
- Free/premium AI providers (Pollinations, HuggingFace, fal, Replicate, OpenAI)
- Redis job queue
- Tiers: `free-gen`, `premium-gen`, `free-gen-mint`, `premium-gen-mint`
- External `x402-seller-starter` dependency

---

## Agent flow (BYOI)

1. `GET /.well-known/x402-resources.json` or `/api/v1/capabilities` → discover `upload-mint` price
2. Pay for `upload-mint` tier
3. `POST /api/v1/mint` with image + `receiver_wallet`
4. Poll `GET /api/v1/jobs/{job_id}` until `confirmed`
5. Use returned `mint_address`, `metadata_uri`, `explorer_url`

Soulbound agents: same flow with `soulbound: true` and `agent_manifest`; pay `soulbound-mint` tier.
