#!/usr/bin/env bash
# intent: Remind to use VFS before full file Read for code exploration
# status: done
# confidence: high
# PreToolUse hook for Read

set -euo pipefail
umask 077

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
[[ "$TOOL_NAME" != "Read" ]] && exit 0

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")
[[ -z "$FILE_PATH" ]] && exit 0

# Only enforce for code files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.py|*.go|*.rs|*.java|*.rb) ;;
  *) exit 0 ;;
esac

# Check if VFS was called this session (tracked via temp file)
CC_SID="${CC_SESSION_ID:-unknown}"
VFS_MARKER="/tmp/ultrathink-vfs-used-$CC_SID"

if [[ ! -f "$VFS_MARKER" ]]; then
  # Check if Read has offset/limit (targeted read = OK)
  HAS_OFFSET=$(echo "$INPUT" | jq -r '.tool_input.offset // ""' 2>/dev/null || echo "")
  if [[ -z "$HAS_OFFSET" ]]; then
    cat << 'EOF'
{
  "additionalContext": "Consider using VFS (mcp__vfs__extract) before reading full files. VFS returns function/class signatures at 60-98% token savings. Only Read specific line ranges after you know what you need."
}
EOF
  fi
fi
