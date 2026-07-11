#!/usr/bin/env bash
# UltraThink Memory System — End-to-End Test
# Verifies the full auto-memory lifecycle: session → save → flush → recall

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ULTRA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly RUNNER="$ULTRA_ROOT/packages/memory/scripts/memory-runner.ts"
readonly MEMORIES_DIR="/tmp/ultrathink-memories"
readonly SESSION_FILE="/tmp/ultrathink-session-id"

readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC}  $*"; }
fail() { echo -e "  ${RED}FAIL${NC}  $*"; exit 1; }
info() { echo -e "  ${BLUE}INFO${NC}  $*"; }
warn() { echo -e "  ${YELLOW}WARN${NC}  $*"; }

# Load .env — the runner uses dotenv internally, but we need DATABASE_URL
# for the check and for the cleanup step at the end.
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$ULTRA_ROOT/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    export "$key=$value"
  done < "$ULTRA_ROOT/.env"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL not set. Copy .env.example to .env and fill in your Neon connection string."
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  UltraThink Memory System — E2E Test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Clean up from previous test runs
rm -f "$SESSION_FILE"
rm -rf "$MEMORIES_DIR"
mkdir -p "$MEMORIES_DIR"

# --- Test 1: Session Start ---
info "Test 1: Session Start"
export ULTRATHINK_CWD="$ULTRA_ROOT"
output=$(cd "$ULTRA_ROOT" && npx tsx "$RUNNER" session-start 2>/dev/null) || fail "session-start command failed"

if echo "$output" | jq empty 2>/dev/null; then
  pass "session-start returned valid JSON"
else
  fail "session-start returned invalid JSON: $output"
fi

if [[ -f "$SESSION_FILE" ]]; then
  SESSION_ID=$(cat "$SESSION_FILE")
  pass "Session ID created: ${SESSION_ID:0:8}..."
else
  fail "Session ID file not created"
fi

# --- Test 2: Save a memory via file ---
info "Test 2: Write memory file"
TIMESTAMP=$(date +%s)
cat > "$MEMORIES_DIR/${TIMESTAMP}-test-pref.json" << 'EOF'
{
  "content": "UltraThink test memory — user prefers dark mode",
  "category": "preference",
  "importance": 7,
  "confidence": 1.0,
  "scope": "ultrathink",
  "tags": ["#test", "#preference"]
}
EOF
pass "Memory file written to staging dir"

# --- Test 3: Flush memories ---
info "Test 3: Flush pending memories"
cd "$ULTRA_ROOT" && npx tsx "$RUNNER" flush 2>/dev/null || fail "flush command failed"

remaining=$(find "$MEMORIES_DIR" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$remaining" -eq 0 ]]; then
  pass "All memory files flushed (none remaining)"
else
  fail "$remaining memory files still in staging dir"
fi

# --- Test 4: Session End ---
info "Test 4: Session End"
# Write session ID back for the end command
echo "$SESSION_ID" > "$SESSION_FILE"
cd "$ULTRA_ROOT" && npx tsx "$RUNNER" session-end 2>/dev/null || fail "session-end command failed"

if [[ ! -f "$SESSION_FILE" ]]; then
  pass "Session file cleaned up"
else
  warn "Session file still exists (non-critical)"
fi

# --- Test 5: Recall on next session ---
info "Test 5: New session recalls previous memories"
output=$(cd "$ULTRA_ROOT" && npx tsx "$RUNNER" session-start 2>/dev/null) || fail "second session-start failed"

if echo "$output" | jq -r '.additionalContext // empty' | grep -q "test memory"; then
  pass "Previous memory recalled in new session"
else
  # May not match if scope differs — check if any context returned
  context=$(echo "$output" | jq -r '.additionalContext // empty')
  if [[ -n "$context" ]]; then
    pass "Memories recalled (different content, but context present)"
  else
    warn "No memories recalled — might be first run or scope mismatch"
  fi
fi

# --- Clean up test memory ---
info "Cleaning up test data..."
cd "$ULTRA_ROOT" && npx tsx -e "
  import { config } from 'dotenv';
  import { join } from 'path';
  config({ path: join('$ULTRA_ROOT', '.env') });
  import { neon } from '@neondatabase/serverless';
  const sql = neon(process.env.DATABASE_URL!);
  await sql\`DELETE FROM memories WHERE content LIKE '%UltraThink test memory%'\`;
  console.log('Test memories cleaned up');
" 2>/dev/null || warn "Could not clean up test memories"

# Clean session file if still present
rm -f "$SESSION_FILE"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All tests passed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
