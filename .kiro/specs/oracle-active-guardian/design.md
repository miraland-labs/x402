# Oracle Active Guardian — Design

## Architecture: To-Be Flow

```
                    ON-CHAIN                           OFF-CHAIN (Oracle)
                    ════════                           ══════════════════

 ┌─────────────────────────────────────┐
 │  FundPayment lands                  │
 │  (buyer's USDC → escrow PDA)        │
 │  payment.delivery_timestamp = 0     │
 │  payment.resolution_state = 0       │
 └─────────────────────────────────────┘
                    │
                    │  (seller delivers off-chain,
                    │   uploads SLA + evidence to registry,
                    │   then calls SubmitDelivery)
                    │
                    ▼
 ┌─────────────────────────────────────┐
 │  SubmitDelivery                     │──────────────────────┐
 │  payment.delivery_hash = H          │                      │
 │  payment.delivery_timestamp = now   │                      │
 └─────────────────────────────────────┘                      │
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │  Chain Monitor                │
                                              │  (logsSubscribe on program)   │
                                              │  Detects DeliverySubmittedEvent│
                                              │  Reads Payment account        │
                                              │  Emits EvaluationJob          │
                                              └───────────────┬───────────────┘
                                                              │
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │  Worker picks up job          │
                                              │  (retry_count = 0)            │
                                              └───────────────┬───────────────┘
                                                              │
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │  Fetch SLA from registry      │
                                              │  (by payment.sla_hash)        │
                                              └───────────────┬───────────────┘
                                                              │
                                              ┌───────┴───────┐
                                              │               │
                                         SLA found       SLA NOT found
                                              │               │
                                              ▼               ▼
                                    ┌─────────────┐   ┌─────────────────────┐
                                    │ Fetch       │   │ Near expiry?        │
                                    │ Evidence    │   │ now > expires_at    │
                                    │ (by         │   │   - safety_margin   │
                                    │ delivery_   │   │   (10 min default)  │
                                    │ hash)       │   └──────┬──────────────┘
                                    └──────┬──────┘          │
                                           │          ┌──────┴──────┐
                                    ┌──────┴──────┐   YES           NO
                                    │             │    │             │
                               Evidence      Evidence  │             ▼
                               found         NOT found │   ┌─────────────────┐
                                    │             │    │   │ Re-queue job     │
                                    ▼             │    │   │ retry_count++    │
                          ┌──────────────┐        │    │   │ sleep(backoff)   │
                          │ Evaluate     │        │    │   │ → back to Worker │
                          │ SLA vs       │        │    │   └─────────────────┘
                          │ Evidence vs  │        │    │
                          │ on-chain tx  │        ▼    ▼
                          └──────┬───────┘   ┌─────────────────────────┐
                                 │           │  REJECT (fail-closed)   │
                          ┌──────┴──────┐    │  resolution_state = 2  │
                          │             │    │  reason = 100/101/102  │
                     APPROVE        REJECT   │  ConfirmOracle tx      │
                          │             │    └────────────┬────────────┘
                          ▼             ▼                 │
              ┌────────────────────────────┐              │
              │  ConfirmOracle (on-chain)  │◄─────────────┘
              │  resolution_state = 1 or 2 │
              └────────────┬───────────────┘
                           │
                           ▼
              ┌────────────────────────────┐
              │  ReleasePayment (if 1)     │
              │  OR                        │
              │  RefundPayment (if 2)      │
              │  (anyone can call)         │
              └────────────────────────────┘
```

## Component Changes

### 1. `oracle-common/src/worker.rs`

Current behavior:
```rust
match run_pipeline(...).await {
    Ok(outcome) => settle(... approved=outcome.result.approved ...),
    Err(e) => { error!("pipeline error: {e}"); /* job dropped */ }
}
```

New behavior:
```rust
match run_pipeline(...).await {
    Ok(outcome) => settle(... approved=outcome.result.approved ...),
    Err(e) if is_retriable(&e) => {
        if near_expiry(job, config) {
            // Fail-closed: protect buyer
            settle(... approved=false, reason=guardian_reason(&e) ...)
        } else if job.retry_count < config.max_retry_attempts {
            // Re-queue with backoff
            job.retry_count += 1;
            let delay = backoff_delay(job.retry_count, config);
            sleep(delay).await;
            tx.send(job).await;  // back to channel
        } else {
            // Exhausted retries, still not near expiry — reject anyway
            settle(... approved=false, reason=EVALUATION_TIMEOUT ...)
        }
    }
    Err(e) => { error!("non-retriable pipeline error: {e}"); }
}
```

### 2. `oracle-common/src/types.rs`

```rust
pub struct EvaluationJob {
    // ... existing fields ...
    pub retry_count: u32,  // NEW: starts at 0, incremented on each re-queue
}
```

### 3. `oracle-common/src/config.rs`

```rust
pub struct OracleConfig {
    // ... existing fields ...
    pub retry_initial_delay_sec: u64,      // default 10
    pub retry_max_delay_sec: u64,          // default 120
    pub max_retry_attempts: u32,           // default 30
    pub reject_safety_margin_sec: i64,     // default 600 (10 min)
}
```

### 4. `oracle-common/src/error.rs`

Add `is_retriable()` helper:
```rust
pub fn is_retriable(e: &OracleError) -> bool {
    matches!(e,
        OracleError::SlaParse(_)        // SLA bytes missing or malformed
        | OracleError::EvidenceFetch(_) // Evidence not in registry
        | OracleError::Evaluation(_)    // Transient evaluation failure
    )
}
```

### 5. Helper functions

```rust
fn near_expiry(job: &EvaluationJob, config: &OracleConfig) -> bool {
    let now = chrono::Utc::now().timestamp();
    now > job.expires_at - config.reject_safety_margin_sec
}

fn backoff_delay(attempt: u32, config: &OracleConfig) -> Duration {
    let delay = config.retry_initial_delay_sec * 2u64.pow(attempt.min(10));
    Duration::from_secs(delay.min(config.retry_max_delay_sec))
}

fn guardian_reason(e: &OracleError) -> u16 {
    match e {
        OracleError::SlaParse(_) => 100,       // SLA_UNAVAILABLE
        OracleError::EvidenceFetch(_) => 101,   // EVIDENCE_UNAVAILABLE
        _ => 102,                               // EVALUATION_TIMEOUT
    }
}
```

## Security Properties

| Property | Guarantee |
|----------|-----------|
| Buyer protection | If seller withholds artifacts, oracle rejects before expiry → buyer refunds |
| Seller fairness | If registry is temporarily down, oracle retries → artifacts arrive → fair evaluation |
| No false rejects on honest sellers | 10-min margin + 30 retries over ~20 min means any seller who uploads within first `TTL - 10min` gets evaluated |
| Oracle SOL cost bounded | Only 1 tx per job (either approve or reject); retries are off-chain sleeps |
| Idempotent | If another oracle instance already set resolution_state ≠ 0, the reject tx fails harmlessly on-chain |
| Deterministic | Same job + same registry state → same verdict. Retries don't change the evaluation logic |

## Oracle's Stricter Cutoff vs On-Chain Cutoff

```
Timeline:
├─── FundPayment ───────────────────────────────────────── expires_at ──►
│                                                                        │
│    ┌─── Seller must SubmitDelivery ───┐                                │
│    │    before (expires_at - 5min)    │  ← on-chain delivery_cutoff    │
│    │    (enforced by program)         │                                │
│    └──────────────────────────────────┘                                │
│                                                                        │
│              ┌─── Oracle rejects if no verdict ───┐                    │
│              │    at (expires_at - 10min)         │  ← oracle margin   │
│              │    (enforced by oracle worker)     │                    │
│              └───────────────────────────────────┘                    │
│                                                                        │
│    ════════════════════════════════════════════════                    │
│    ↑ Seller's effective window to deliver + upload:                    │
│    │ From FundPayment to (expires_at - 10min)                         │
│    │ = TTL - 10min (e.g. 3600 - 600 = 3000s = 50 min)                │
│    ════════════════════════════════════════════════                    │
```

The oracle's 10-min margin is **intentionally stricter** than the on-chain 5-min
`delivery_cutoff_seconds`. This creates a 5-min buffer between "oracle decides
to reject" and "on-chain program would have allowed SubmitDelivery". The buffer
absorbs:
- Oracle's own tx confirmation time (~10s on devnet, ~2s on mainnet).
- Queue processing delay if multiple jobs are pending.
- RPC latency spikes.

A seller who submits delivery at `expires_at - 7 min` passes the on-chain check
(7 > 5) but the oracle may have already rejected at `expires_at - 10 min`. This
is the intended trade-off: **prompt delivery is rewarded; last-second delivery
is risky.**

## Interaction with Existing `is_eligible` Check

The settler's `is_eligible()` already refuses to send `ConfirmOracle` if
`payment.resolution_state != 0` or `now > expires_at`. The guardian reject path
must call `is_eligible()` before sending the reject tx — if the payment already
expired or was resolved by another path, the reject is a no-op (saves SOL).

## Migration / Rollout

1. Deploy with default config (10s initial, 120s max, 30 attempts, 600s margin).
2. Monitor `guardian_rejects_issued` on `/health`. Should be 0 for honest sellers.
3. If false rejects appear (registry latency > 10 min), increase `ORACLE_REJECT_SAFETY_MARGIN_SEC`.
4. If sellers game the deadline, decrease the margin (minimum: `delivery_cutoff + 60s`).
