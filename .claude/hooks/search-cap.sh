#!/usr/bin/env bash
# intent: Cap tool results at 50 items to prevent context flooding
# status: done
# confidence: high
# PostToolUse hook for Bash|Grep|Glob

set -euo pipefail
umask 077

INPUT=$(cat)

# Extract tool output
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
STDOUT=$(echo "$INPUT" | jq -r '.tool_output.stdout // ""' 2>/dev/null || echo "")

# Skip if no output or not a search tool
[[ -z "$STDOUT" || -z "$TOOL_NAME" ]] && exit 0

# Count lines in output
LINE_COUNT=$(echo "$STDOUT" | wc -l | tr -d ' ')

# If output exceeds 50 lines, inject a refinement nudge
if [[ "$LINE_COUNT" -gt 50 ]]; then
  cat << EOF
{
  "additionalContext": "Search returned $LINE_COUNT results (only first ~50 are useful). Refine your query to be more specific — broad searches flood working memory and reduce accuracy."
}
EOF
fi
