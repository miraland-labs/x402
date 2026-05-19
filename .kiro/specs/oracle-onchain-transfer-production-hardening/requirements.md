# Requirements Document

**Spec:** Oracle Onchain-Transfer Production Hardening

## Glossary

| Term | Meaning |
| --- | --- |
| **Built-in oracle** | The single `oracle-onchain-transfer` instance the pr402 facilitator operator runs themselves and advertises as the default for token-transfer scenarios in `/capabilities`. |
| **Ecosystem oracle** | An oracle implementing any profile (api-quality, file-delivery, future families), operated by a third party and listed on pr402 via the editorial registration template. |
| **Wedge** | The first concrete production use case driving hardening priorities. Here: AetherVane's Zodiac-token sale. |
| **`payment_uid`** | 32-byte unique id of one on-chain `Payment` PDA. Buyer-authored, hashed into `sla_hash` so the SLA is bound to one and only one payment. |
| **`buyer_nonce`** | Optional 32 random bytes the buyer adds to the SLA, defending cross-SLA replay across two buyers with otherwise-identical SLA terms. |
| **`tx_signature`** | Base58 Solana transaction signature. The sla-escrow program does NOT see it; the seller embeds it in delivery evidence so the oracle can re-derive deltas via `getTransaction(jsonParsed)`. |
| **Cross-payment replay** | A seller reusing one historical transfer (`tx_signature`) or one uploaded blob (`delivery_hash`) to settle two different payments. Already mitigated by `oracle_evidence_keys` in the oracle's ledger. |
| **Sender binding** | New optional check (Requirement 1) that pins the sender wallet of a verified transfer in addition to the recipient. |
| **Burn-in window** | Sustained devnet operation under synthetic load for ≥ 7 days, used to measure real per-settlement SOL spend and latency profiles before mainnet recommendations. |
| **Resolution code** | The `u16` rejection reason emitted by the oracle in `ConfirmOracle`. Family-specific codes for onchain-transfer reside in 256–319. |
| **`sla-escrow`** | The deployed Solana program that holds escrowed funds, accepts `FundPayment` / `SubmitDelivery` / `ConfirmOracle` / `ReleasePayment` / `RefundPayment` instructions. NOT modified by this spec. |

## Introduction

`oracle-onchain-transfer` is the strongest of the three reference oracles
in the `oracles/` workspace: it re-derives token deltas directly from
`getTransaction(jsonParsed)` on the Solana cluster the seller used,
which makes the on-chain ledger the ground truth for whether a transfer
happened. The previous Wave A and Wave B work landed cross-payment
replay protection, freshness lower bound, payment-uid binding, and
buyer-nonce echo. The codebase passes 124 tests with `cargo clippy
--workspace --all-targets -- -D warnings` clean.

What's missing is the operational and integration polish to call it
"production-ready" for a real-world wedge use case: a seller (e.g.
AetherVane) who pre-locks USDC against the seller's `oracle_authority`
and asks the oracle to verify that an SPL token (e.g. one of 12 Zodiac
sign mints) was transferred to a buyer-specified recipient wallet after
funding.

This spec scopes the gap-closing work for that wedge:

1. One small wire-format addition (optional `sender_owner` on
   `ExpectedTransfer`) for defense-in-depth.
2. Documentation gaps the AetherVane integrator (and similar future
   integrators) will hit: Token-2022 transfer-fee handling, the
   programmatic seller flow in Rust, and idempotency for crash-recovery.
3. End-to-end devnet validation against the deployed `sla-escrow`
   program, with captured evidence in `oracle-common/docs/devnet-evidence/`.
4. Operational telemetry: a one-week burn-in window with measured
   SOL/settlement cost data, written into `OPERATIONS.md` so the
   `0.2 SOL warning / 0.05 SOL critical` thresholds are based on
   measured reality rather than a guess.
5. pr402 positioning: `x402/oracles/onchain-transfer/v1` becomes the
   canonical recommended profile in pr402's `/capabilities` for
   token-transfer-shaped sla-escrow flows. (Documentation + parameter
   defaults; no new code paths in pr402.)

The on-chain `sla-escrow` program is **not** modified. The seller's
choice to use `oracle-onchain-transfer` is independent of `pr402`'s
choice to recommend it. Existing buyer-authored SLA flow
(`SLA_ESCROW_PROTOCOL.md` v1.0) is unchanged; this spec only refines
what `oracle-onchain-transfer` accepts and how integrators use it.

The reference scenario throughout this document is the AetherVane
Zodiac-token wedge:

> AetherVane (the seller) operates a wallet that holds 12 SPL token mints,
> one per Zodiac sign. A buyer pays $10 USDC per token via sla-escrow,
> specifies (a) the Zodiac mint, (b) a quantity 1–10, and (c) a recipient
> wallet that may differ from the buyer's payment wallet. After funding,
> the seller checks inventory, broadcasts a `TransferChecked`, and submits
> evidence pointing at that signature. The oracle verifies the right
> mint × right recipient × ≥ expected raw amount × right cluster, and
> settles. Each FundPayment binds **exactly one** Zodiac mint at a time;
> a buyer wanting two signs initiates two FundPayments.

This scenario shapes the requirements but is not the only valid use.
The same oracle profile generalizes to any deliverable that IS a Solana
token movement (vesting, payouts, refunds, yield distribution, bridge
legs).

---

## Requirements

### Requirement 1: Optional sender binding

**User Story:** As a buyer who pre-locks payment for a token transfer,
I want to optionally pin which Solana wallet the tokens come from, so
that a third party who somehow got hold of valid evidence cannot bind
their own historical transfer to my payment.

**Why this matters:** Cross-payment replay protection (Wave A §2.2.1)
already prevents the same `tx_signature` from settling two different
payments. Sender binding is independent: it ensures the verified
transfer originated from the wallet the seller controls, not just
"some wallet that happened to send the right tokens to the right
recipient." For AetherVane, this lets buyers explicitly pin
`sender_owner = AetherVane.zodiac_treasury_wallet`.

#### Acceptance Criteria

1.1 WHEN the SLA's `expected_transfers[i]` includes an optional
`sender_owner` field (base58 pubkey) THEN the oracle SHALL verify
that the same `(mint, sender_owner)` pair appears in the transaction's
`pre_token_balances` AND that the signed delta for the sender row is
negative (sender lost tokens) with magnitude at least `min_amount`.

1.2 WHEN the SLA's `expected_transfers[i].sender_owner` is unset
(absent from JSON) THEN the oracle SHALL skip the sender check
entirely; the existing recipient-side checks remain authoritative.
This preserves backward compatibility for SLAs authored before this
change.

1.3 WHEN `sender_owner` is set but no matching `(mint, sender_owner)`
row is found in the pre/post token-balance tables THEN the oracle
SHALL reject with a new resolution code
`TRANSFER_SENDER_MISMATCH = 269` in the `onchain_transfer` reserved
range (256-319).

1.4 WHEN `sender_owner` is set and a matching `(mint, sender_owner)`
row exists but the sender's signed delta is non-negative (sender
gained or stayed flat) THEN the oracle SHALL reject with
`TRANSFER_SENDER_MISMATCH = 269` (same code; the diagnostic detail
in `CheckResult` distinguishes "no row" from "wrong direction").

1.5 The new field SHALL be reflected in the JSON Schema at
`oracle-onchain-transfer/spec/onchain-transfer-v1/schema/sla-document.schema.json`
and an example added under `examples/`.

1.6 The new resolution code SHALL be added to the constant table in
`oracle-common/src/resolution_codes.rs` with rustdoc explaining when
it fires, and the existing range-overlap test SHALL be updated to
include it.

1.7 The `verify_observed_transfer` pure function SHALL gain unit-test
coverage for the four cases: sender-set + correct, sender-set + missing
row, sender-set + wrong direction, sender-unset + back-compat.

### Requirement 2: Token-2022 transfer-fee handling

**User Story:** As a seller using a Token-2022 mint with a transfer-fee
extension, I want to know exactly how to declare `min_amount` so my
deliveries don't get falsely rejected, AND I want the oracle to behave
predictably so I can plan around the fee.

**Why this matters:** Token-2022's transfer-fee extension reduces the
amount the recipient observes vs. what the sender sent. The oracle
reads `meta.postTokenBalances`, which already reflects the post-fee
amount (Solana's RPC computes this consistently). So the oracle
"works" — but a seller who declares `min_amount = gross` will produce
deliveries that fail because the recipient's net delta is less. This
is a documentation problem, not a code problem, but undocumented it
becomes a nasty integration bug.

#### Acceptance Criteria

2.1 The `oracle-onchain-transfer/spec/onchain-transfer-v1/NORMATIVE.md`
SHALL include a new subsection (e.g. §6.2 "Token-2022 transfer fees")
explaining that:

- The oracle reads post-fee deltas (via `meta.postTokenBalances`).
- For Token-2022 mints with a transfer fee, the buyer's `min_amount`
  MUST be the **expected post-fee amount** the recipient receives,
  NOT the gross amount the sender debits.
- For plain SPL Token mints (program id `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
  there is no fee path and `min_amount` equals what the sender sent.

2.2 The NORMATIVE document SHALL include a worked example: gross 100,
fee 1.5%, expected net = 98.5; a buyer declaring `min_amount = 98`
sees their delivery approve, a buyer declaring `min_amount = 100`
sees their delivery reject (fee was withheld and the recipient got 98.5).

2.3 The `SELLER_GUIDE.md` §4.B (onchain-transfer recipe) SHALL gain
a one-paragraph callout pointing to NORMATIVE §6.2 for Token-2022
mints, with a one-line check the seller can run:
`spl-token display $MINT_ADDRESS` to see whether a transfer-fee
extension is configured.

2.4 No oracle code change is required for this requirement; the
runtime behavior is already correct. Acceptance is purely the
presence and accuracy of the documentation, verified by reading the
two updated files end-to-end.

### Requirement 3: Programmatic Rust seller path

**User Story:** As a Rust integrator (AetherVane and similar) who
needs to build, broadcast, and report a `TransferChecked` from
production code rather than a shell session, I want a working code
example that shows the full loop.

**Why this matters:** SELLER_GUIDE.md §4.B currently shows a shell
recipe using `spl-token transfer` CLI. AetherVane's Zodiac flow
needs to be inside their service: receive an HTTP order → check
inventory → call `solana_client::nonblocking` → record the
`tx_signature` durably → upload evidence. The shell recipe doesn't
demonstrate any of this.

#### Acceptance Criteria

3.1 A new file SHALL be added at
`oracles/oracle-onchain-transfer/examples/programmatic_seller.rs`
demonstrating end-to-end:

- Decoding the SLA from registry by `sla_hash` to read
  `(mint, recipient_owner, min_amount, optional sender_owner,
  payment_uid, optional buyer_nonce)`.
- Building a `TransferChecked` instruction with the expected mint
  decimals.
- Broadcasting via `RpcClient::send_and_confirm_transaction`.
- Capturing the returned signature.
- Constructing the `TransferEvidence` JSON, echoing `payment_uid`
  and `buyer_nonce` verbatim.
- Posting evidence to `/v1/registry/delivery` and capturing the
  hash.
- Submitting `SubmitDelivery` on-chain via the
  `sla-escrow-api`'s `EscrowSdk` (or equivalent).

3.2 The example SHALL compile under the `oracle-onchain-transfer`
crate's `cargo build --examples` target.

3.3 The example SHALL be self-contained: any external dependencies
(e.g. `tokio`, `solana-client`, `sla-escrow-api`) SHALL already be
present in the workspace's `Cargo.toml` so no new deps need to be
added (other than dev-dep additions for the example itself, which
are acceptable).

3.4 A new section SHALL be added to `SELLER_GUIDE.md` §4.B
("Programmatic seller path") pointing at the example file with one
paragraph of context: "for service-side integrations like AetherVane
where the seller's broadcast-and-report logic lives inside a long-
running daemon, see the Rust example."

3.5 The example SHALL include a top-of-file comment block clearly
stating it is for **devnet** by default, with the env-var-driven
overrides needed to point at mainnet (so a copy-paste error doesn't
broadcast a real-money tx accidentally).

### Requirement 4: Idempotency for crash recovery

**User Story:** As a seller-side service that broadcasts SPL transfers
on behalf of a Zodiac order, I want the oracle's contract to make
crash recovery straightforward, so a service restart between broadcast
and evidence-submission doesn't double-send tokens or leave a payment
stuck.

**Why this matters:** A naïve seller broadcasts a `TransferChecked`,
crashes before `POST /v1/registry/delivery`, restarts, retries,
re-broadcasts, double-sends. The oracle's cross-payment replay
protection won't catch this because both transfers are for the same
`payment_uid`. This is a seller-side concern, but the oracle-side docs
need to document the contract clearly so integrators don't trip over
it.

#### Acceptance Criteria

4.1 The `SELLER_GUIDE.md` §4.B SHALL include a new subsection
"Idempotency contract" describing:

- The seller MUST durably persist `(payment_uid, tx_signature)` AFTER
  the broadcast call returns and BEFORE submitting evidence.
- On restart with no persisted signature, the seller MUST first query
  the chain for any pre-existing transfer matching the SLA's expected
  recipient + mint + `payment_uid`-derived ATA before re-broadcasting.
- The on-chain `Payment.delivery_hash` is committed at SubmitDelivery
  time, so a retry after SubmitDelivery succeeded is harmless (the
  on-chain program rejects the duplicate); but a retry of the broadcast
  AND SubmitDelivery sequence is not safe without the persisted
  signature.

4.2 The recommended persistence pattern (e.g. write `(payment_uid,
tx_signature)` to a single Postgres row keyed by `payment_uid` BEFORE
returning success to the order intake) SHALL be described in 5-10
lines of pseudocode in the same subsection.

4.3 The `programmatic_seller.rs` example from Requirement 3 SHALL
implement (in commented form, since the example is single-shot)
the durable-persistence pattern as a code comment block, so an
integrator copying the example sees where to insert their persistence
call.

4.4 A new property test SHALL be added to
`oracle-onchain-transfer/src/evaluator.rs::tests` verifying that two
different `tx_signature`s for the same `payment_uid` are independently
evaluable: the first to settle wins, the second sees an idempotency
short-circuit somewhere in the worker (specifically, the
`is_terminal()` check in `worker::run_worker` rejects the re-emission
of a settled job). This test SHALL fail in a controlled way if the
worker's terminal-check is regressed, providing a regression guard.

### Requirement 5: End-to-end devnet validation

**User Story:** As a pr402 facilitator operator about to flip
`oracle-onchain-transfer` to "production-recommended" status, I want
captured evidence of the full happy-path on real devnet hardware
against the deployed `sla-escrow` program, so I can confidently
include it in `/capabilities` as a default.

**Why this matters:** The oracle has 124 unit/integration tests with
mocked observations. Until it's processed a real `DeliverySubmittedEvent`
emitted by the deployed program and submitted a real `ConfirmOracle`
transaction that the program accepts, the production-readiness claim
is theoretical. Captured evidence in `devnet-evidence/` is also the
reference any future integrator will look at when their first
deployment doesn't work.

#### Acceptance Criteria

5.1 An end-to-end runbook SHALL execute against the deployed
sla-escrow devnet program ID:

- Buyer authors SLA with `payment_uid` + `buyer_nonce` + Zodiac-shaped
  expected transfer (devnet USDC mint
  `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, recipient = a fresh
  test wallet, `min_amount = 1_000_000` raw = 1 USDC).
- Seller registers, uploads SLA, broadcasts the matching `TransferChecked`
  on devnet, uploads delivery evidence, submits delivery on-chain.
- Oracle observes the event, fetches both artifacts, evaluates,
  submits `ConfirmOracle`.
- Buyer (or anyone) calls `ReleasePayment`. Tokens release to seller.

5.2 Each phase's terminal output, RPC explorer links, and Postgres
ledger snapshots SHALL be captured under
`oracles/oracle-common/docs/devnet-evidence/<YYYY-MM-DD>-onchain-transfer-prod-burn-in/`
following the existing naming convention.

5.3 The captured evidence SHALL include at minimum:

- `00-host-info.txt` — kernel, rustc version, oracle binary version
  (`oracle-onchain-transfer --version` output).
- `01-deploy.log` — `journalctl -u oracle@onchain-transfer.service`
  during the run.
- `02-fund-tx-explorer.txt` — explorer URL for the FundPayment tx.
- `03-broadcast-tx-explorer.txt` — explorer URL for the
  TransferChecked tx the seller broadcast.
- `04-submit-delivery-tx-explorer.txt` — explorer URL for SubmitDelivery.
- `05-confirm-oracle-tx-explorer.txt` — explorer URL for ConfirmOracle.
- `06-release-payment-tx-explorer.txt` — explorer URL for ReleasePayment.
- `07-oracle-jobs-after.tsv` — `psql ... -c "SELECT ... FROM oracle_jobs
  WHERE payment_uid = '<hex>'"` showing `status='settled'`,
  `resolution_reason=0`.
- `08-oracle-verdicts-after.tsv` — corresponding `oracle_verdicts` row
  showing `approved=true`, the recomputable `resolution_hash`, and the
  per-check pass/fail detail in JSONB form.
- `09-resolution-hash-recompute.txt` — independent third-party
  recomputation of `resolution_hash` from SLA + delivery + verdict
  envelope, confirming it matches the on-chain value.

5.4 At least one **negative** flow SHALL also be captured under
`<...>-onchain-transfer-prod-burn-in-rejection/`: same setup but
seller broadcasts the wrong amount, oracle rejects with
`TRANSFER_AMOUNT_INSUFFICIENT (258)`, buyer calls `RefundPayment`,
funds return.

### Requirement 6: Operational burn-in and telemetry

**User Story:** As an operator running this oracle, I want the
threshold values in `OPERATIONS.md` (SOL balance warnings, queue
depth alerts) to be based on measured devnet behavior over a
sustained window, not on guesses, so my alerts reflect reality.

**Why this matters:** The current OPERATIONS.md says "warning at
0.2 SOL, critical at 0.05 SOL." That's plausible but unverified. A
seven-day burn-in with synthetic load gives us actual data: per-
settlement SOL cost, p99 settlement latency, queue-depth peaks
under bursty input, RPC failure rate. This data also informs the
mainnet capacity recommendations.

#### Acceptance Criteria

6.1 The oracle SHALL run for ≥ 7 consecutive days against devnet,
processing a synthetic load (≥ 100 settlements/day, mix of approve
and reject verdicts) with monitoring continuously scraping
`/metrics` and `/health`.

6.2 At the end of the burn-in window, the following SHALL be
measured and recorded in `oracles/oracle-common/docs/devnet-evidence/<YYYY-MM-DD>-burn-in-summary.md`:

- p50, p95, p99 settlement latency (event observed → ConfirmOracle
  signature confirmed).
- p50, p95, p99 evidence-fetch latency.
- Mean / max SOL spend per settlement (lamports).
- Queue-depth histogram.
- Counter of dead-letter jobs and root-cause classification.
- Counter of `oracle_total_evidence_fetch_failures` with classification.
- WebSocket reconnect count and longest gap.

6.3 The measured per-settlement SOL spend SHALL be used to update
`OPERATIONS.md` §2 alert thresholds:

- Warning: balance below `2 × measured_max_per_settlement × 100`
  (covers ~100 settlements with margin).
- Critical: balance below `2 × measured_max_per_settlement × 10`
  (covers ~10 settlements).

The thresholds in OPERATIONS.md SHALL be updated to the rounded
values, with a footnote citing the burn-in measurement file.

6.4 If the burn-in surfaces any oracle-side bug or regression, it
SHALL be fixed before this requirement is closed; the burn-in
window restarts after the fix lands.

### Requirement 7: pr402 positioning as built-in oracle

**User Story:** As a buyer or seller asking pr402 "what oracle do
I use?" I want pr402's `/capabilities` to include an
`oracle-onchain-transfer` instance the operator runs themselves,
positioned as the recommended choice for token-transfer scenarios,
so I don't have to find an oracle operator before I can use sla-escrow.

**Why this matters:** Today an integrator who wants to use sla-escrow
must (a) find an oracle that handles their scenario and (b) trust
that oracle's operator. By running one canonical
`oracle-onchain-transfer` instance ourselves, we collapse step (a)
to "use the default" for the most common case, and we give
ourselves direct production-feedback. For other domains, the
ecosystem-recruitment program (Spec B) covers the recruitment.

#### Acceptance Criteria

7.1 The pr402 facilitator deployment SHALL run one
`oracle-onchain-transfer` instance owned by the pr402 operator,
deployed per `DEPLOYMENT.md` §1 quickstart and §2 production-grade
additions.

7.2 The pr402 `/capabilities` endpoint SHALL include the
`x402/oracles/onchain-transfer/v1` profile in
`slaEscrowOracleProfiles[]` with `defaultOperatorPubkey` set to the
oracle keypair from 7.1. This is achieved by setting the existing
`PR402_SLA_ESCROW_ONCHAIN_TRANSFER_DEFAULT_PUBKEY` parameter (DB or
env); no new pr402 code is required.

7.3 The pr402 deployment SHALL also set
`PR402_SLA_ESCROW_ONCHAIN_TRANSFER_REGISTRY_URL` to the
canonical registry URL (`https://<oracle-host>/v1/registry`) so the
optional health gate (`PR402_SLA_ESCROW_REQUIRE_ORACLE_HEALTHY`,
already implemented) can probe.

7.4 A new section SHALL be added to pr402's `agent-integration.md`
(or its successor) explaining: "This deployment ships one built-in
oracle, `x402/oracles/onchain-transfer/v1`. For other delivery
shapes, sellers are responsible for naming their own oracle in
`accepts[].extra.oracleProfiles[]`."

7.5 The pr402-side documentation SHALL note that the built-in oracle
is **operationally distinct** from the facilitator: a regression in
the oracle does not regress the facilitator; the operator may
disable the built-in oracle at any time by clearing the
`*_DEFAULT_PUBKEY` parameter (the profile then disappears from
`/capabilities` per existing pr402 logic).

7.6 No on-chain protocol change. No `sla-escrow` program change.
No new HTTP endpoint on pr402.

### Requirement 8: Marketing and integrator-facing positioning

**User Story:** As a prospective buyer or seller looking at pr402's
documentation, I want clear language about what's built-in versus
what's ecosystem-built, so I understand the trust I'm extending and
don't accidentally assume pr402 vouches for every oracle.

**Why this matters:** The oracle ecosystem is healthier when pr402's
role is honestly stated. We run one oracle (onchain-transfer); we
review and list ecosystem oracles editorially; we don't endorse them
as products of pr402.

#### Acceptance Criteria

8.1 The `oracles/docs/marketing/oracle-intro-article.md` SHALL be
updated to add one paragraph clarifying:

- pr402 ships and operates `oracle-onchain-transfer`.
- For api-quality, file-delivery, and any future profile, pr402
  reviews and lists ecosystem oracles via the GitHub registration
  template, but does NOT operate them.
- The trust extended to the built-in oracle is the trust extended
  to the pr402 operator; trust extended to ecosystem oracles is
  the trust extended to that oracle's listed operator.

8.2 The `BUYER_GUIDE.md` §2 ("Pick the right oracle") SHALL gain
one bullet noting that pr402's `/capabilities` lists the built-in
oracle as a default for token-transfer scenarios; for other
profiles, buyers SHOULD prefer an oracle that the seller advertises
in their HTTP-402 challenge.

8.3 The `SELLER_GUIDE.md` §2 ("Find the oracle's address") SHALL
gain a callout that pr402 advertises a default
onchain-transfer oracle, and sellers MAY use it directly without
running their own — though they're free to point buyers at a
different oracle (their own, or an ecosystem one) for trust or
performance reasons.

8.4 No code changes. Acceptance is the presence and clarity of the
three doc updates.

---

## Out of scope

- Modifications to the on-chain `sla-escrow` program. The deployed
  program ID and ABI are fixed.
- New oracle profiles (api-quality v2, file-delivery v2, signed-delivery,
  compute-result, etc). Spec B covers ecosystem recruitment which is
  the right home for those.
- Multi-mint atomic delivery in a single FundPayment. Per the user's
  decision, each FundPayment binds at most one Zodiac mint; multi-mint
  buyers initiate multiple FundPayments.
- Off-chain Token-2022 transfer-fee calculation. Buyers and sellers
  are responsible for setting `min_amount` correctly per their fee
  configuration; the oracle does not auto-adjust.
- Quorum / multi-oracle adjudication. v1 binds one oracle authority
  per payment.
- Mainnet promotion. This spec gates production-readiness on devnet
  burn-in evidence; mainnet rollout is a separate operational
  decision after acceptance criteria here are met.

---

## Acceptance summary

Production-readiness for `oracle-onchain-transfer` is reached when
all eight requirements above have their acceptance criteria met:

1. Optional `sender_owner` ships with tests + schema + new resolution code.
2. Token-2022 fee documentation lands in NORMATIVE + SELLER_GUIDE.
3. Programmatic Rust seller example compiles and is referenced from SELLER_GUIDE.
4. Idempotency contract documented; regression-guard test added.
5. End-to-end devnet evidence captured (happy + reject paths).
6. 7-day burn-in measured; OPERATIONS.md thresholds updated from real data.
7. pr402 deployment runs and advertises the built-in oracle.
8. Marketing language updated to honestly state built-in vs ecosystem.

After all eight close, `oracle-onchain-transfer` is production-ready
for token-transfer-shaped sla-escrow flows, including the AetherVane
Zodiac wedge.
