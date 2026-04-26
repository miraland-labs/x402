# Devnet intensive test plan — UniversalSettle + SLA-Escrow

Program IDs (devnet): **UniversalSettle** `u84EMHTHwMeFpT9M2tNoHi9vBNjev4jxi9CsrFAjjWf` · **SLA-Escrow** `s5zkKiy8FD9nFdAhQZoHHV3G8s4QCPzE4cR9U4Hr4ZH`

Wallets: `demo-wallets/{buyer,seller,oracle}-keypair.json`. Admin defaults: `~/.config/solana/test-id.json` (PRIMARY), `~/.config/solana/id.json` (SECONDARY for timelock tests).

## UniversalSettle — instruction coverage

| Instruction | Script / path | Notes |
|-------------|---------------|--------|
| Initialize | `scripts/initialize.sh` | **Skip in regression** (one-time; already done on devnet). |
| CreateVault | `create-vault.sh` | Idempotent failure OK if vault exists. |
| Sweep | `sweep.sh` | SOL + devnet USDC; `--fee-destination` must match on-chain config (except sharding fee leg routing). |
| UpdateFeeRate | `update-fee-rate.sh` | Mutate + restore defaults. |
| UpdateFeeDestination | `update-fee-destination.sh` | **Round-trip:** default `6gHjm9ePi6du1YoR8TjEGG4Tm8dBGCw7CUhuFMgtFbwf` ↔ alt `BeALNhc8tykF6wJBZWyXGEkb9Mfvk8JZk8miUL2JDuhw` with SOL+USDC sweeps after each change (`devnet-phase-a-full-coverage.sh`). |
| UpdateMinFeeAmount | `update-min-fee-amount.sh` | SPL min; restore. |
| UpdateMinFeeAmountSol | `update-min-fee-amount-sol.sh` | SOL min; restore. |
| UpdateProvisioningFee | `update-provisioning-fee.sh` | Restore. |
| UpdateDiscountedFeeRate | `update-discounted-fee-rate.sh` | Restore. |
| InitShard | `init-shard.sh` | After **UpdateShardConfig** enables sharding. |
| CollectFromShard | `collect-from-shard.sh` | SOL + USDC; then **UpdateShardConfig** `use_fee_shard=0`. |
| UpdateShardConfig | `update-shard-config.sh` | Run sharding tests **after** other admin mutators, **before** authority transfer tests. |
| UpdateAuthority | `update-authority.sh` | Proposes transfer (timelock). |
| AcceptAuthority | `accept-authority.sh` | New authority signs after delay. |
| CancelAuthorityProposal | `cancel-authority-proposal.sh` | Only when a proposal PDA exists (see *Known behaviors*). |

**Orchestrator:** `universalsettle/scripts/devnet-phase-a-full-coverage.sh`  
**Timelock round-trip (both directions):** `x402/test_authority_transfer.sh` (3 min + 15 s padding per propose; ~13.5 min for both programs).

## SLA-Escrow — instruction coverage

| Instruction | Script / path | Notes |
|-------------|---------------|--------|
| Initialize | `initialize.sh` | **Skip** if bank exists. |
| FundPayment | CLI / `e2e-devnet-demo-wallets.sh` | SOL + devnet USDC. |
| SubmitDelivery | CLI | |
| ConfirmOracle | CLI | |
| ReleasePayment | CLI | |
| RefundPayment | `devnet-phase-b-extended-flows.sh` | After oracle reject + config cooldown tweak. |
| ClosePayment | extended flows | |
| ExtendPaymentTTL | `extend-payment-ttl.sh` | |
| OpenEscrow | `open-escrow.sh` | Per-mint PDAs (skip if exist). |
| CloseEscrow | admin tail (disposable mint) | |
| UpdateAuthority / AcceptAuthority / CancelAuthorityProposal | `update-authority.sh` etc. | Same timelock model as UniversalSettle. |
| WithdrawFees | `test-withdraw-fees.sh` + admin tail | **SOL + USDC**; `--to` treasury; verify `Fee Balance` before/after. |
| UpdateConfig | `update-config.sh` | Extended flows may set refund cooldown 0 temporarily. |
| UpdateEscrowSettings | `update_escrow_settings.sh` | SOL + USDC escrow PDAs. |
| PauseEscrow | CLI | USDC + SOL toggle 1/0. |

**Orchestrator:** `sla-escrow/scripts/devnet-phase-b-orchestrator.sh` (e2e → withdraw-fees → extended → admin tail).

## Amounts (this round)

- UniversalSettle sweeps: ~**0.12 SOL** / **~1.1 USDC** base; shard leg slightly higher (env overrides in phase script).
- SLA-Escrow: **0.5 SOL** / **2 USDC** per e2e + withdraw-fees rails (`FUND_AMOUNT_SOL` / `FUND_AMOUNT_USDC` / `FUND_SOL` / `FUND_USDC`).

## Known behaviors (not blocking mainnet if documented)

1. **CancelAuthorityProposal** with **no** pending proposal: the AuthorityTransfer PDA is uninitialized; both programs return **InvalidAccountOwner** in simulation. Treat as “nothing to cancel” or add CLI preflight. Optional future program change: explicit error for uninitialized transfer PDA.
2. Some CLIs print **“Authority updated successfully”** on **UpdateAuthority** even though the on-chain effect is only a **proposal** until **AcceptAuthority** — wording only.

## Mainnet readiness (Apr 2026 devnet run)

After this round: **both programs behaved consistently** on devnet for exercised paths (dual mint, fee destination, sharding off restore, WithdrawFees, two-step authority with 180 s delay). **Recommend** external audit, multisig / hardware authority, and runbooks for timelock + cancel semantics before mainnet cutover.
