#!/usr/bin/env bash
# intent: rename Paperclip agent titles to clean role labels for the M6 bracket convention
# status: done (script written, NOT executed)
# next: run with --apply once human review confirms proposed titles
# confidence: high
#
# Usage:
#   scripts/m6-rename-agents.sh             # dry-run (default)
#   scripts/m6-rename-agents.sh --dry-run   # explicit dry-run
#   scripts/m6-rename-agents.sh --apply     # actually PATCH the agents
#
# This script talks to the running Paperclip API at http://127.0.0.1:3100.
# It does NOT touch Paperclip's DB directly. Paperclip's schema is owned by
# Paperclip; we only nudge the `title` field via the public PATCH endpoint.

set -euo pipefail

PAPERCLIP_API="${PAPERCLIP_API:-http://127.0.0.1:3100}"
MODE="dry-run"

for arg in "$@"; do
  case "$arg" in
    --apply)   MODE="apply" ;;
    --dry-run) MODE="dry-run" ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

# id|name|proposed_title
AGENTS=(
  "49da6c47-00e9-4f72-ac8b-0b6e873d4ec8|Steven|CEO"
  "23ea55d7-fe5c-43a6-9415-8a49a27ea901|Mira|Code Integrator"
  "8a9e59bf-9f59-49ec-b74a-87a2f26c3978|Quinn|Quality Integrator"
  "d1210cdc-ab32-4b79-9ecf-9495371a7c68|Alex|DevOps Integrator"
  "7f788aae-8e18-4c98-bd39-1612baeb8e08|Casey|Engineer"
)

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1" >&2; exit 1; }
}
need curl
need jq

bold() { printf '\033[1m%s\033[0m' "$1"; }
dim()  { printf '\033[2m%s\033[0m' "$1"; }
green(){ printf '\033[32m%s\033[0m' "$1"; }
yellow(){ printf '\033[33m%s\033[0m' "$1"; }

echo "$(bold "M6 — Paperclip agent title rename")"
echo "Mode: $(if [ "$MODE" = "apply" ]; then yellow APPLY; else green "dry-run"; fi)"
echo "API : $PAPERCLIP_API"
echo

printf "%-10s | %-32s | %-32s | %s\n" "Agent" "Current name" "Current title (truncated)" "Proposed (name | title)"
printf "%-10s-+-%-32s-+-%-32s-+-%s\n" "----------" "--------------------------------" "--------------------------------" "----------------------------------"

CHANGES=()
for row in "${AGENTS[@]}"; do
  IFS='|' read -r id proposed_name proposed_title <<<"$row"
  current_payload="$(curl -fsS "$PAPERCLIP_API/api/agents/$id")"
  current_name="$(echo "$current_payload" | jq -r '.name // ""')"
  current_title="$(echo "$current_payload" | jq -r '.title // ""')"
  if [ "$current_name" = "$proposed_name" ] && [ "$current_title" = "$proposed_title" ]; then
    marker="$(dim '= unchanged')"
  else
    marker="$(yellow '~ rename')"
    CHANGES+=("$id|$proposed_name|$proposed_title")
  fi
  printf "%-10s | %-32s | %-32s | %s [%s]  %s\n" \
    "$proposed_name" "${current_name:0:32}" "${current_title:0:32}" \
    "$proposed_name" "$proposed_title" "$marker"
done

echo
if [ ${#CHANGES[@]} -eq 0 ]; then
  echo "$(green 'Nothing to do — all agents already match the convention.')"
  exit 0
fi

if [ "$MODE" = "dry-run" ]; then
  echo "Dry-run: ${#CHANGES[@]} agent(s) would be updated (name and/or title). Re-run with --apply to commit."
  exit 0
fi

echo "$(yellow 'Applying changes...')"
for change in "${CHANGES[@]}"; do
  IFS='|' read -r id proposed_name proposed_title <<<"$change"
  echo "PATCH $proposed_name ($id) -> name='$proposed_name', title='$proposed_title'"
  curl -fsS -X PATCH "$PAPERCLIP_API/api/agents/$id" \
    -H 'content-type: application/json' \
    --data "$(jq -nc --arg n "$proposed_name" --arg t "$proposed_title" '{name: $n, title: $t}')" \
    | jq -r '"  ok: name=\"" + (.name // "") + "\" title=\"" + (.title // "") + "\""'
done

echo
echo "$(green 'Done. Bracket convention now: <name> [<title>] — verify in dashboard / Discord.')"
