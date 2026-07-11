#!/usr/bin/env bash
# UltraThink Core/OSS parity check.
# Asserts that shared-layer files are byte-identical between the two repos.
# See docs/TIER-MANIFEST.md for the canonical boundary.
set -euo pipefail

CORE="${CORE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
OSS="${OSS_DIR:-$CORE/../ultrathink-oss}"

if [ ! -d "$OSS" ]; then
  echo "OSS repo not found at $OSS; skipping parity check."
  exit 0
fi

# Files that MUST be byte-identical between Core and OSS.
SHARED_FILES=(
  ".claude/hooks/memory-auto-save.sh"
  ".claude/hooks/memory-session-start.sh"
  ".claude/hooks/memory-session-end.sh"
  ".claude/hooks/privacy-hook.sh"
  ".claude/hooks/prompt-analyzer.ts"
  ".claude/hooks/prompt-submit.sh"
  "memory/src/memory.ts"
  "memory/src/enrich.ts"
  "memory/src/hooks.ts"
  "memory/src/plans.ts"
  "memory/src/analytics.ts"
  "memory/src/client.ts"
)

fail=0

for f in "${SHARED_FILES[@]}"; do
  if [ ! -f "$CORE/$f" ]; then
    echo "MISSING in Core: $f"
    fail=1
    continue
  fi
  if [ ! -f "$OSS/$f" ]; then
    echo "MISSING in OSS:  $f"
    fail=1
    continue
  fi
  if ! diff -q "$CORE/$f" "$OSS/$f" >/dev/null 2>&1; then
    echo "DRIFT: $f"
    fail=1
  fi
done

# Migrations: every Core migration must exist in OSS with identical contents.
if [ -d "$CORE/memory/migrations" ]; then
  for m in "$CORE/memory/migrations/"*.sql; do
    [ -f "$m" ] || continue
    base="$(basename "$m")"
    if [ ! -f "$OSS/memory/migrations/$base" ]; then
      echo "MISSING in OSS:  memory/migrations/$base"
      fail=1
    elif ! diff -q "$m" "$OSS/memory/migrations/$base" >/dev/null 2>&1; then
      echo "DRIFT: memory/migrations/$base"
      fail=1
    fi
  done
fi

if [ $fail -eq 0 ]; then
  echo "Core/OSS parity OK."
else
  echo ""
  echo "Parity check FAILED. Reconcile drift before release."
  echo "See docs/TIER-MANIFEST.md for the shared-file manifest."
  exit 1
fi
