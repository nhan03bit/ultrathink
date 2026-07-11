#!/usr/bin/env bash
# UltraThink: Create hook symlinks in ~/.claude/hooks/.
# Hook runtime registration is normalized by .claude/hooks/manifest.json and scripts/hook-adapter.mjs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../.claude/hooks"
TARGET_DIR="$HOME/.claude/hooks"

# Ensure target directory exists
mkdir -p "$TARGET_DIR"

# Symlink mapping: "target_name:source_name"
HOOKS="
ultrathink-memory-session-start.sh:memory-session-start.sh
ultrathink-codeintel-session-check.sh:codeintel-session-check.sh
ultrathink-memory-session-end.sh:memory-session-end.sh
ultrathink-pre-compact.sh:pre-compact.sh
ultrathink-prompt-submit.sh:prompt-submit.sh
ultrathink-privacy-hook.sh:privacy-hook.sh
ultrathink-agent-tracker-pre.sh:agent-tracker-pre.sh
ultrathink-tool-failure-log.sh:tool-failure-log.sh
ultrathink-desktop-notify.sh:desktop-notify.sh
ultrathink-post-edit-quality.sh:post-edit-quality.sh
ultrathink-post-edit-codeintel.sh:post-edit-codeintel.sh
ultrathink-memory-auto-save.sh:memory-auto-save.sh
ultrathink-tool-observe.sh:tool-observe.sh
ultrathink-context-monitor.sh:context-monitor.sh
ultrathink-progress-display.sh:progress-display.sh
ultrathink-hooks-manifest.json:manifest.json
"

count=0
for entry in $HOOKS; do
  target_name="${entry%%:*}"
  source_name="${entry##*:}"
  source_path="$SOURCE_DIR/$source_name"
  target_path="$TARGET_DIR/$target_name"

  if [[ ! -f "$source_path" ]]; then
    echo "SKIP  $target_name — source not found: $source_path"
    continue
  fi

  ln -sf "$source_path" "$target_path"
  echo "OK    $target_path → $source_path"
  count=$((count + 1))
done

echo ""
echo "Done. $count symlinks created in $TARGET_DIR"
