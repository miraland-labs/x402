# Requirements Document

## Introduction

The Buy SPL Token Endpoint adds a paid HTTP endpoint to the existing x402 facilitator service that lets a buyer purchase a configured SPL token (for example the Merry Xmas token on devnet, mint `5bpyckh5YBVG5fB63PSm4BGPjD5sw1TwBtU5GGd9VRRP`) for a fixed USDC price using the x402 / SLA-Escrow flow. The endpoint operates in two phases: an unpaid `GET` returns an HTTP 402 challenge whose `accepts[].extra` carries a server-built TransferSla and its `slaHash`; a follow-up `GET` with a `PAYMENT-SIGNATURE` header that satisfies that exact `slaHash` triggers verify-and-settle of the buyer's USDC `FundPayment`, an SPL `TransferChecked` of the purchased token from the seller treasury to the buyer's recipient owner, an evidence upload to the registry, and a `SubmitDelivery` call against the SLA. A Postgres-backed purchase-order ledger keyed on `payment_uid` enforces idempotency and a strict state machine across retries, and a Postgres advisory lock plus per-request fresh blockhash protect against concurrent double-spend or duplicate transfers.

The token catalog (mint, decimals, USDC price, optional sender treasury ATA, display name) is config-driven via the `BUY_SPL_TOKEN_CATALOG_JSON` environment variable, with an optional Postgres parameters-row override. The seller signing key is loaded once at cold start from the `SELLER_KEYPAIR_BASE58` Vercel encrypted environment variable into application state and is reused for both the SPL transfer and the delivery submission. At cold start, the service fetches each catalog entry's on-chain Mint account and aborts startup if any decimals byte does not match the configured value. Existing components are reused unchanged: `FacilitatorClient::verify_and_settle`, `PaymentHandler::check_payment`, `RetryPolicy` from `rpc_retry.rs`, and the 402/CORS/`X-API-Version` response shape from the existing `check_balance` endpoint.

## Glossary

- **Buy_Endpoint**: The HTTP handler at `GET /api/v1/buy-spl-token` implemented in `src/api/buy_handlers.rs`.
- **Token_Catalog**: The parsed list of configured purchasable tokens, sourced from environment variable `BUY_SPL_TOKEN_CATALOG_JSON` and optionally overridden by a Postgres parameters row, parsed by `src/catalog.rs`.
- **Catalog_Entry**: A single Token_Catalog item with fields `mint`, `decimals`, `price_usdc_ui`, `name`, and optional `sender_treasury_ata`.
- **Catalog_Validator**: The cold-start routine in `src/catalog.rs` that fetches each Catalog_Entry's on-chain Mint account and compares its decimals byte to the configured value.
- **SLA_Builder**: The component in `src/sla_builder.rs` that constructs a canonical TransferSla JSON document from query parameters and computes `sla_hash = SHA256(canonical_sla_json)`.
- **Sla_Hash**: The 32-byte SHA-256 digest, hex-encoded, of the canonical TransferSla JSON.
- **Sla_Url**: The HTTPS URL at which the uploaded canonical TransferSla JSON is retrievable from the evidence registry.
- **Registry_Client**: The HTTP client in `src/registry_client.rs` that uploads SLAs and delivery evidence to the evidence registry.
- **Seller_Signer**: The component in `src/seller_signer.rs` that loads the seller keypair from environment variable `SELLER_KEYPAIR_BASE58` once at cold start and exposes it via `AppState`.
- **Order_Ledger**: The Postgres-backed purchase-order store in `src/orders.rs` keyed on `payment_uid` (primary key) with schema migration `migrations/0002_purchase_orders.sql`.
- **Order_State**: One of the values `pending_transfer`, `transfer_landed`, `delivery_submitted`, `completed`, or `failed`.
- **Payment_Uid**: The unique payment identifier extracted from the buyer's submitted `FundPayment` and used as the primary key in the Order_Ledger.
- **Buyer_Nonce**: A 32-byte hex-encoded buyer-supplied nonce passed as query parameter `buyer_nonce`, included verbatim in the canonical TransferSla.
- **Recipient_Owner**: The Solana public key passed as query parameter `recipient_owner`, used as the owner of the destination associated token account for the purchased SPL token transfer.
- **Facilitator_Client**: The existing `FacilitatorClient::verify_and_settle` component reused without modification.
- **Payment_Handler**: The existing `PaymentHandler::check_payment` component reused without modification.
- **Retry_Policy**: The existing retry policy from `src/rpc_retry.rs` reused without modification.
- **Transfer_Evidence**: The strongly-typed Rust builder output (in `src/registry_client.rs`) that produces the delivery evidence JSON conforming to the published evidence JSON schema.
- **Advisory_Lock**: A Postgres advisory lock acquired on a 64-bit hash of `payment_uid` for the duration of a settlement attempt.
- **Fresh_Blockhash**: A Solana recent blockhash fetched immediately before signing each on-chain transaction in a request.

## Requirements

### Requirement 1: Token Catalog Configuration and Cold-Start Validation

**User Story:** As a service operator, I want the purchasable-token catalog to be configured via environment variables and validated against on-chain mint metadata at cold start, so that misconfigured decimals cannot cause incorrect raw-unit transfers in production.

#### Acceptance Criteria

1. WHEN the service starts, THE Token_Catalog SHALL be parsed from environment variable `BUY_SPL_TOKEN_CATALOG_JSON` as a JSON array of Catalog_Entry objects with required fields `mint`, `decimals`, `price_usdc_ui`, `name`, and optional field `sender_treasury_ata`.
2. WHERE a Postgres parameters row containing a catalog override is present, THE Token_Catalog SHALL use the Postgres-sourced catalog instead of the environment-sourced catalog.
3. IF environment variable `BUY_SPL_TOKEN_CATALOG_JSON` is absent and no Postgres parameters override is present, THEN THE Buy_Endpoint SHALL abort startup with a configuration error.
4. IF `BUY_SPL_TOKEN_CATALOG_JSON` fails to parse as a JSON array of Catalog_Entry objects, THEN THE Buy_Endpoint SHALL abort startup with a configuration error.
5. IF a Catalog_Entry's `mint` field is not a valid base58-encoded Solana public key, THEN THE Buy_Endpoint SHALL abort startup with a configuration error.
6. IF a Catalog_Entry's `decimals` field is outside the range 0 through 18 inclusive, THEN THE Buy_Endpoint SHALL abort startup with a configuration error.
7. IF a Catalog_Entry's `price_usdc_ui` field is not a positive decimal number, THEN THE Buy_Endpoint SHALL abort startup with a configuration error.
8. WHEN the service starts, THE Catalog_Validator SHALL fetch the on-chain Mint account for each Catalog_Entry's `mint` from the configured Solana RPC endpoint.
9. IF any Catalog_Entry's configured `decimals` does not match the decimals byte of its on-chain Mint account, THEN THE Catalog_Validator SHALL abort startup with an error identifying the mismatched mint, configured decimals, and on-chain decimals.
10. IF the Catalog_Validator cannot fetch an on-chain Mint account for any Catalog_Entry after applying the Retry_Policy, THEN THE Catalog_Validator SHALL abort startup with an error identifying the unreachable mint.

### Requirement 2: Seller Signer Initialization

**User Story:** As a service operator, I want the seller keypair to be loaded once at cold start from an encrypted environment variable, so that the same key signs both the SPL transfer and the delivery submission without per-request key material handling.

#### Acceptance Criteria

1. WHEN the service starts, THE Seller_Signer SHALL load the seller keypair from environment variable `SELLER_KEYPAIR_BASE58` decoded as a base58-encoded private key.
2. WHEN the service starts, THE Seller_Signer SHALL store the loaded keypair in `AppState` for reuse across requests.
3. IF environment variable `SELLER_KEYPAIR_BASE58` is absent, THEN THE Seller_Signer SHALL abort startup with a configuration error.
4. IF environment variable `SELLER_KEYPAIR_BASE58` fails base58 decoding or does not yield a valid Solana keypair, THEN THE Seller_Signer SHALL abort startup with a configuration error.
5. WHEN signing the SPL `TransferChecked` transaction and the `SubmitDelivery` transaction within a single Buy_Endpoint request, THE Seller_Signer SHALL use the keypair loaded at cold start.

### Requirement 3: Unpaid GET Returns 402 with Server-Built SLA

**User Story:** As a buyer, I want an unpaid `GET /api/v1/buy-spl-token` request to return a 402 challenge whose `accepts[].extra` includes the exact `slaHash` and `slaUrl` of a server-built TransferSla, so that I can sign a `FundPayment` against that SLA hash and retry.

#### Acceptance Criteria

1. WHEN a `GET /api/v1/buy-spl-token` request arrives without a `PAYMENT-SIGNATURE` header and with required query parameters `token`, `recipient_owner`, and `buyer_nonce`, THE Buy_Endpoint SHALL respond with HTTP status 402.
2. WHEN building the 402 response, THE SLA_Builder SHALL construct a canonical TransferSla JSON document including the `recipient_owner` query parameter as the SLA's recipient owner field.
3. WHEN building the 402 response, THE SLA_Builder SHALL include the `buyer_nonce` query parameter verbatim in the canonical TransferSla.
4. WHEN building the 402 response, THE SLA_Builder SHALL compute `sla_hash = SHA256(canonical_sla_json)` over the byte-exact canonical JSON serialization.
5. WHEN building the 402 response, THE Registry_Client SHALL upload the canonical TransferSla JSON to the evidence registry and obtain its `Sla_Url`.
6. WHEN responding with HTTP 402, THE Buy_Endpoint SHALL populate `accepts[].extra.slaHash` with the computed `Sla_Hash` and `accepts[].extra.slaUrl` with the obtained `Sla_Url`.
7. WHEN responding with HTTP 402, THE Buy_Endpoint SHALL set the USDC payment amount in the `accepts[]` entry to the Catalog_Entry's `price_usdc_ui` converted to USDC raw units.
8. WHEN responding with HTTP 402, THE Buy_Endpoint SHALL emit the same response envelope shape, CORS headers, and `X-API-Version` header used by the existing `check_balance` endpoint.
9. IF the `token` query parameter does not match the `mint` of any Catalog_Entry, THEN THE Buy_Endpoint SHALL respond with HTTP status 404 and a JSON error body identifying the unknown token.
10. IF the `recipient_owner` query parameter is not a valid base58-encoded Solana public key, THEN THE Buy_Endpoint SHALL respond with HTTP status 400 and a JSON error body identifying the invalid parameter.
11. IF the `buyer_nonce` query parameter is not exactly 64 lowercase hexadecimal characters, THEN THE Buy_Endpoint SHALL respond with HTTP status 400 and a JSON error body identifying the invalid parameter.
12. IF any required query parameter among `token`, `recipient_owner`, and `buyer_nonce` is missing, THEN THE Buy_Endpoint SHALL respond with HTTP status 400 and a JSON error body listing the missing parameter names.

### Requirement 4: Paid GET Settles Payment, Transfers SPL, and Submits Delivery

**User Story:** As a buyer, I want a `GET /api/v1/buy-spl-token` request carrying a valid `PAYMENT-SIGNATURE` to verify and settle my USDC payment, transfer the purchased SPL token to my recipient owner, upload delivery evidence, and submit delivery against the SLA, so that I receive both the on-chain token and a verifiable delivery record.

#### Acceptance Criteria

1. WHEN a `GET /api/v1/buy-spl-token` request arrives with a `PAYMENT-SIGNATURE` header and required query parameters, THE Payment_Handler SHALL validate the payment proof using `PaymentHandler::check_payment`.
2. IF `PaymentHandler::check_payment` rejects the submitted payment proof, THEN THE Buy_Endpoint SHALL respond with HTTP status 402 and a JSON error body identifying the validation failure.
3. IF the `slaHash` referenced by the submitted `FundPayment` does not equal the `Sla_Hash` recomputed from the request's query parameters, THEN THE Buy_Endpoint SHALL respond with HTTP status 402 and a JSON error body identifying the SLA-hash mismatch.
4. WHEN the submitted payment proof is accepted, THE Facilitator_Client SHALL execute `verify_and_settle` against the buyer's `FundPayment` before any SPL token transfer is signed.
5. IF `FacilitatorClient::verify_and_settle` returns a non-success result, THEN THE Buy_Endpoint SHALL respond with HTTP status 402 and a JSON error body identifying the settlement failure and SHALL NOT submit any SPL transfer transaction.
6. WHEN `verify_and_settle` succeeds, THE Buy_Endpoint SHALL build and sign a Solana SPL `TransferChecked` instruction using the Seller_Signer that transfers `price_units = price_usdc_ui * 10^decimals` raw units of the Catalog_Entry's `mint` from the seller treasury ATA to the associated token account owned by `recipient_owner`.
7. WHEN building each on-chain transaction within the request, THE Buy_Endpoint SHALL fetch a Fresh_Blockhash from the configured Solana RPC endpoint immediately before signing.
8. WHERE the Catalog_Entry includes `sender_treasury_ata`, THE Buy_Endpoint SHALL use that value as the source ATA in the `TransferChecked` instruction.
9. WHERE the Catalog_Entry omits `sender_treasury_ata`, THE Buy_Endpoint SHALL derive the source ATA as the associated token account of the Seller_Signer's public key for the configured `mint`.
10. WHEN submitting the SPL `TransferChecked` transaction or any on-chain transaction in the request, THE Buy_Endpoint SHALL apply the Retry_Policy from `rpc_retry.rs`.
11. WHEN the SPL `TransferChecked` transaction is confirmed on-chain, THE Registry_Client SHALL build a Transfer_Evidence document using the strongly-typed Rust builder and upload it to the evidence registry.
12. WHEN the Transfer_Evidence upload succeeds, THE Buy_Endpoint SHALL build and sign a `SubmitDelivery` transaction using the Seller_Signer that references the SLA's `Sla_Hash` and the uploaded Transfer_Evidence URL.
13. WHEN the `SubmitDelivery` transaction is confirmed on-chain, THE Buy_Endpoint SHALL respond with HTTP status 200 and a JSON body containing the SPL transfer signature, the Transfer_Evidence URL, the `SubmitDelivery` signature, and the `Sla_Hash`.
14. WHEN responding with HTTP 200, THE Buy_Endpoint SHALL emit the same CORS headers and `X-API-Version` header used by the existing `check_balance` endpoint.

### Requirement 5: Idempotency on Payment_Uid

**User Story:** As a buyer, I want retries of the same paid request to return the original transaction signatures rather than performing a second transfer, so that network or client retries cannot cause double delivery.

#### Acceptance Criteria

1. WHEN a paid Buy_Endpoint request is accepted, THE Order_Ledger SHALL insert a row keyed on `Payment_Uid` with initial Order_State `pending_transfer` before any on-chain transaction is signed.
2. WHEN advancing through Order_State values, THE Order_Ledger SHALL transition `pending_transfer` to `transfer_landed`, then to `delivery_submitted`, then to `completed`, using `UPDATE ... WHERE state = <previous_state>` for each transition.
3. IF an `UPDATE ... WHERE state = <previous_state>` affects zero rows, THEN THE Buy_Endpoint SHALL abort the current request without retrying the on-chain action and SHALL respond based on the current persisted Order_State.
4. WHEN a Buy_Endpoint request arrives with a `Payment_Uid` whose Order_Ledger row is in Order_State `completed`, THE Buy_Endpoint SHALL respond with HTTP status 200 and the stored SPL transfer signature, Transfer_Evidence URL, and `SubmitDelivery` signature without performing any new on-chain transaction.
5. WHEN a Buy_Endpoint request arrives with a `Payment_Uid` whose Order_Ledger row is in Order_State `transfer_landed` or `delivery_submitted`, THE Buy_Endpoint SHALL resume processing from the next pending step using the stored prior signatures and SHALL NOT re-sign or re-submit the steps already recorded as complete.
6. IF an on-chain transaction within a Buy_Endpoint request fails after exhausting the Retry_Policy, THEN THE Order_Ledger SHALL transition the row to Order_State `failed` and THE Buy_Endpoint SHALL respond with HTTP status 502 and a JSON error body identifying the failed step.
7. WHEN a Buy_Endpoint request arrives with a `Payment_Uid` whose Order_Ledger row is in Order_State `failed`, THE Buy_Endpoint SHALL respond with HTTP status 409 and a JSON error body identifying the prior failure.
8. THE migration `migrations/0002_purchase_orders.sql` SHALL define a `purchase_orders` table with `payment_uid` as primary key, an Order_State column constrained to the values `pending_transfer`, `transfer_landed`, `delivery_submitted`, `completed`, and `failed`, and columns to persist the SPL transfer signature, Transfer_Evidence URL, and `SubmitDelivery` signature.

### Requirement 6: Concurrency and Nonce Safety

**User Story:** As a service operator, I want concurrent requests for the same `Payment_Uid` to be serialized and each on-chain transaction to use a fresh blockhash, so that double-spend and stale-blockhash failures cannot occur.

#### Acceptance Criteria

1. WHEN a paid Buy_Endpoint request begins processing, THE Buy_Endpoint SHALL acquire a Postgres Advisory_Lock keyed on a deterministic 64-bit hash of `Payment_Uid` before reading or writing the Order_Ledger row.
2. WHEN the Buy_Endpoint request completes processing, THE Buy_Endpoint SHALL release the Advisory_Lock.
3. IF acquiring the Advisory_Lock for `Payment_Uid` would block beyond the configured request timeout, THEN THE Buy_Endpoint SHALL respond with HTTP status 409 and a JSON error body indicating that another request for the same `Payment_Uid` is in progress.
4. WHEN signing each on-chain transaction within a Buy_Endpoint request, THE Buy_Endpoint SHALL fetch a Fresh_Blockhash immediately before signing rather than reusing a blockhash from an earlier step.

### Requirement 7: Evidence Schema Conformance

**User Story:** As an evidence registry operator, I want every uploaded Transfer_Evidence document to conform to the published evidence JSON schema, so that downstream consumers can rely on a stable shape.

#### Acceptance Criteria

1. WHEN producing a Transfer_Evidence document, THE Registry_Client SHALL construct it using a strongly-typed Rust builder whose output shape matches the published evidence JSON schema field-for-field.
2. WHEN producing a Transfer_Evidence document, THE Registry_Client SHALL validate the serialized JSON against the published evidence JSON schema before uploading.
3. IF JSON-schema validation of a Transfer_Evidence document fails, THEN THE Registry_Client SHALL return a validation error to the Buy_Endpoint and SHALL NOT upload the document.
4. IF Transfer_Evidence schema validation fails, THEN THE Buy_Endpoint SHALL transition the Order_Ledger row to Order_State `failed` and SHALL respond with HTTP status 500 and a JSON error body identifying the schema-validation failure.
5. WHEN uploading the canonical TransferSla JSON during the unpaid-GET path, THE Registry_Client SHALL upload the byte-exact JSON over which `Sla_Hash` was computed.

### Requirement 8: Decimals and Raw-Units Calculation

**User Story:** As a buyer, I want the on-chain SPL transfer amount to exactly match `price_usdc_ui * 10^decimals` raw units of the configured token, so that I receive the precise quantity advertised in the catalog.

#### Acceptance Criteria

1. WHEN computing the SPL transfer amount, THE Buy_Endpoint SHALL compute `price_units = price_usdc_ui * 10^decimals` using the Catalog_Entry's `decimals` validated by the Catalog_Validator.
2. WHEN computing `price_units`, THE Buy_Endpoint SHALL use integer arithmetic that preserves exactness for `price_usdc_ui` values expressible with up to `decimals` fractional digits.
3. IF `price_usdc_ui` has more fractional digits than `decimals`, THEN THE Buy_Endpoint SHALL abort startup with a configuration error identifying the offending Catalog_Entry.
4. WHEN building the `TransferChecked` instruction, THE Buy_Endpoint SHALL pass the Catalog_Entry's `decimals` value as the instruction's `decimals` argument.

### Requirement 9: Error Responses

**User Story:** As a buyer, I want consistent, machine-readable error responses with appropriate HTTP status codes, so that my client can react correctly to each failure mode.

#### Acceptance Criteria

1. WHEN responding with any non-success status, THE Buy_Endpoint SHALL emit a JSON body with fields `error.code` (machine-readable string) and `error.message` (human-readable string).
2. WHEN responding with any non-success status, THE Buy_Endpoint SHALL emit the same CORS headers and `X-API-Version` header used by the existing `check_balance` endpoint.
3. IF an unexpected internal error occurs that is not covered by Requirements 1 through 8, THEN THE Buy_Endpoint SHALL respond with HTTP status 500 and a JSON error body whose `error.code` is `internal_error`.
4. IF a downstream Solana RPC call fails after exhausting the Retry_Policy, THEN THE Buy_Endpoint SHALL respond with HTTP status 502 and a JSON error body whose `error.code` identifies the failed RPC step.
5. IF the Registry_Client cannot reach the evidence registry after exhausting the Retry_Policy, THEN THE Buy_Endpoint SHALL respond with HTTP status 502 and a JSON error body whose `error.code` identifies the registry step that failed.
