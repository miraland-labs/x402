# Oracle Active Guardian — Requirements

## Problem Statement

The current oracle implementation is a **passive evaluator**: it only reacts to
`SubmitDelivery` events and gives up on first SLA/evidence fetch failure. A
malicious seller can exploit this by calling `SubmitDelivery` (setting
`delivery_timestamp ≠ 0`) but deliberately withholding SLA/evidence bytes from
the registry. The oracle fails to evaluate, issues no verdict, and after
`expires_at` the seller self-releases via the "oracle ghosted" fallback path.

**Result: buyer loses funds despite seller never delivering.**

## Goal

Transform the oracle from a passive evaluator into an **active guardian that
defaults to buyer protection**. If the oracle cannot evaluate a payment within
its safety window, it proactively issues a REJECT verdict so the buyer can
refund.

## Requirements

### R1 — Retry with exponential backoff

When the pipeline fails due to missing SLA bytes or evidence (fetch 404 / parse
error), the worker MUST re-queue the job with exponential backoff instead of
dropping it.

- Initial delay: 10s (configurable via `ORACLE_RETRY_INITIAL_DELAY_SEC`).
- Max delay cap: 120s (configurable via `ORACLE_RETRY_MAX_DELAY_SEC`).
- Max attempts: 30 (configurable via `ORACLE_MAX_RETRY_ATTEMPTS`).
- Backoff formula: `min(initial * 2^attempt, max_delay)`.

### R2 — Fail-closed REJECT before expiry

If all retry attempts are exhausted OR the payment approaches expiry, the oracle
MUST issue `ConfirmOracle` with `resolution_state = 2` (REJECTED) and a
specific `resolution_reason` code indicating the failure class.

- Oracle reject safety margin: **600s (10 min)** by default (configurable via
  `ORACLE_REJECT_SAFETY_MARGIN_SEC`).
- This margin MUST be strictly larger than the on-chain
  `Config.delivery_cutoff_seconds` (default 300s / 5 min) to account for:
  - Retry backoff convergence time.
  - RPC latency and tx confirmation time.
  - Worker queue processing delay.
- **Invariant**: `oracle_reject_margin > delivery_cutoff + tx_confirmation_budget`.

### R3 — Resolution reason codes for guardian rejects

New `resolution_reason` values (u16) for oracle-initiated protective rejects:

| Code | Name | Meaning |
|------|------|---------|
| 100 | `SLA_UNAVAILABLE` | SLA bytes not retrievable from registry after retries |
| 101 | `EVIDENCE_UNAVAILABLE` | Evidence bytes not retrievable after retries |
| 102 | `EVALUATION_TIMEOUT` | Pipeline did not complete within safety margin |

These codes are informational (the on-chain program treats any
`resolution_state=2` as a rejection regardless of reason). They exist for
off-chain audit, dashboards, and dispute resolution.

### R4 — Retry state tracking

`EvaluationJob` gains a `retry_count: u32` field (default 0). Each re-queue
increments it. The worker uses this to compute the next backoff delay and to
decide whether to give up.

### R5 — Oracle tightens its own cutoff (stricter than on-chain)

The oracle's reject-safety-margin (10 min default) is intentionally **stricter**
than the on-chain `delivery_cutoff_seconds` (5 min). This means:

- A seller who submits delivery at `expires_at - 6 min` (passing the on-chain
  cutoff) may still face an oracle that already decided to reject at
  `expires_at - 10 min`.
- This is **by design**: it incentivizes sellers to deliver promptly and upload
  artifacts well before the deadline.
- The oracle's margin is an operator-tunable knob; production deployments with
  faster infra can tighten it further.

### R6 — No on-chain program changes

The sla-escrow program already supports `ConfirmOracle` with
`resolution_state=2` and arbitrary `resolution_reason` u16. No program upgrade
is needed.

### R7 — Idempotent reject

If the oracle attempts to reject but `resolution_state` is already non-zero
(another oracle instance or a race), the tx fails on-chain harmlessly. The
worker should treat this as "already handled" and not retry the reject.

### R8 — Logging and observability

Every retry attempt and the final reject decision MUST be logged at INFO level
with the `payment_uid` hex, attempt number, and reason. The `/health` endpoint
should surface:
- `guardian_rejects_issued`: count of protective rejects since startup.
- `guardian_retries_total`: cumulative retry attempts.

## Out of scope (future work)

- **FundPayment watchdog**: subscribing to FundPayment events to start a timer
  even before SubmitDelivery. This would catch sellers who never call
  SubmitDelivery at all (currently safe because `delivery_timestamp=0` blocks
  release). Deferred because the current on-chain rules already protect the
  buyer in that case.
- **Buyer-uploaded SLA**: having the buyer upload SLA bytes directly to the
  registry (removing seller from the upload path entirely). This eliminates the
  "seller withholds SLA" vector at the protocol level. Requires buyer-side
  tooling changes.
