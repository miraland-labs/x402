# Requirements Document

## Introduction

This feature delivers a generic, off-chain oracle layer for the x402 SLA-escrow ecosystem. The on-chain `sla-escrow` program is unchanged; complexity is absorbed by a shared Rust library (`oracle-common`) and three sibling oracle binaries — `oracle-api-quality`, `oracle-onchain-transfer`, `oracle-file-delivery` — each serving exactly one profile in v1. A first-class registration HTTP API replaces the previous "BYO evidence registry" assumption, with content-addressed Postgres or S3-compatible (MinIO recommended) storage. A templated systemd installer makes Ubuntu 24.04 deployment turnkey. A discovery contract (`accepts[].extra.oracleProfiles[]`, pr402 `/capabilities.slaEscrowOracleProfiles[]`) lets buyers pick the right oracle by `profile_id`.

The full architectural rationale, diagrams, trait signatures, schema definitions, and 33 correctness properties live in [design.md](design.md). This document expresses what each actor must be able to do and the observable acceptance criteria for those capabilities, citing the design's hard constraints (`C1`..`C13`) and properties (`P-HASH-1`..`P-CAP-2`).

**In scope**

- New shared `oracle-common` Rust crate (chain monitor, settler, registry, ledger, HTTP, profile registry, storage backends).
- New oracle binaries `oracle-api-quality`, `oracle-onchain-transfer`, `oracle-file-delivery`, each with their own SLA + evidence schemas, evaluator, and normative spec.
- Postgres schema (`migrations/init.sql`) covering `oracle_jobs`, `oracle_verdicts`, `oracle_lifecycle_events`, `oracle_parameters`, `oracle_seller_keys`, `oracle_deliveries`, `oracle_artifacts`, `oracle_registered_profiles`.
- Templated systemd unit (`oracle@.service`), `oracle.target` aggregator, and idempotent installer scripts (`install.sh`, `upgrade.sh`, `uninstall.sh`, `bootstrap-minio.sh`).
- Discovery contract additions (`oracleProfiles[]`, `slaEscrowOracleProfiles[]`) — spec'd here, implemented in a separate pr402 spec.

**Out of scope** — see the *Out of Scope* section at the end.

## Glossary

| Term | Definition |
|---|---|
| **ATA** | Associated Token Account (Solana). Per-(owner, mint) account holding SPL token balance. The transfer family re-derives ATAs from `recipient_owner` and `mint`. |
| **Bearer token** | Long-lived secret returned by registry seller registration. The registry stores only `SHA256(token)`; the raw token is shown once. |
| **Confirmed / Finalized** | Solana commitment levels. The transfer family treats either as "the tx happened". |
| **Delivery hash** | `SHA256(delivery bytes)`. On-chain field on `Payment`. Different families bind it to different bytes (JSON for api-quality / onchain-transfer; raw blob bytes for file-delivery). |
| **Evidence** | The off-chain bytes whose SHA-256 equals the on-chain `delivery_hash`. JSON for most families; the file itself for file-delivery. |
| **Family** | A domain-level word naming the kind of work and proof (`api-quality`, `onchain-transfer`, `file-delivery`). One closed `(Sla, Evidence)` type pair per family. See [design.md §Family / Profile / Version Taxonomy](design.md#family--profile--version-taxonomy). |
| **MinIO** | Open-source self-hosted S3-compatible object store. Recommended self-hosted blob backend. The same `ORACLE_REGISTRY_S3_*` env vars work against AWS S3, Cloudflare R2, Backblaze B2, Wasabi. |
| **Oracle authority** | Solana pubkey recorded as `Payment.oracle_authority` at funding. Only the corresponding signer can call `ConfirmOracle`. In v1, each authority advertises exactly one `profile_id`. |
| **On-chain Clock** | Solana `Clock` sysvar. Eligibility checks compare `Clock.unix_timestamp` against `payment.expires_at` instead of the operator's wall clock. |
| **pr402** | The x402 facilitator. Builds unsigned `FundPayment` transactions, advertises capabilities. Out-of-scope implementation; in-scope contract. |
| **Postgres ledger** | The set of tables under `migrations/init.sql` (jobs, verdicts, lifecycle, parameters, seller keys, deliveries, artifacts, registered profiles). Per-family database. |
| **Profile id** | `x402/<family>/<profile>/<version>`. Single canonical id per profile; no aliases. REQUIRED in every SLA document. |
| **Registry** | The HTTP API + storage backend that serves SLA / delivery / blob bytes content-addressed by SHA-256. Mounted by each oracle binary or run as a sibling `oracle-registry` service. |
| **Resolution hash** | 32-byte digest the oracle puts on `Payment.resolution_hash`. Computed via the canonical `x402/oracles/resolution-envelope/v1` recipe. Deterministic, replay-safe. |
| **Resolution reason** | `u16` code on `Payment.resolution_reason`. Standard codes 0–255 are interoperable; custom codes ≥256 are partitioned per family (256–319 transfer, 320–383 file-delivery, 384–447 reserved, 448–511 ecosystem, 512+ deployment-local). |
| **SLA** | Service Level Agreement document. JSON bytes whose SHA-256 equals the on-chain `sla_hash`. Includes the required `profile_id` field. |
| **Strict event match** | Optional mode (`ORACLE_REQUIRE_EVENT_MATCH=true`) where the chain monitor refuses to emit a job unless the transaction carries a matching `DeliverySubmittedEvent`. Recommended on mainnet. |

## Requirements

### Requirements for Sellers

#### Requirement 1: Register with the registry

**User Story:** As a seller, I want to register my wallet pubkey with the oracle's registry and obtain a bearer token, so that I can authenticate subsequent SLA / evidence / blob uploads.

#### Acceptance Criteria

1.1 WHEN a seller calls `GET /v1/registry/seller/challenge?wallet=<pubkey>` THEN the registry SHALL respond `200 OK` with a JSON body containing `challenge` (random nonce) and `expires_at` (RFC3339 timestamp). (C2, C3)

1.2 WHEN a seller calls `POST /v1/registry/seller/register` with `{wallet, signature, challenge}` and the Ed25519 `signature` verifies against `wallet` over `challenge` THEN the registry SHALL insert one row into `oracle_seller_keys` with `bearer_sha256 = SHA256(token)` and respond `200 OK` with a JSON body containing the raw `token` exactly once and an `id`. (C3)

1.3 IF the supplied `signature` does not verify, OR `challenge` has expired, OR `wallet` is not a valid base58 Solana pubkey THEN the registry SHALL respond `400 Bad Request` and SHALL NOT create any row in `oracle_seller_keys`. (C3)

1.4 WHEN the same wallet calls register a second time with a fresh challenge + signature THEN the registry SHALL accept the request and create an additional row in `oracle_seller_keys` so the seller can hold multiple active tokens.


#### Requirement 2: Upload SLA bytes

**User Story:** As a seller, I want to upload my SLA JSON to the registry and learn the resulting hash, so that I can use that hash as `sla_hash` when the buyer funds the escrow.

#### Acceptance Criteria

2.1 WHEN a seller calls `POST /v1/registry/sla` with `Content-Type: application/json`, a valid `Authorization: Bearer <token>`, and a JSON body that parses as a JSON object containing `profile_id` THEN the registry SHALL store the raw bytes, compute `H = SHA256(raw bytes)`, insert one row into `oracle_deliveries` with `kind='sla'` and the matching `profile_id` value, and respond `200 OK` with a JSON body containing `sha256`, `url`, `size_bytes`, `kind: "sla"`, and `stored_at`. (C3, C5, C8)

2.2 IF the bytes already exist (`(sha256_hex, kind='sla')` is already in `oracle_deliveries`) THEN the registry SHALL respond `200 OK` with the existing record (idempotent dedup). (P-REG-1, P-REG-4)

2.3 IF the request body cannot be parsed as JSON, OR the parsed JSON is not an object, OR the parsed JSON does not contain a string-valued `profile_id` THEN the registry SHALL respond `400 Bad Request` and SHALL NOT store the bytes. (C8, P-DISP-1)

2.4 IF the request size exceeds `ORACLE_REGISTRY_MAX_BYTEA_BYTES` (default 4 MiB on the Postgres backend) THEN the registry SHALL respond `413 Payload Too Large` and SHALL NOT store the bytes. (P-REG-2)

2.5 IF the bearer token is missing, malformed, or revoked (`oracle_seller_keys.revoked = true`) THEN the registry SHALL respond `401 Unauthorized`. (P-REG-3)

#### Requirement 3: Upload small evidence JSON

**User Story:** As a seller, I want to upload my delivery evidence JSON for the api-quality or onchain-transfer family, so that I can use the resulting hash as the `delivery_hash` argument to `SubmitDelivery` on-chain.

#### Acceptance Criteria

3.1 WHEN a seller calls `POST /v1/registry/delivery` with a valid bearer, `Content-Type: application/json`, and a JSON body THEN the registry SHALL store the bytes, insert one row into `oracle_deliveries` with `kind='delivery'`, and respond `200 OK` with `sha256`, `url`, `size_bytes`, `kind: "delivery"`, and `stored_at`. (C3, C5)

3.2 WHEN the JSON parses as an object containing `profile_id` THEN the registry SHALL persist that `profile_id` on the `oracle_deliveries` row.

3.3 IF the body is not parseable JSON, OR exceeds `ORACLE_REGISTRY_MAX_BYTEA_BYTES`, OR the bearer is revoked THEN the registry SHALL respond `400`, `413`, or `401` respectively, with no row written. (P-REG-2, P-REG-3)

3.4 WHEN identical bytes are uploaded by a different seller bearer THEN the registry SHALL respond `200 OK` and the catalog SHALL hold exactly one row for `(sha256_hex, kind='delivery')`. (P-REG-4)

#### Requirement 4: Upload large blob (file-delivery)

**User Story:** As a seller of large file deliveries, I want to stream a binary blob to the registry, so that the buyer's oracle can attest to its hash and metadata without me having to host the bytes myself.

#### Acceptance Criteria

4.1 WHEN a seller calls `POST /v1/registry/blob` with `Content-Type: application/octet-stream` (or `multipart/form-data` with field `file`) and a valid bearer THEN the registry SHALL stream the body to the configured backend (`ORACLE_REGISTRY_BACKEND={postgres|s3|local}`), compute `SHA256` incrementally during the write, sniff a MIME type from the leading bytes, and respond `200 OK` with `sha256`, `url`, `size_bytes`, `content_type`, `kind: "blob"`, `stored_at`. (C3, C12)

4.2 IF the streamed size exceeds `ORACLE_REGISTRY_MAX_BLOB_BYTES` (S3 backend) THEN the registry SHALL abort the upload, return `413 Payload Too Large`, and SHALL NOT leave a partial object in the backend. (P-REG-2)

4.3 WHILE the upload is in progress the registry SHALL hold memory bounded by a fixed read buffer (≤64 KiB) plus the MIME-sniff window (≤512 bytes), regardless of total blob size. (See [design.md §Performance Considerations](design.md#performance-considerations).)

4.4 WHEN the upload completes the registry SHALL insert one row into `oracle_deliveries` with `kind='blob'`, `storage_backend ∈ {'postgres','s3','local'}`, and `storage_key` matching the backend (e.g. `oracle-blobs/<sha256_hex>` for S3).

4.5 IF the bearer is revoked THEN the request SHALL be rejected with `401` before any bytes are read. (P-REG-3)

#### Requirement 5: Advertise oracle profiles

**User Story:** As a seller offering more than one kind of paid service, I want to advertise per-family oracle authorities in my `accepts[].extra`, so that buyers can pick the oracle that matches the family of work they're paying for.

#### Acceptance Criteria

5.1 WHEN the seller emits an x402 `402` response or a pr402 `/supported` entry for the `sla-escrow` scheme THEN `accepts[].extra` SHALL contain `oracleAuthorities` (flat array of base58 pubkeys) and MAY contain `oracleProfiles` (array of per-profile descriptors).

5.2 WHEN `oracleProfiles[i]` is present THEN it SHALL contain `profileId`, `operatorPubkey`, and `normativeSpecUrl` at minimum and MAY contain `registryBaseUrl`, `supportedClusters`, `supportedMints`, `maxBlobBytes`.

5.3 WHEN `oracleProfiles[]` is present THEN every `operatorPubkey` value SHALL also appear in `oracleAuthorities[]`. (P-CAP-1)

5.4 IF a single `operatorPubkey` appears in two `oracleProfiles[]` entries THEN the seller advertisement is malformed; pr402 SHALL reject it at advertisement time (covered in Requirement 23). (C10)

#### Requirement 6: Submit delivery on-chain

**User Story:** As a seller, I want to submit my off-chain delivery hash to the on-chain `sla-escrow` program, so that the oracle's WebSocket monitor picks it up and starts the evaluation pipeline.

#### Acceptance Criteria

6.1 WHEN the seller calls the existing `sla-escrow` `SubmitDelivery(delivery_hash)` instruction THEN the on-chain program SHALL set `payment.delivery_hash` and `payment.delivery_timestamp` and emit `DeliverySubmittedEvent`. (C1)

6.2 WHILE the on-chain `payment.oracle_authority` matches a running oracle binary's pubkey AND that binary's registered `profile_id` matches the SLA's `profile_id` AND the registry has the bytes for both `sla_hash` and `delivery_hash` THEN the oracle SHALL detect the event, evaluate, and submit `ConfirmOracle` within `EVALUATION_TIMEOUT_MS`. (C1, C2, P-DISP-1)

6.3 IF the delivery is submitted later than `payment.expires_at - payment.delivery_cutoff_seconds` THEN the on-chain `submit_delivery` handler SHALL reject with `DeliveryTooLateForOracle` (existing behavior; the oracle never sees a corresponding event). (C1)

#### Requirement 7: Rotate or revoke registry bearer tokens

**User Story:** As a seller, I want to rotate or revoke my registry bearer token, so that I can recover from a leak without losing my historical uploads.

#### Acceptance Criteria

7.1 WHEN a seller calls `POST /v1/registry/seller/rotate` with a valid bearer THEN the registry SHALL mark the current `oracle_seller_keys` row as `revoked=true`, insert a new row with a freshly issued token, and respond `200 OK` with the new raw `token`. (P-REG-3)

7.2 WHEN a seller's row has `revoked=true` THEN any subsequent registry write request with that bearer SHALL respond `401 Unauthorized`. (P-REG-3)

7.3 WHILE a row has `revoked=true` the registry SHALL preserve all historical `oracle_deliveries` rows that reference it (`seller_key_id`) for audit purposes.


### Requirements for Buyers

#### Requirement 8: Discover oracle authorities by family

**User Story:** As a buyer agent, I want to find the right oracle authority for the family of work I'm paying for, so that the verdict on my payment is rendered by an oracle that actually understands the SLA shape.

#### Acceptance Criteria

8.1 WHEN the buyer reads a seller's `accepts[].extra.oracleProfiles[]` THEN the buyer SHALL be able to find at most one entry per `profileId` and SHALL pick that entry's `operatorPubkey` as the `oracle_authority` argument to `FundPayment`.

8.2 WHEN the buyer reads pr402 `/api/v1/facilitator/capabilities.slaEscrowOracleProfiles[]` THEN the buyer SHALL be able to identify a `defaultOperatorPubkey` per `profileId` and use it when the seller's advertisement does not list one. (C10)

8.3 IF no profile in either source matches the buyer's desired family THEN the buyer SHALL NOT proceed with `FundPayment` against any pubkey from `oracleAuthorities[]` because there is no guarantee that authority handles the desired family.

#### Requirement 9: Fund the payment

**User Story:** As a buyer, I want to fund an SLA-escrow payment with the oracle authority I selected, so that only that authority can render a verdict on the work.

#### Acceptance Criteria

9.1 WHEN the buyer (directly or via pr402) calls `FundPayment(seller, mint, oracle_authority, payment_uid, sla_hash, amount, ttl_seconds)` THEN the on-chain program SHALL snapshot all fields onto the `Payment` PDA (existing behavior). (C1)

9.2 WHILE `Payment.oracle_authority` is bound the oracle holding the matching keypair SHALL be the only signer accepted by `ConfirmOracle` for that payment. (P-AUTH-1)

9.3 IF the buyer's chosen `oracle_authority` is not in the seller's `oracleAuthorities[]` list THEN pr402's verify path SHALL reject the payment (existing pr402 behavior, preserved). (C1, P-CAP-1)

#### Requirement 10: Verify SLA and delivery bytes from the registry

**User Story:** As a buyer, I want to fetch SLA and delivery bytes from the registry by hash, so that I can independently verify what the oracle is evaluating.

#### Acceptance Criteria

10.1 WHEN any client calls `GET /v1/registry/{sha256_hex}` THEN the registry SHALL respond `200 OK` with the raw bytes whose `SHA256` equals the path component, OR `404 Not Found` if no row exists, OR `416 Range Not Satisfiable` for invalid `Range` headers. (C5, P-REG-1)

10.2 WHEN the response is `200 OK` THEN the body bytes' `SHA256` SHALL equal the path component (the registry re-verifies before serving). (P-HASH-1, P-HASH-2, P-HASH-3)

10.3 WHEN the request includes a valid `Range: bytes=...` header for a blob `kind` THEN the registry SHALL respond `206 Partial Content` with the requested byte range and a `Content-Range` header.

10.4 WHILE the deployment uses the S3 backend THE registry MAY redirect to a presigned URL OR proxy the bytes through, at the operator's discretion; either path SHALL preserve the body's SHA-256.

#### Requirement 11: Receive a deterministic verdict

**User Story:** As a buyer, I want the oracle's verdict on my payment to be auditable, so that I can recompute the `resolution_hash` and verify the verdict matches the SLA + evidence I have.

#### Acceptance Criteria

11.1 WHEN the oracle settles a payment THEN `Payment.resolution_state ∈ {1, 2}` (Approved or Rejected), `Payment.resolution_reason` SHALL be drawn from the standard codes (0–255) or the family's reserved custom range (≥256), and `Payment.resolution_hash` SHALL equal `SHA256(canonical_resolution_envelope_bytes)` where the envelope follows the `x402/oracles/resolution-envelope/v1` recipe in [design.md §Resolution-Hash Recipe](design.md#single-canonical-resolution-hash-recipe). (C9, P-DET-2)

11.2 WHEN any external party rebuilds the canonical envelope JSON from `(payment_uid, payment_pubkey, sla_hash, delivery_hash, evaluatorProfile, approved, resolutionReason, details)` THEN `SHA256` of the rebuild SHALL equal the on-chain `resolution_hash`. (P-DET-2)

11.3 IF the verdict is `Approved` THEN `Payment.resolution_reason == 0` (`ResolutionReason::None`). (P-VER-3)

11.4 IF the verdict is `Rejected` THEN `Payment.resolution_reason` SHALL match the documented code for the first failing check in the family's check ordering. (P-VER-2)

### Requirements for Oracle Operators

#### Requirement 12: Install a family binary on Ubuntu 24.04

**User Story:** As an oracle operator, I want to install a family binary with a single command, so that I can stand up an oracle on a fresh Ubuntu 24.04 host without manual systemd plumbing.

#### Acceptance Criteria

12.1 WHEN the operator runs `sudo ./scripts/install.sh <family> <path-to-binary> <env-template>` (e.g. `api-quality`, `onchain-transfer`, `file-delivery`) THEN the script SHALL: create the system user/group `oracle` if absent; create `/opt/oracle/<family>` and `/var/lib/oracle/<family>` owned by `oracle:oracle`; install the binary as `/opt/oracle/<family>/oracle-<family>` mode `0755`; copy the env template to `/etc/oracle/<family>.env` mode `0600` (only if absent); install `/etc/systemd/system/oracle@.service` and `/etc/systemd/system/oracle.target` (only if absent, and `oracle.target` enabled); run `systemctl daemon-reload` and `systemctl enable --now oracle@<family>.service`. (C12)

12.2 WHILE `/etc/oracle/<family>.env` already exists the installer SHALL NOT overwrite it; the operator's edits SHALL be preserved.

12.3 WHEN the installer is re-run with the same arguments on a host that already has the family installed THEN the script SHALL succeed (idempotent), updating the binary in place and leaving the env file untouched.

12.4 WHEN the installer completes successfully THEN `systemctl is-active oracle@<family>.service` SHALL return `active` within 5 seconds.

#### Requirement 13: Upgrade a family binary

**User Story:** As an oracle operator, I want to upgrade a family binary in place, so that I can deploy fixes without rewriting systemd config.

#### Acceptance Criteria

13.1 WHEN the operator runs `sudo ./scripts/upgrade.sh <family> <path-to-new-binary>` THEN the script SHALL stage the new binary, atomically replace `/opt/oracle/<family>/oracle-<family>`, and `systemctl restart oracle@<family>.service`.

13.2 WHEN the restart completes the script SHALL probe `http://127.0.0.1:<port>/health` (port read from `BIND_ADDR` in the family's env file, defaulting to `4020`) up to 5 times with 2-second intervals AND SHALL exit `0` on the first `200 OK` and exit non-zero with a "check journalctl" message after the final retry. (See [design.md §Health and observability](design.md#logs-and-observability) for `/health` shape.)

#### Requirement 14: Uninstall a family binary

**User Story:** As an oracle operator, I want to uninstall a family binary cleanly, so that I can remove obsolete oracle types from a host.

#### Acceptance Criteria

14.1 WHEN the operator runs `sudo ./scripts/uninstall.sh <family>` THEN the script SHALL `systemctl disable --now oracle@<family>.service`, remove the binary from `/opt/oracle/<family>/`, and remove `/opt/oracle/<family>` and `/var/lib/oracle/<family>` if empty.

14.2 WHILE `PRESERVE_ENV=1` (default) the script SHALL NOT remove `/etc/oracle/<family>.env`.

14.3 WHERE `PRESERVE_ENV=0` is set the script SHALL remove `/etc/oracle/<family>.env` along with the binary.

#### Requirement 15: Run multiple families on one host

**User Story:** As an oracle operator, I want to run multiple oracle families side-by-side on a single VPS, so that I can amortize hosting cost without sacrificing per-family blast-radius isolation.

#### Acceptance Criteria

15.1 WHEN the operator installs more than one family on the same host THEN each family SHALL run as `oracle@<family>.service` with its own `/etc/oracle/<family>.env`, its own `BIND_ADDR` port, its own oracle keypair, and its own Postgres `DATABASE_URL`. (C10)

15.2 WHEN `oracle.target` is active and any family unit is installed THEN `systemctl restart oracle.target` SHALL restart all installed family units in dependency order.

15.3 WHILE no family is installed `systemctl status oracle.target` SHALL succeed (the target has zero active `Wants=`-resolved units; this is not an error condition).

15.4 IF two binaries are configured with the **same** oracle keypair THEN this is operationally unsupported; the design recommends one primary per authority. (P-IDEM-1, P-IDEM-3)

#### Requirement 16: Bootstrap a self-hosted MinIO blob backend

**User Story:** As an oracle operator who does not want to depend on AWS, I want to stand up a local MinIO server with one script, so that the file-delivery oracle has a working S3-compatible backend out of the box.

#### Acceptance Criteria

16.1 WHEN the operator exports `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, optionally `MINIO_BUCKET` (default `oracle-blobs`), `MINIO_ADDR` (default `127.0.0.1:9000`), `MINIO_DATA_DIR` (default `/srv/minio`), and runs `sudo ./scripts/bootstrap-minio.sh` THEN the script SHALL: install the MinIO server and `mc` client binaries; create the system user/group `minio`; create the data directory; write `/etc/minio.env` mode `0600`; install `/etc/systemd/system/minio.service`; enable and start the service; create the bucket; and print the env-var snippet for `ORACLE_REGISTRY_S3_*`. (C12)

16.2 WHEN the script is re-run with the same env values THEN it SHALL succeed (idempotent) and SHALL NOT recreate the data directory or the bucket.

16.3 WHILE MinIO is running the operator SHALL be able to point any oracle binary at it by setting `ORACLE_REGISTRY_BACKEND=s3`, `ORACLE_REGISTRY_S3_ENDPOINT=http://<MINIO_ADDR>`, `ORACLE_REGISTRY_S3_BUCKET=<MINIO_BUCKET>`, `ORACLE_REGISTRY_S3_ACCESS_KEY=<MINIO_ROOT_USER>`, `ORACLE_REGISTRY_S3_SECRET_KEY=<MINIO_ROOT_PASSWORD>`.

16.4 IF the operator already runs AWS S3, Cloudflare R2, Backblaze B2, or Wasabi THEN the same `ORACLE_REGISTRY_S3_*` env vars SHALL configure the oracle against that backend without code changes. (C12)

#### Requirement 17: Configure storage backend at runtime

**User Story:** As an oracle operator, I want to choose between Postgres BYTEA, S3-compatible, and local-filesystem storage at runtime, so that I can match cost and operational complexity to my deployment size.

#### Acceptance Criteria

17.1 WHEN `ORACLE_REGISTRY_BACKEND=postgres` THEN registry uploads SHALL be persisted to the `oracle_artifacts` table and SHALL be capped by `ORACLE_REGISTRY_MAX_BYTEA_BYTES` (default 4 MiB). (C3)

17.2 WHEN `ORACLE_REGISTRY_BACKEND=s3` THEN registry uploads SHALL be persisted to `oracle-blobs/<sha256_hex>` in the configured S3-compatible bucket and SHALL be capped by `ORACLE_REGISTRY_MAX_BLOB_BYTES`.

17.3 WHEN `ORACLE_REGISTRY_BACKEND=local` THEN registry uploads SHALL be persisted under `/var/lib/oracle/<family>/blobs/<sha256_hex[0..2]>/<sha256_hex>` (development only).

17.4 WHEN `ORACLE_REGISTRY_BACKEND` is unset OR set to a value not in `{postgres, s3, local}` THEN the oracle binary SHALL refuse to start and SHALL log a clear error.

#### Requirement 18: Monitor health, metrics, and queue depth

**User Story:** As an oracle operator, I want a health endpoint, a Prometheus metrics endpoint, and queue-depth visibility, so that I can alert on oracle degradation before payments expire unsettled.

#### Acceptance Criteria

18.1 WHEN any client calls `GET /health` THEN the oracle SHALL respond `200 OK` with a JSON body that includes `status`, `oracle_pubkey`, `program_id`, `chain_connected`, `websocket_connected`, `last_websocket_message_at`, `queue_depth`, `deliveries_observed`, `last_seen_slot`, `registry_reachable`, `oracle_balance_lamports`, `database_enabled`, `strict_profile`. (See [design.md §Health and observability](design.md#logs-and-observability).)

18.2 WHILE either `chain_connected` is `false` OR `websocket_connected` is `false` the oracle SHALL respond `503 Service Unavailable` from `/health` (degraded).

18.3 WHEN any client calls `GET /metrics` THEN the oracle SHALL respond `200 OK` with `Content-Type: text/plain; version=0.0.4; charset=utf-8` and Prometheus exposition for at least: `oracle_uptime_seconds`, `oracle_total_evaluated`, `oracle_total_approved`, `oracle_total_rejected`, `oracle_total_errors`, `oracle_total_dead_letter`, `oracle_total_evidence_fetch_failures`, `oracle_queue_depth`, `oracle_websocket_connected`, `oracle_deliveries_observed`, `oracle_last_seen_slot`.

18.4 WHEN `GET /stats` is called THEN the oracle SHALL respond `200 OK` with a JSON body containing the same counters (the JSON form of the Prometheus exposition).

#### Requirement 19: Manually re-evaluate a payment

**User Story:** As an oracle operator debugging an edge case, I want to manually trigger a re-evaluation against a specific payment PDA, so that I can recover from transient infrastructure issues without waiting for automatic retry.

#### Acceptance Criteria

19.1 WHEN the operator calls `POST /evaluate` with `Authorization: Bearer <ORACLE_OPERATOR_TOKEN>` (or `X-Oracle-Token: <ORACLE_OPERATOR_TOKEN>`) and a JSON body `{"payment_pubkey": "..."}` THEN the oracle SHALL run the full pipeline once and respond `200 OK` with `{approved, signature, checks, error}`.

19.2 IF the supplied operator token's SHA-256 digest does not equal `ORACLE_OPERATOR_TOKEN_SHA256` THEN the oracle SHALL respond `401 Unauthorized`.

19.3 IF `ORACLE_OPERATOR_TOKEN_SHA256` is unset AND `ORACLE_ALLOW_UNAUTHENTICATED_MANUAL_EVALUATE=false` THEN the oracle SHALL respond `503 Service Unavailable` with a message saying manual evaluation is disabled.

19.4 WHILE the operator exceeds `ORACLE_MANUAL_EVALUATE_RATE_LIMIT` requests per `ORACLE_MANUAL_EVALUATE_RATE_WINDOW_MS` window THE oracle SHALL respond `429 Too Many Requests`.

19.5 IF the supplied `payment_pubkey` is not assigned to this oracle (`payment.oracle_authority != self.pubkey`) THEN the oracle SHALL respond `404 Not Found` and SHALL NOT submit a settlement transaction. (P-AUTH-1)

#### Requirement 20: Survive process restart

**User Story:** As an oracle operator, I want the oracle to remember which payments it has already settled across restarts, so that crashes or planned maintenance never cause duplicate `ConfirmOracle` transactions.

#### Acceptance Criteria

20.1 WHEN the oracle starts AND `DATABASE_URL` is set THEN the oracle SHALL connect to Postgres, ensure the schema from `migrations/init.sql` is applied, and use the ledger as the source of truth for "is this payment terminal?". (C3, P-IDEM-3)

20.2 WHEN the chain monitor backfill (or live event) emits a job whose `payment_uid` already has `oracle_jobs.status ∈ {'settled','dead_letter'}` THEN the worker SHALL skip the job, write a `lifecycle_event = 'skipped_terminal'`, and SHALL NOT submit `ConfirmOracle`. (P-IDEM-1)

20.3 WHILE a job for `payment_uid` is in flight (`oracle_jobs.status = 'running'`) THEN duplicate `DeliverySubmittedEvent` log notifications for the same `(payment_uid, delivery_hash)` SHALL be absorbed without spawning a parallel evaluation. (P-IDEM-2)

20.4 WHEN the oracle's eligibility check runs for a job THEN it SHALL read the on-chain `Clock` sysvar and compare against `payment.expires_at`; the operator's wall clock SHALL NOT be used. (P-AUTH-4)

#### Requirement 21: Refuse SLAs whose `profile_id` does not match

**User Story:** As an oracle operator running a single-profile binary, I want the oracle to refuse SLAs that are not for my profile, so that a misconfigured advertisement or malicious buyer cannot trick my keypair into adjudicating work I do not understand.

#### Acceptance Criteria

21.1 WHEN the chain monitor decodes a delivery event AND fetches the SLA bytes AND parses the small `SlaEnvelope` for `profile_id` AND that value differs from the binary's registered `profile_id` THEN the oracle SHALL write an `oracle_jobs` row with `status='failed'`, `last_error='unknown_profile: <value>'`, emit a `lifecycle_event='profile_mismatch'`, and SHALL NOT submit `ConfirmOracle`. (P-DISP-1)

21.2 IF the SLA bytes parse but `profile_id` is missing OR is not a string THEN the oracle SHALL refuse the job with `OracleError::UnknownProfile` and the same ledger trail. (C8, P-DISP-1)

21.3 WHILE no profile is registered with the binary at startup the binary SHALL refuse to start with a clear error.


### Requirements for Oracle Authors / Ecosystem Maintainers

#### Requirement 22: Add a new oracle family by cloning the starter template

**User Story:** As an oracle author, I want to add a new family by writing a small focused crate that depends on `oracle-common`, so that the chain monitor, settler, ledger, registry, and HTTP surface are reused without copy-paste.

#### Acceptance Criteria

22.1 WHEN an author clones any of the three sibling crates (`oracle-api-quality`, `oracle-onchain-transfer`, `oracle-file-delivery`) AS a starter template THEN the resulting crate's `Cargo.toml` SHALL declare a single `oracle-common = { path = "../oracle-common", version = "0.1" }` dependency and SHALL NOT re-implement chain monitor, settler, ledger, HTTP server, or registration HTTP routes. (C2)

22.2 WHEN an author defines their family's SLA struct AND evidence struct AND `OracleEvaluator` impl AND wires them into a `RegisteredProfile` in `main.rs` THEN the binary SHALL run with all `oracle-common` infrastructure intact. (See [design.md §Pluggable Trait Surface](design.md#pluggable-trait-surface-rust-signatures).)

22.3 WHILE the new family's SLA documents include the required `profile_id` field with the new family's canonical id THE binary SHALL accept and dispatch them via the `ProfileRegistry`. (P-DISP-1)

#### Requirement 23: Implement `OracleEvaluator<Sla, Evidence>`

**User Story:** As an oracle author, I want a clear trait contract for evaluation, so that my domain logic is small, testable, and isolated from the chain / HTTP / DB layers.

#### Acceptance Criteria

23.1 WHEN the author implements the `OracleEvaluator` trait THEN their type SHALL declare associated types `Sla: DeserializeOwned + Serialize + Send + Sync` and `Evidence: DeserializeOwned + Serialize + Send + Sync` and provide `fn profile_id() -> &'static str` returning the canonical id.

23.2 WHEN `evaluate(&self, ctx, sla, evidence)` is called THEN it SHALL return a deterministic `EvaluationResult` such that two independent invocations with identical inputs produce identical `(approved, resolution_reason, checks)`. (P-DET-1)

23.3 IF `evaluate` returns `approved=true` THEN every check in `result.checks` SHALL have `passed=true`. (P-VER-1)

23.4 IF `evaluate` returns `approved=false` THEN at least one check in `result.checks` SHALL have `passed=false` AND `result.resolution_reason` SHALL match the documented code for the first failing check in the family's documented ordering. (P-VER-2)

23.5 WHEN `evaluate` returns `approved=true` THEN `result.resolution_reason` SHALL equal `0` (`ResolutionReason::None`). (P-VER-3)

#### Requirement 24: Optional custom `EvidenceFetcher`

**User Story:** As an oracle author of a non-JSON family (e.g. file-delivery), I want to plug in a streaming fetcher, so that I can verify multi-GiB blobs without loading them into memory.

#### Acceptance Criteria

24.1 WHEN an author provides a custom impl of `EvidenceFetcher` (e.g. `RegistryStreamingFetcher`) THEN the implementation SHALL verify `SHA256(raw bytes) == hash` before parsing or returning, fail-closed on mismatch with `OracleError::EvidenceNotFound`. (P-HASH-1, P-HASH-2, P-HASH-3)

24.2 WHILE a streaming fetcher is in use the implementation SHALL bound memory usage to a fixed buffer regardless of total bytes fetched (≤64 KiB read buffer + ≤512 bytes MIME-sniff window). (See [design.md §Performance Considerations](design.md#performance-considerations).)

24.3 WHEN the underlying transport returns a `5xx` for a registry-by-hash fetch THEN the fetcher SHALL retry up to `EVIDENCE_FETCH_MAX_RETRIES` times with exponential backoff seeded by `EVIDENCE_FETCH_RETRY_BASE_MS` and SHALL fail-closed on the final retry.

#### Requirement 25: Register the new `profile_id`

**User Story:** As an oracle author, I want my binary to register exactly one profile id at startup, so that the dispatcher refuses any work outside that profile.

#### Acceptance Criteria

25.1 WHEN the binary starts THEN `main.rs` SHALL build one `ProfileRegistry`, register exactly one `RegisteredProfile`, and the registry's `resolve(profile_id)` SHALL return that runner only for the canonical id.

25.2 IF the binary is configured with zero or more than one `RegisteredProfile` THEN the binary SHALL refuse to start. (C10)

25.3 WHILE the binary is running it SHALL refuse any SLA whose parsed `profile_id` does not exactly equal the registered id. (P-DISP-1)

#### Requirement 26: Allocate custom `ResolutionReason::Custom(code)` values within the reserved range

**User Story:** As an oracle author, I want to allocate per-family custom resolution-reason codes from a documented range, so that downstream indexers and dashboards can disambiguate verdicts across families.

#### Acceptance Criteria

26.1 WHEN a new transfer-family rejection code is added THEN it SHALL fall in `[256, 319]`. (C6)

26.2 WHEN a new file-delivery rejection code is added THEN it SHALL fall in `[320, 383]`. (C6)

26.3 WHILE the `[384, 447]` range is reserved future authors SHALL NOT allocate there until the `compute-result` family ships.

26.4 WHILE the `[448, 511]` range is reserved for ecosystem-wide additions authors SHALL coordinate with maintainers before allocating.

26.5 WHILE the `[512, 65535]` range is per-deployment authors MAY allocate freely; the chain accepts any `u16`.

#### Requirement 27: Publish a normative spec

**User Story:** As an ecosystem maintainer, I want every shipped family to have a normative spec with JSON Schemas and examples, so that buyers and sellers and other oracle authors can implement against an unambiguous contract.

#### Acceptance Criteria

27.1 WHEN a new family ships THEN the crate SHALL publish a normative document at `<crate>/spec/<profile>-v<n>/NORMATIVE.md` describing the SLA shape, evidence shape, evaluation semantics, trust model, and `resolution_reason` codes used.

27.2 WHEN the family's profile id is `x402/<family>/<profile>/<version>` THEN the crate SHALL publish JSON Schemas for the SLA (and evidence, where applicable) under `<crate>/spec/<profile>-v<n>/schema/` AND example documents under `<crate>/spec/<profile>-v<n>/examples/`. (See *CI Smoke Tests* for validation.)

27.3 WHEN CI runs for the workspace THEN a "schema lint" job SHALL validate every example SLA / evidence file against its JSON Schema and fail the build on any mismatch.

### Requirements for the pr402 Facilitator (Specification-Only)

These requirements describe the contract pr402 will adopt in a follow-up spec. Implementing them is out of scope for this spec; we lock the JSON shapes here so pr402's spec can reference us without further negotiation.

#### Requirement 28: Validate `accepts[].extra.oracleProfiles[]` invariants

**User Story:** As pr402, I want to validate that a seller's advertised `oracleProfiles[]` is internally consistent before passing it to a buyer, so that buyers cannot be misled into funding the wrong oracle authority.

#### Acceptance Criteria

28.1 WHILE pr402 proxies a seller's `accepts[].extra` for the `sla-escrow` scheme it SHALL verify that every `oracleProfiles[].operatorPubkey` also appears in `oracleAuthorities[]`; if not, pr402 SHALL reject the advertisement. (P-CAP-1)

28.2 WHILE proxying the advertisement pr402 SHALL verify that no `operatorPubkey` appears in two `oracleProfiles[]` entries (one profile per authority in v1); if it does, pr402 SHALL reject the advertisement. (C10)

#### Requirement 29: Advertise `slaEscrowOracleProfiles[]`

**User Story:** As pr402, I want to advertise the families I know about and a default operator pubkey per family in `/api/v1/facilitator/capabilities`, so that buyers without a seller advertisement can still find a credible oracle.

#### Acceptance Criteria

29.1 WHEN pr402 responds to `GET /api/v1/facilitator/capabilities` THEN the response body SHALL contain a `slaEscrowOracleProfiles[]` array shaped per [design.md §Buyer ↔ Oracle Discovery Contract](design.md#buyer--oracle-discovery-contract); each entry SHALL contain `profileId`, `normativeSpecUrl`, `defaultOperatorPubkey`, `repositoryPath`.

29.2 WHILE pr402 advertises a `defaultOperatorPubkey` for a profile THE pubkey SHALL appear in pr402's configured `ORACLE_AUTHORITIES` env list. (P-CAP-2)

29.3 WHEN pr402 advertises optional fields (`supportedClusters`, `supportedMints`, `maxBlobBytes`, `registryBaseUrl`) THE values SHALL be advisory; the oracle SHALL remain authoritative when it rejects a payment.

### Cross-Cutting Requirements

#### Requirement 30: On-chain program is unchanged

**User Story:** As an ecosystem maintainer, I want this work to leave the on-chain `sla-escrow` program completely alone, so that the deployed program ID, instructions, account layouts, and events keep their existing audit history.

#### Acceptance Criteria

30.1 WHEN this spec ships THEN no instruction, account struct, event, or constant in `sla-escrow/api/` or `sla-escrow/program/` SHALL be modified. (C1)

30.2 WHEN this spec ships THEN `sla-escrow-api` SHALL be consumed via crates.io at the `0.3.x` major version; no fork SHALL be created. (C4)

30.3 WHEN any oracle binary settles a payment THEN it SHALL use the existing `EscrowSdk::confirm_oracle` method to build the `ConfirmOracle` instruction. (C1, C4)

#### Requirement 31: Content-addressed registry

**User Story:** As any registry user, I want uploads to be content-addressed by SHA-256, so that identical bytes always produce the same hash and concurrent identical uploads dedup deterministically.

#### Acceptance Criteria

31.1 WHEN any seller uploads bytes via `POST /v1/registry/{sla|delivery|blob}` THEN the registry SHALL key the result by `SHA256(raw bytes)` and SHALL include that hash in the response. (P-REG-1)

31.2 WHEN two distinct sellers upload identical bytes for the same `kind` concurrently THEN both calls SHALL succeed with the same `sha256` and `oracle_deliveries` SHALL hold exactly one row for `(sha256_hex, kind)`. (P-REG-4)

31.3 WHEN any reader fetches `GET /v1/registry/{sha256_hex}` THEN the response body SHALL hash to the path component or the request SHALL fail. (P-REG-1, P-HASH-1, P-HASH-2)

#### Requirement 32: Deterministic `resolution_hash`

**User Story:** As any auditor, I want every verdict's `resolution_hash` to be a pure function of inputs, so that I can replay it and detect tampering at the on-chain payment level.

#### Acceptance Criteria

32.1 WHEN the settler computes `resolution_hash` THEN it SHALL serialize a `x402/oracles/resolution-envelope/v1` JSON object with fixed key order (`profile`, `evaluatorProfile`, `paymentUid`, `paymentPubkey`, `slaHash`, `deliveryHash`, `approved`, `resolutionReason`, `details`) and the per-family `details` shape, and compute SHA-256 over the serialized bytes. (C9, P-DET-2)

32.2 WHEN the same `(payment_uid, payment_pubkey, sla_hash, delivery_hash, evaluatorProfile, approved, resolutionReason, details)` is presented twice THE produced 32-byte digest SHALL be identical (no clock or random component). (P-DET-2)

32.3 WHILE the recipe envelope id is `x402/oracles/resolution-envelope/v1` THE design SHALL not ship a parallel "legacy" recipe; there is exactly one canonical envelope. (C9)

#### Requirement 33: Verify-before-parse

**User Story:** As any oracle binary, I want to verify the SHA-256 of fetched bytes before any further parsing, so that hash mismatches always fail closed.

#### Acceptance Criteria

33.1 WHEN any registry-backed fetch (JSON or streaming) returns bytes THEN the fetcher SHALL compute `SHA256(raw bytes)` and compare against the on-chain hash before parsing. (C5, P-HASH-1, P-HASH-2, P-HASH-3)

33.2 IF the computed digest differs from the on-chain hash THEN the fetcher SHALL return `OracleError::EvidenceNotFound` (with the computed digest in the message) and the oracle SHALL refuse to settle the job. (P-HASH-1, P-HASH-2, P-HASH-3)

33.3 IF a streaming fetch terminates before reaching the declared content length THEN the fetcher SHALL return `OracleError::EvidenceNotFound` AND the file-delivery oracle SHALL reject with `Custom(323)` (`BlobUploadIncomplete`) when settlement was already in progress.

#### Requirement 34: Fail-closed on registry / RPC errors

**User Story:** As any oracle binary, I want to fail closed when I cannot fetch evidence or parse the chain state, so that I never approve a payment based on incomplete data.

#### Acceptance Criteria

34.1 IF the registry returns a final `5xx` after `EVIDENCE_FETCH_MAX_RETRIES` retries THEN the oracle SHALL mark the job `failed` (or `dead_letter` after `ORACLE_DEAD_LETTER_MAX_ATTEMPTS`) and SHALL NOT submit `ConfirmOracle`. (P-HASH-1, P-HASH-2)

34.2 IF the transfer family's `getTransaction(tx_signature)` returns `None` THEN the evaluator SHALL reject with `Custom(256)` (`TransferTxNotFound`) and the settler SHALL submit a rejection verdict. (P-OT-2)

34.3 IF the transfer family's tx is on-chain but `meta.err.is_some()` THEN the evaluator SHALL reject with `Custom(257)` (`TransferTxFailed`) and the settler SHALL submit a rejection verdict. (P-OT-3)

34.4 IF an unknown profile id is encountered at dispatch THEN the oracle SHALL refuse the job (no settlement) per Requirement 21. (P-DISP-1)

#### Requirement 35: Eligibility uses the on-chain Clock

**User Story:** As any oracle binary, I want to compare `expires_at` against the on-chain Clock sysvar, so that a wall-clock skew on the operator's host cannot cause a settle for an expired payment (or refuse a still-live one).

#### Acceptance Criteria

35.1 WHEN `is_eligible(state, job)` runs THEN it SHALL fetch the Solana `Clock` sysvar and compare `Clock.unix_timestamp` against `payment.expires_at`. (P-AUTH-4)

35.2 WHILE `Clock.unix_timestamp > payment.expires_at` the eligibility check SHALL return `false` and the oracle SHALL NOT submit `ConfirmOracle`. (P-AUTH-4)

35.3 IF the Clock fetch fails THEN the oracle SHALL fall back to wall clock with a logged warning (degraded mode) AND SHALL still refuse if the wall clock indicates expiry.

35.4 WHILE `payment.delivery_timestamp == 0` the eligibility check SHALL return `false` and the oracle SHALL NOT submit `ConfirmOracle`. (P-AUTH-2)

35.5 WHILE `payment.resolution_state != 0` the eligibility check SHALL return `false`. (P-AUTH-3)

35.6 WHILE `payment.oracle_authority != self.pubkey` the eligibility check SHALL return `false`. (P-AUTH-1)

#### Requirement 36: Per-family resolution-reason ranges

**User Story:** As an ecosystem maintainer, I want resolution-reason ranges to be reserved per family, so that downstream consumers can disambiguate verdicts across families.

#### Acceptance Criteria

36.1 WHILE the transfer family is in use the binary SHALL only emit custom reason codes in `[256, 263]` (TransferTxNotFound, TransferTxFailed, TransferAmountInsufficient, TransferMintMismatch, TransferDeadlineExceeded, TransferClusterMismatch, TransferRecipientNotResolvable, TransferDirectionMismatch). (C6)

36.2 WHILE the file-delivery family is in use the binary SHALL only emit custom reason codes in `[320, 323]` (BlobSizeOutOfRange, BlobMimeMismatch, BlobAttestorSignatureInvalid, BlobUploadIncomplete). (C6)

36.3 WHILE the api-quality family is in use the binary SHALL only emit standard reason codes (`StatusCodeOutOfRange=1`, `LatencyExceeded=2`, `SchemaValidationFailed=3`, `RequiredFieldsMissing=4`, `BodyTooShort=5`, plus `0=None` and `255=GeneralRejection`).

#### Requirement 37: JSON Schemas exist and validate

**User Story:** As an integrator, I want canonical JSON Schemas for every family's SLA (and evidence where applicable), so that I can validate my documents in CI before signing or funding.

#### Acceptance Criteria

37.1 WHEN this spec ships THEN `oracle-api-quality/spec/api-quality-v1/schema/sla-document.schema.json` AND `delivery-evidence.schema.json` SHALL exist and be referenced from `NORMATIVE.md`.

37.2 WHEN this spec ships THEN `oracle-onchain-transfer/spec/onchain-transfer-v1/schema/sla-document.schema.json` AND `delivery-evidence.schema.json` SHALL exist.

37.3 WHEN this spec ships THEN `oracle-file-delivery/spec/file-delivery-attestation-v1/schema/sla-document.schema.json` SHALL exist (the evidence is the blob itself, no JSON schema is needed).

37.4 WHEN CI runs THEN every `examples/*.json` in each family's spec directory SHALL validate against its schema; failures SHALL fail the build.

37.5 WHEN a binary parses an SLA at runtime AND `ORACLE_STRICT_PROFILE=true` THEN it SHALL also validate the parsed object against the family's JSON Schema before evaluation.

#### Requirement 38: Single primary writer per oracle authority

**User Story:** As an oracle operator, I want the operational rule "one primary per authority pubkey" to be observable in failure modes, so that running two binaries against the same key is at most a debugging nuisance and never a double-settlement.

#### Acceptance Criteria

38.1 WHEN two binaries with the same oracle keypair attempt to settle the same `payment_uid` THE on-chain `ConfirmOracle` instruction SHALL accept exactly one (the first to land); the second SHALL fail with the existing on-chain `InvalidPaymentState` error. (C1)

38.2 WHILE both binaries share the same Postgres `DATABASE_URL` THE first to set `oracle_jobs.status='settled'` SHALL win; the second SHALL observe `is_terminal == true` on its dedupe probe and skip the job. (P-IDEM-1, P-IDEM-3)

38.3 WHILE the binaries do NOT share a Postgres database THE on-chain idempotency in 38.1 SHALL still hold; only one settlement transaction can land. (P-IDEM-1)


## Property Coverage Map

Every correctness property from [design.md §Correctness Properties](design.md#correctness-properties) is validated by at least one acceptance criterion below. The cross-reference uses `RequirementN.M` to point at the binding criterion.

| Property | Short Name | Validates |
|---|---|---|
| **P-HASH-1** | SLA bytes round-trip | 10.2, 31.3, 33.1, 33.2, 34.1 |
| **P-HASH-2** | Delivery bytes round-trip | 10.2, 31.3, 33.1, 33.2, 34.1 |
| **P-HASH-3** | Streaming blob digest | 10.2, 24.1, 33.1, 33.2 |
| **P-AUTH-1** | Pubkey match required | 9.2, 19.5, 35.6 |
| **P-AUTH-2** | Delivery must be submitted | 35.4 |
| **P-AUTH-3** | Verdict cannot override | 35.5 |
| **P-AUTH-4** | Expiry uses on-chain Clock | 35.1, 35.2 |
| **P-DET-1** | Evaluator output stable | 23.2 |
| **P-DET-2** | Resolution hash is pure | 11.1, 11.2, 32.1, 32.2 |
| **P-VER-1** | Approval requires all checks pass | 23.3 |
| **P-VER-2** | Rejection requires failing check, first-failure reason | 11.4, 23.4 |
| **P-VER-3** | Approvals carry reason None | 11.3, 23.5 |
| **P-DISP-1** | Profile dispatch — required, exact match | 6.2, 21.1, 21.2, 22.3, 25.3, 34.4 |
| **P-AQ-1** | API-quality profile_id discipline | 21.1 (delegates to dispatch), 25.3, 36.3 |
| **P-AQ-2** | API-quality conjunction of checks | 23.3, 23.4, 36.3 |
| **P-OT-1** | Onchain-transfer cluster pinning | 36.1 (Custom 261 in range) |
| **P-OT-2** | Onchain-transfer transaction must exist | 34.2, 36.1 |
| **P-OT-3** | Onchain-transfer failed transactions reject | 34.3, 36.1 |
| **P-OT-4** | Onchain-transfer delta gates approval | 23.4, 36.1 |
| **P-OT-5** | Onchain-transfer direction enforced | 23.4, 36.1 |
| **P-OT-6** | Onchain-transfer deadline enforced | 23.4, 36.1 |
| **P-FD-1** | File-delivery size bounds | 23.4, 36.2 |
| **P-FD-2** | File-delivery MIME match | 23.4, 36.2 |
| **P-FD-3** | File-delivery attestor signature | 23.4, 36.2 |
| **P-IDEM-1** | Terminal state blocks rerun | 15.4, 20.2, 38.2, 38.3 |
| **P-IDEM-2** | Duplicate in-flight events absorbed | 20.3 |
| **P-IDEM-3** | Restart preserves settled jobs | 15.4, 20.1, 38.2 |
| **P-REG-1** | Registry round-trip integrity | 2.2, 10.1, 31.1, 31.3 |
| **P-REG-2** | Registry size limit enforcement | 2.4, 3.3, 4.2 |
| **P-REG-3** | Registry auth — revoked tokens fail | 2.5, 3.3, 4.5, 7.1, 7.2 |
| **P-REG-4** | Registry idempotency — concurrent identical uploads dedup | 2.2, 3.4, 31.2 |
| **P-CAP-1** | operatorPubkey listed in oracleAuthorities | 5.3, 9.3, 28.1 |
| **P-CAP-2** | Capabilities advertise only configured authorities | 29.2 |

All 33 properties are cited.

## Out of Scope

The following are explicitly out of scope for this spec; each has a clear successor or is a deliberate non-goal:

- **Modifying the on-chain `sla-escrow` program.** The on-chain layer is intentionally agnostic to oracle types; all extension lives off-chain. (C1)
- **Implementing pr402 changes.** The facilitator's `/capabilities.slaEscrowOracleProfiles[]` and `accepts[].extra.oracleProfiles[]` validation are spec'd here (Requirements 28, 29) but implemented in a separate pr402 spec.
- **Modifying `x402-buyer-starter` / `x402-seller-starter`** to add `sla-escrow` flows. The starters are currently `exact`-only; adding `sla-escrow` + per-family discovery is greenfield work in separate specs.
- **The `compute-result/v1` family.** The `api-quality/v1` family functionally covers JSON-shaped deterministic answers (factorization, etc.) for v1; specialization is a future spec.
- **Stronger file-delivery profiles.** `x402/file-delivery/semantic/v1` (deep semantic check) and `x402/file-delivery/handoff/v1` (escrowed handoff with key release) are explicit roadmap items, not v1.
- **Multi-cluster transfer oracle in a single binary.** Operators run one `oracle-onchain-transfer` binary per cluster.
- **Cross-family ledger sharing.** Each family runs its own Postgres database (or schema). Shared-ledger deployment is unsupported in v1.
- **Multi-oracle aggregation / quorum at the chain level.** The on-chain `Payment.oracle_authority` is a single pubkey by design; multi-oracle adjudication, if needed, lives off-chain in pr402 or a future wrapper.
- **Multi-profile-per-binary.** v1 is one binary per family. Operators wanting more than one family on a host run multiple binaries via the templated systemd unit. (C10)

## Open Questions

None — all open issues from the design phase have been locked in (see [design.md §Design Decisions Locked In](design.md#design-decisions-locked-in)).

