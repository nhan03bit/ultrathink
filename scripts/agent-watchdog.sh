#!/usr/bin/env bash
# Probe a subagent's LIVE transcript (JSONL) for last-activity.
# The .output file is empty until the subagent completes — the JSONL is what
# updates mid-flight. Use this to detect stalls before the 600s harness watchdog.
#
# Usage:
#   agent-watchdog.sh <agentId>                 # probe once
#   agent-watchdog.sh <agentId> --watch         # poll every 30s until DEAD or done
#   agent-watchdog.sh <agentId> --threshold 90  # custom stale-seconds (default 180)
#   agent-watchdog.sh --all                     # probe ALL subagents in this session
#
# Returns codes:
#   0 = alive/working    1 = transcript not found / dead
#   2 = stale            3 = bad usage

set -uo pipefail

probe_one() {
  local agent_id="$1"
  local threshold="${2:-180}"

  local jsonl
  jsonl=$(ls -t /Users/inugami/.claude/projects/*/*/subagents/agent-${agent_id}.jsonl 2>/dev/null | head -1)
  if [[ -z "$jsonl" ]]; then
    printf "  %s DEAD     no-jsonl-found\n" "${agent_id:0:10}"
    return 1
  fi

  local now last elapsed state lines
  now=$(date +%s)
  last=$(stat -f %m "$jsonl" 2>/dev/null || stat -c %Y "$jsonl")
  elapsed=$((now - last))
  lines=$(wc -l < "$jsonl" 2>/dev/null || echo 0)

  if [[ $elapsed -lt 30 ]]; then state="ALIVE   "; rc=0
  elif [[ $elapsed -lt $threshold ]]; then state="WORKING "; rc=0
  else state="STALE   "; rc=2
  fi

  printf "  %s %s  last=%ds-ago  lines=%d  size=%s\n" \
    "${agent_id:0:10}" "$state" "$elapsed" "$lines" "$(du -h "$jsonl" | cut -f1)"

  if [[ "$state" == "STALE   " ]]; then
    echo "    [last 3 jsonl entries — recent activity]"
    tail -3 "$jsonl" | head -c 1500 | sed 's/^/      | /'
    echo
  fi
  return $rc
}

if [[ "${1:-}" == "--all" ]]; then
  for jsonl in $(ls /Users/inugami/.claude/projects/*/*/subagents/agent-*.jsonl 2>/dev/null); do
    aid=$(basename "$jsonl" .jsonl | sed 's/^agent-//')
    probe_one "$aid"
  done
  exit 0
fi

[[ -z "${1:-}" ]] && { echo "usage: $0 <agentId>|--all [--watch] [--threshold N]"; exit 3; }
AGENT_ID="$1"; shift
WATCH=0
THRESHOLD=180
while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch) WATCH=1 ;;
    --threshold) THRESHOLD="$2"; shift ;;
    *) echo "unknown: $1" >&2; exit 3 ;;
  esac
  shift
done

if [[ $WATCH -eq 1 ]]; then
  while true; do
    probe_one "$AGENT_ID" "$THRESHOLD"; rc=$?
    [[ $rc -eq 1 ]] && exit 1
    [[ $rc -eq 2 ]] && exit 2
    sleep 30
  done
else
  probe_one "$AGENT_ID" "$THRESHOLD"
fi
