# Oracle Active Guardian — Tasks

## Task 1: Add retry_count to EvaluationJob
- [ ] 1.1 Add `retry_count: u32` field to `EvaluationJob` in `oracle-common/src/types.rs`
- [ ] 1.2 Initialize to 0 in all existing constructors (chain.rs, tests)
- [ ] 1.3 Ensure `Clone` still works (field is Copy)

## Task 2: Add guardian config parameters
- [ ] 2.1 Add fields to `OracleConfig`: `retry_initial_delay_sec`, `retry_max_delay_sec`, `max_retry_attempts`, `reject_safety_margin_sec`
- [ ] 2.2 Parse from env with defaults (10, 120, 30, 600)
- [ ] 2.3 Surface in `/health` response

## Task 3: Add `is_retriable` error classification
- [ ] 3.1 Add `is_retriable(&OracleError) -> bool` in `oracle-common/src/error.rs`
- [ ] 3.2 Classify `SlaParse`, `EvidenceFetch`, transient `Evaluation` as retriable
- [ ] 3.3 Non-retriable: `UnknownProfile`, `Settlement`, `Chain` (structural failures)

## Task 4: Implement retry + fail-closed logic in worker
- [ ] 4.1 Add `near_expiry(job, config) -> bool` helper
- [ ] 4.2 Add `backoff_delay(attempt, config) -> Duration` helper
- [ ] 4.3 Add `guardian_reason(error) -> u16` helper (100/101/102 codes)
- [ ] 4.4 Modify worker loop: on retriable error, check near_expiry → reject or re-queue
- [ ] 4.5 On re-queue: increment retry_count, sleep backoff, send back to channel
- [ ] 4.6 On max retries exhausted: reject with EVALUATION_TIMEOUT (102)
- [ ] 4.7 Before reject: call `is_eligible()` to avoid wasting SOL on already-resolved payments

## Task 5: Add guardian metrics to /health
- [ ] 5.1 Add `guardian_rejects_issued: u64` to `RuntimeHealth`
- [ ] 5.2 Add `guardian_retries_total: u64` to `RuntimeHealth`
- [ ] 5.3 Increment on each retry attempt and each reject
- [ ] 5.4 Surface in `/health` JSON response

## Task 6: Unit tests
- [ ] 6.1 Test `backoff_delay` produces correct exponential series capped at max
- [ ] 6.2 Test `near_expiry` returns true/false at boundary
- [ ] 6.3 Test `is_retriable` classifies errors correctly
- [ ] 6.4 Test `guardian_reason` maps error variants to correct codes

## Task 7: Integration test (devnet)
- [ ] 7.1 Extend e2e test script with a `SKIP_SLA_UPLOAD=1` mode that skips step 7
- [ ] 7.2 Verify oracle retries and eventually rejects
- [ ] 7.3 Verify buyer can refund after oracle reject
- [ ] 7.4 Verify `/health` shows `guardian_rejects_issued > 0`

## Task 8: Documentation
- [ ] 8.1 Update `oracles/docs/DEPLOYMENT.md` with new env vars
- [ ] 8.2 Update `oracles/docs/OPERATIONS.md` with guardian behavior description
- [ ] 8.3 Add `ORACLE_ACTIVE_GUARDIAN.md` to `oracles/docs/` with full design rationale
