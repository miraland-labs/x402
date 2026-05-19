# Implementation Plan: Buy SPL Token Endpoint

## Overview

Add a paid `GET /api/v1/buy-spl-token` endpoint to the existing `spl-token-balance` Vercel
service. The endpoint returns a 402 challenge with a server-built TransferSla on the unpaid
path, and on the paid path runs `verify_and_settle` → SPL `TransferChecked` → evidence upload
→ `SubmitDelivery`, with Postgres-backed idempotency on `payment_uid` and an advisory lock
guarding concurrent retries.

Reused without modification: `FacilitatorClient::verify_and_settle`,
`PaymentHandler::check_payment`, `RetryPolicy` from `src/rpc_retry.rs`, and the 402 / CORS /
`X-API-Version` response envelope from the existing `check_balance` endpoint.

Test command: `cargo test -p spl-token-balance`

Tasks are ordered by dependency. Sibling tasks at the same wave (see Task Dependency Graph)
can be executed in parallel.

## Tasks

- [x] 1. Implement Token Catalog module (`src/catalog.rs`)
  - Define `CatalogEntry { mint, decimals, price_usdc_ui, name, sender_treasury_ata }` and
    `TokenCatalog` types with `serde` derives.
  - Implement env-driven loader from `BUY_SPL_TOKEN_CATALOG_JSON` with optional Postgres
    `parameters`-row override (reuse `src/parameters.rs` and `src/db.rs`).
  - Validate each entry: `mint` is base58 pubkey, `decimals ∈ [0, 18]`, `price_usdc_ui` is a
    positive decimal, and `price_usdc_ui` fractional digits ≤ `decimals`.
  - Implement `Catalog::validate_against_chain(rpc, retry)` that fetches each Mint account
    via the configured Solana RPC under `RetryPolicy` and asserts on-chain `decimals` matches
    the configured value.
  - Surface fail-fast `CatalogError` variants for missing env, parse failure, invalid mint,
    decimals out-of-range, non-positive price, fractional-digit overflow, decimals mismatch,
    and unreachable mint (each carries enough detail for the offending entry to be named).
  - [x] 1.1 Unit tests for catalog parsing and validation
    - Happy path, invalid mint, out-of-range decimals, non-positive price, fractional digits
      exceeding decimals, missing env (no Postgres override), Postgres override beats env.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.3_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 8.1, 8.3_

- [x] 2. Implement Seller Signer module (`src/seller_signer.rs`)
  - Load the seller `Keypair` from `SELLER_KEYPAIR_BASE58` exactly once at cold start; expose
    `SellerSigner { keypair: Arc<Keypair> }` with `pubkey()` and `sign_message()` helpers.
  - Map missing env, base58 decode failure, and invalid keypair length to a typed
    `SellerSignerError` that aborts startup.
  - Document that the same `Arc<Keypair>` is reused for both the SPL `TransferChecked` and
    the `SubmitDelivery` transactions in a single request.
  - [x] 2.1 Unit tests for signer loading
    - Valid base58 keypair loads; missing env aborts; malformed base58 aborts; wrong-length
      bytes abort.
    - _Requirements: 2.1, 2.3, 2.4_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Create purchase orders migration (`migrations/0002_purchase_orders.sql`)
  - Define table `purchase_orders` with `payment_uid TEXT PRIMARY KEY`, a `state` column
    constrained via `CHECK` to `pending_transfer | transfer_landed | delivery_submitted |
    completed | failed`, and nullable columns for `transfer_signature`, `evidence_url`,
    `delivery_signature`, plus `created_at` / `updated_at` timestamps.
  - Add an index on `state` to support operational queries; ensure idempotent
    `CREATE TABLE IF NOT EXISTS` semantics consistent with `migrations/init.sql`.
  - _Requirements: 5.1, 5.8_

- [x] 4. Wire `AppState` and cold-start initialization
  - Extend `src/state.rs` `AppState` to carry `Arc<TokenCatalog>`, `Arc<SellerSigner>`, and a
    Postgres pool handle (reuse the one already constructed in `src/db.rs` /
    `src/parameters.rs`).
  - Update `src/init.rs` (and any cold-start entry used by binaries / Vercel runtime) to:
    load the catalog, load the seller signer, run `Catalog::validate_against_chain`, and
    apply migration `0002_purchase_orders.sql` before the first request is served.
  - Make every failure in this sequence abort startup with a clear log line per requirements
    1.3 / 1.4 / 1.9 / 1.10 / 2.3 / 2.4.
  - [x] 4.1 Unit tests for cold-start wiring
    - Cold start fails when catalog env is missing; cold start fails when on-chain decimals
      mismatch; happy path produces a populated `AppState`.
    - _Requirements: 1.3, 1.9, 2.3, 4.0_
  - _Requirements: 1.1, 1.2, 1.3, 1.8, 1.9, 1.10, 2.1, 2.2_

- [x] 5. Implement Order Ledger (`src/orders.rs`)
  - Define `OrderState` enum mirroring the `CHECK` constraint and an `OrderRecord` struct
    holding `payment_uid`, state, and the three signature/url columns.
  - Provide async functions over the pool: `insert_pending(payment_uid)`,
    `transition(payment_uid, from, to, fields)` using `UPDATE ... WHERE state = $from`,
    `mark_failed(payment_uid, step)`, and `load(payment_uid)`.
  - Implement `with_advisory_lock(payment_uid, timeout, f)` that takes
    `pg_try_advisory_xact_lock(hash64(payment_uid))` inside a transaction and surfaces a
    `LockBusy` error when the configured request timeout would be exceeded.
  - Encode the resume-from-state policy: `pending_transfer → transfer_landed → delivery_submitted
    → completed`; zero-row updates short-circuit the request and return the persisted state.
  - [x] 5.1 Unit tests for ledger transitions
    - Insert + happy-path transitions; zero-row transition is observable; `failed` is
      terminal; `completed` returns stored signatures unchanged.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 5.2 Concurrency test for advisory lock
    - Two concurrent `with_advisory_lock` calls on the same `payment_uid` serialize; a third
      call respecting the configured timeout returns `LockBusy`.
    - _Requirements: 6.1, 6.2, 6.3_
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3_

- [x] 6. Implement SLA Builder (`src/sla_builder.rs`)
  - Define a `TransferSlaInputs` struct (token mint, decimals, price units, recipient owner,
    buyer nonce, seller pubkey, expiry/version) and a `BuiltSla { canonical_json: Vec<u8>,
    sla_hash: [u8; 32] }`.
  - Serialize to canonical JSON with stable key order so the serialized bytes are exactly the
    bytes hashed by SHA-256; expose `sla_hash_hex()` for the 402 response.
  - Validate inputs: `recipient_owner` is base58 pubkey; `buyer_nonce` is exactly 64
    lowercase hex characters; required parameters present.
  - [x] 6.1 Unit tests for canonicalization and hashing
    - Same logical inputs produce byte-identical JSON and matching `sla_hash`; key reordering
      in the input does not change the hash; invalid `recipient_owner` and `buyer_nonce`
      surface typed errors.
    - _Requirements: 3.2, 3.3, 3.4, 3.10, 3.11, 3.12_
  - _Requirements: 3.2, 3.3, 3.4, 3.10, 3.11, 3.12_

- [x] 7. Implement Registry Client (`src/registry_client.rs`)
  - HTTP client built on `reqwest` plus `RetryPolicy` from `src/rpc_retry.rs`.
  - `upload_sla(canonical_json: &[u8]) -> Result<SlaUrl>` uploads the byte-exact JSON over
    which `sla_hash` was computed and returns the registry URL.
  - Strongly-typed `TransferEvidenceBuilder` whose serialized output matches the published
    evidence JSON schema field-for-field; validate via embedded JSON schema before upload and
    return a `SchemaValidationError` on failure (do not upload).
  - `upload_evidence(evidence: TransferEvidence) -> Result<EvidenceUrl>` returns the uploaded
    URL on success.
  - [x] 7.1 Unit tests for registry client
    - Canonical SLA JSON is uploaded byte-for-byte; evidence builder serializes to a
      schema-conformant document; schema-validation failure short-circuits before upload;
      retry policy is applied on transient HTTP failures.
    - _Requirements: 3.5, 3.6, 7.1, 7.2, 7.3, 7.5, 9.5_
  - _Requirements: 3.5, 3.6, 7.1, 7.2, 7.3, 7.5, 9.5_

- [x] 8. Implement Buy Endpoint Handler (`src/api/buy_handlers.rs`)
  - [x] 8.1 Request parsing and 402 (unpaid GET) path
    - Parse query parameters `token`, `recipient_owner`, `buyer_nonce`; emit 400 for missing
      or malformed parameters and 404 for unknown `token`.
    - On unpaid GET: lookup `CatalogEntry` by `token`, build the canonical SLA via
      `sla_builder`, upload it via `registry_client.upload_sla`, and respond 402 with
      `accepts[].extra.slaHash` / `slaUrl` populated and the USDC amount set to
      `price_usdc_ui` converted to USDC raw units.
    - Reuse the response envelope, CORS headers, and `X-API-Version` header from the existing
      `check_balance` handler.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

  - [x] 8.2 Paid GET path: verify, settle, and idempotency setup
    - Invoke `PaymentHandler::check_payment` on the submitted proof; reject with 402 on
      validation failure.
    - Recompute `Sla_Hash` from the request's query parameters and compare to the
      `slaHash` referenced by the submitted `FundPayment`; reject with 402 on mismatch.
    - Acquire the Postgres advisory lock keyed on `hash64(payment_uid)`; on lock-busy past
      the configured request timeout return 409.
    - Insert / load the `purchase_orders` row; if state is `completed` return the stored
      signatures with HTTP 200 without any new on-chain action; if state is `failed` return
      409.
    - Call `FacilitatorClient::verify_and_settle`; on non-success return 402 and do not sign
      any SPL transfer.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.4, 5.5, 5.7, 6.1, 6.2, 6.3_

  - [x] 8.3 Paid GET path: SPL `TransferChecked` and ledger advance
    - Compute `price_units = price_usdc_ui * 10^decimals` using exact integer arithmetic
      (no floating point on the raw-units boundary); pass `decimals` directly into
      `TransferChecked`.
    - Resolve the source ATA: prefer `sender_treasury_ata` from the catalog entry, otherwise
      derive the seller's ATA for the configured mint.
    - Fetch a fresh blockhash immediately before signing, sign with `SellerSigner`, submit
      the transaction under `RetryPolicy`, and on confirmation transition the order from
      `pending_transfer → transfer_landed` storing `transfer_signature`.
    - On terminal failure mark the order `failed` (step = `transfer`) and return 502.
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 5.2, 5.6, 6.4, 8.1, 8.2, 8.4, 9.4_

  - [x] 8.4 Paid GET path: evidence upload and `SubmitDelivery`
    - Build `TransferEvidence` via the strongly-typed builder, validate against the schema,
      upload via `registry_client.upload_evidence`, and transition the order from
      `transfer_landed → delivery_submitted` storing `evidence_url`.
    - Build and sign the `SubmitDelivery` transaction (referencing `Sla_Hash` and the
      uploaded evidence URL) with a fresh blockhash, submit under `RetryPolicy`, and on
      confirmation transition `delivery_submitted → completed` storing `delivery_signature`.
    - On schema-validation failure, transition the order to `failed` and return 500
      (`error.code = evidence_schema_invalid`); on registry transport failure return 502.
    - On terminal failure of `SubmitDelivery` mark the order `failed` (step =
      `submit_delivery`) and return 502.
    - Respond 200 with `{ transfer_signature, evidence_url, delivery_signature, sla_hash }`
      using the existing CORS / `X-API-Version` envelope.
    - _Requirements: 4.11, 4.12, 4.13, 4.14, 5.2, 5.6, 6.4, 7.4, 9.4, 9.5_

  - [x] 8.5 Unified error response shaping
    - Centralize non-success responses into a helper that emits
      `{ "error": { "code", "message" } }` with the same CORS and `X-API-Version` headers as
      `check_balance`; map an uncovered internal error to 500 with `error.code =
      internal_error`.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. Register the route and expose the module
  - Add `pub mod catalog; pub mod seller_signer; pub mod sla_builder; pub mod registry_client;
    pub mod orders;` to `src/lib.rs`, and `pub mod buy_handlers;` to `src/api.rs`.
  - In the route handler used by Vercel runtime, route `GET /api/v1/buy-spl-token` to
    `api::buy_handlers::handle` and ensure `OPTIONS` preflight uses the same CORS envelope.
  - Confirm no other routes regress by leaving the existing `check_balance` route wiring
    unchanged.
  - _Requirements: 3.1, 3.8, 4.1, 4.14, 9.2_

- [x] 10. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Run `cargo test -p spl-token-balance` and `cargo build -p spl-token-balance`; resolve any
    compile or test errors before proceeding to integration tests.

- [x] 11. Integration tests for the buy endpoint
  - [x] 11.1 End-to-end happy path against a mocked Solana RPC and mocked registry
    - Unpaid GET returns 402 with `slaHash` / `slaUrl`; paid GET with a matching FundPayment
      returns 200 with all three signatures and writes a `completed` row to
      `purchase_orders`.
    - _Requirements: 3.1–3.8, 4.1–4.14, 5.1–5.5_
  - [x] 11.2 Idempotency and concurrency
    - Replaying the same paid GET returns the original signatures without resubmission; two
      concurrent paid GETs for the same `payment_uid` are serialized via the advisory lock
      and only one transfer lands.
    - _Requirements: 5.4, 5.5, 6.1, 6.2, 6.3_
  - [x] 11.3 Failure modes
    - SLA-hash mismatch → 402; `verify_and_settle` failure → 402 with no SPL transfer;
      transfer RPC exhausts retries → 502 and ledger row is `failed`; replay against a
      `failed` row → 409.
    - _Requirements: 4.3, 4.5, 4.10, 5.6, 5.7, 9.4_

- [x] 12. Documentation update
  - Update `README.md` and `docs/` to describe the new endpoint, required environment
    variables (`BUY_SPL_TOKEN_CATALOG_JSON`, `SELLER_KEYPAIR_BASE58`), the `purchase_orders`
    migration, and a sample `curl` flow for the unpaid 402 → paid 200 sequence.
  - _Requirements: 1.1, 2.1, 3.1, 5.8_

## Notes

- Tasks marked with `*` are optional test sub-tasks and may be skipped for a faster MVP, but
  they are still required for the dependency graph and for traceability.
- Tasks 1, 2, and 3 are independent and can run fully in parallel.
- Tasks 5, 6, and 7 all depend on Task 4 (`AppState` wiring) but are mutually independent and
  can run in parallel.
- Sub-tasks 8.1 through 8.5 all live in `src/api/buy_handlers.rs` and therefore must run
  sequentially (same file).
- Reused without modification: `FacilitatorClient::verify_and_settle`,
  `PaymentHandler::check_payment`, `RetryPolicy` from `src/rpc_retry.rs`, and the 402 / CORS
  / `X-API-Version` response envelope from the existing `check_balance` endpoint.

## Task Dependency Graph

Parent-task ordering. Sub-tasks within a parent run sequentially as part of that parent.
Task 10 is a checkpoint and is intentionally omitted from the graph.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3"] },
    { "id": 1, "tasks": ["4"] },
    { "id": 2, "tasks": ["5", "6", "7"] },
    { "id": 3, "tasks": ["8"] },
    { "id": 4, "tasks": ["9"] },
    { "id": 5, "tasks": ["11"] },
    { "id": 6, "tasks": ["12"] }
  ]
}
```
