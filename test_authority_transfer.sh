#!/usr/bin/env bash
#
# Devnet: two-step authority transfer (timelock) for UniversalSettle and SLA-Escrow.
# Default: PRIMARY=~/.config/solana/test-id.json, SECONDARY=~/.config/solana/id.json
#
# On-chain delay: AUTHORITY_TRANSFER_DELAY_SECONDS = 180 (3 minutes) in both programs.
# This script sleeps (DELAY_SECONDS + 15) between propose and accept for clock skew.
#
# Env:
#   RPC_URL, DELAY_SECONDS (default 180),
#   ADMIN_PRIMARY_KEYPAIR, ADMIN_SECONDARY_KEYPAIR,
#   UNIVERSALSETTLE_CLI, SKIP_UNIVERSALSETTLE, SKIP_SLA_ESCROW
#
set -euo pipefail

RPC_URL="${RPC_URL:-https://devnet.helius-rpc.com/?api-key=5207c547-a878-46ef-892d-cae1446de8bf}"
DELAY_SECONDS="${DELAY_SECONDS:-180}"
SLEEP_PAD="${SLEEP_PAD:-15}"
PRIMARY_KP="${ADMIN_PRIMARY_KEYPAIR:-$HOME/.config/solana/test-id.json}"
SECONDARY_KP="${ADMIN_SECONDARY_KEYPAIR:-$HOME/.config/solana/id.json}"

X402_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
US_ROOT="$X402_ROOT/universalsettle"
SLA_SCRIPTS="$X402_ROOT/sla-escrow/scripts"
UNIVERSALSETTLE_CLI="${UNIVERSALSETTLE_CLI:-$US_ROOT/target/release/universalsettle}"
PRIORITY_FEE="${PRIORITY_FEE:-1}"

SKIP_UNIVERSALSETTLE="${SKIP_UNIVERSALSETTLE:-0}"
SKIP_SLA_ESCROW="${SKIP_SLA_ESCROW:-0}"

WAIT_SEC=$((DELAY_SECONDS + SLEEP_PAD))

usage() {
  cat <<'EOF'
Usage: ./test_authority_transfer.sh [--rpc <URL>]

  Round-trip authority: PRIMARY → SECONDARY (accept after delay) → PRIMARY (accept after delay).

  Requires both keypairs; current on-chain authority must be PRIMARY before running.
  Clears any stale authority proposal (cancel) — ignores errors if none pending.

  Set SKIP_UNIVERSALSETTLE=1 or SKIP_SLA_ESCROW=1 to run only one program.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc)
      RPC_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

command -v solana >/dev/null || {
  echo "❌ solana CLI not found"
  exit 1
}
[[ -f "$PRIMARY_KP" && -f "$SECONDARY_KP" ]] || {
  echo "❌ Missing keypair: PRIMARY=$PRIMARY_KP SECONDARY=$SECONDARY_KP"
  exit 1
}

PRIMARY_PK="$(solana address -k "$PRIMARY_KP")"
SECONDARY_PK="$(solana address -k "$SECONDARY_KP")"

us_fetch_authority() {
  "$UNIVERSALSETTLE_CLI" config --rpc "$RPC_URL" --keypair "$PRIMARY_KP" --priority-fee "$PRIORITY_FEE" \
    | sed -n 's/^ *Authority: //p' | head -1 | tr -d '[:space:]'
}

sla_fetch_authority() {
  local out
  out=$("$X402_ROOT/sla-escrow/target/release/sla-escrow" program --rpc "$RPC_URL" --keypair "$PRIMARY_KP" 2>&1) || true
  echo "$out" | sed -n 's/^ *Authority: //p' | head -1 | tr -d '[:space:]'
}

echo "=============================================="
echo " Authority transfer (timelock) — Devnet"
echo "=============================================="
echo " RPC:       $RPC_URL"
echo " PRIMARY:   $PRIMARY_PK"
echo " SECONDARY: $SECONDARY_PK"
echo " Wait:      ${WAIT_SEC}s after each propose"
echo ""

if [[ "$SKIP_UNIVERSALSETTLE" != "1" ]]; then
  [[ -x "$UNIVERSALSETTLE_CLI" ]] || {
    echo "❌ Build UniversalSettle CLI: (cd $US_ROOT && cargo build --release -p universalsettle-cli)"
    exit 1
  }
  us_before="$(us_fetch_authority)"
  if [[ -z "$us_before" ]]; then
    echo "❌ UniversalSettle: could not read authority"
    exit 1
  fi
  if [[ "$us_before" != "$PRIMARY_PK" ]]; then
    echo "❌ UniversalSettle: expected authority $PRIMARY_PK, got $us_before"
    exit 1
  fi

  echo ">>> UniversalSettle: cancel stale proposal (ok if none)"
  "$UNIVERSALSETTLE_CLI" cancel-authority-proposal --yes \
    --rpc "$RPC_URL" --keypair "$PRIMARY_KP" --priority-fee "$PRIORITY_FEE" 2>/dev/null || true

  echo ">>> UniversalSettle [1/4] propose PRIMARY → SECONDARY"
  "$UNIVERSALSETTLE_CLI" update-authority --new-authority "$SECONDARY_PK" --yes \
    --rpc "$RPC_URL" --keypair "$PRIMARY_KP" --priority-fee "$PRIORITY_FEE"

  echo ">>> UniversalSettle: sleeping ${WAIT_SEC}s for timelock..."
  sleep "$WAIT_SEC"

  echo ">>> UniversalSettle [2/4] accept (signer = SECONDARY)"
  "$UNIVERSALSETTLE_CLI" accept-authority --yes \
    --rpc "$RPC_URL" --keypair "$SECONDARY_KP" --priority-fee "$PRIORITY_FEE"

  us_mid="$(us_fetch_authority)"
  if [[ "$us_mid" != "$SECONDARY_PK" ]]; then
    echo "❌ UniversalSettle: after accept expected $SECONDARY_PK, got $us_mid"
    exit 1
  fi

  echo ">>> UniversalSettle [3/4] propose SECONDARY → PRIMARY"
  "$UNIVERSALSETTLE_CLI" update-authority --new-authority "$PRIMARY_PK" --yes \
    --rpc "$RPC_URL" --keypair "$SECONDARY_KP" --priority-fee "$PRIORITY_FEE"

  echo ">>> UniversalSettle: sleeping ${WAIT_SEC}s for timelock..."
  sleep "$WAIT_SEC"

  echo ">>> UniversalSettle [4/4] accept (signer = PRIMARY)"
  "$UNIVERSALSETTLE_CLI" accept-authority --yes \
    --rpc "$RPC_URL" --keypair "$PRIMARY_KP" --priority-fee "$PRIORITY_FEE"

  us_after="$(us_fetch_authority)"
  if [[ "$us_after" != "$PRIMARY_PK" ]]; then
    echo "❌ UniversalSettle: restore failed; authority is $us_after"
    exit 1
  fi
  echo "✅ UniversalSettle authority restored to PRIMARY"
  echo ""
fi

if [[ "$SKIP_SLA_ESCROW" != "1" ]]; then
  ESCROW_CLI="$X402_ROOT/sla-escrow/target/release/sla-escrow"
  [[ -x "$ESCROW_CLI" ]] || {
    echo "❌ Build SLA CLI: (cd $X402_ROOT/sla-escrow && cargo build --release -p sla-escrow-cli --features admin)"
    exit 1
  }

  sla_before="$(sla_fetch_authority)"
  if [[ -z "$sla_before" ]]; then
    echo "❌ SLA-Escrow: could not read authority from \`sla-escrow program\`"
    exit 1
  fi
  if [[ "$sla_before" != "$PRIMARY_PK" ]]; then
    echo "❌ SLA-Escrow: expected authority $PRIMARY_PK, got $sla_before"
    exit 1
  fi

  echo ">>> SLA-Escrow: cancel stale proposal (ok if none)"
  "$ESCROW_CLI" cancel-authority-proposal --yes \
    --rpc "$RPC_URL" --keypair "$PRIMARY_KP" --fee-payer "$PRIMARY_KP" --priority-fee "$PRIORITY_FEE" 2>/dev/null || true

  echo ">>> SLA-Escrow [1/4] propose PRIMARY → SECONDARY"
  (cd "$SLA_SCRIPTS" && ./update-authority.sh --new-authority "$SECONDARY_PK" --yes \
    --rpc "$RPC_URL" --keypair "$PRIMARY_KP" --priority-fee "$PRIORITY_FEE")

  echo ">>> SLA-Escrow: sleeping ${WAIT_SEC}s for timelock..."
  sleep "$WAIT_SEC"

  echo ">>> SLA-Escrow [2/4] accept (signer = SECONDARY)"
  (cd "$SLA_SCRIPTS" && ./accept-authority.sh --yes \
    --rpc "$RPC_URL" --keypair "$SECONDARY_KP" --priority-fee "$PRIORITY_FEE")

  sla_mid="$(sla_fetch_authority)"
  if [[ "$sla_mid" != "$SECONDARY_PK" ]]; then
    echo "❌ SLA-Escrow: after accept expected $SECONDARY_PK, got $sla_mid"
    exit 1
  fi

  echo ">>> SLA-Escrow [3/4] propose SECONDARY → PRIMARY"
  (cd "$SLA_SCRIPTS" && ./update-authority.sh --new-authority "$PRIMARY_PK" --yes \
    --rpc "$RPC_URL" --keypair "$SECONDARY_KP" --priority-fee "$PRIORITY_FEE")

  echo ">>> SLA-Escrow: sleeping ${WAIT_SEC}s for timelock..."
  sleep "$WAIT_SEC"

  echo ">>> SLA-Escrow [4/4] accept (signer = PRIMARY)"
  (cd "$SLA_SCRIPTS" && ./accept-authority.sh --yes \
    --rpc "$RPC_URL" --keypair "$PRIMARY_KP" --priority-fee "$PRIORITY_FEE")

  sla_after="$(sla_fetch_authority)"
  if [[ "$sla_after" != "$PRIMARY_PK" ]]; then
    echo "❌ SLA-Escrow: restore failed; authority is $sla_after"
    exit 1
  fi
  echo "✅ SLA-Escrow authority restored to PRIMARY"
fi

echo ""
echo "✅ Authority round-trip complete for all enabled programs."
