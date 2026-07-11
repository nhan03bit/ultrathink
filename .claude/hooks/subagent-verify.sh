#!/usr/bin/env bash
# intent: Verify subagent deliverables after completion
# status: done
# confidence: high
#
# UltraThink Subagent Verification — PostToolUse (Agent)
# After an agent completes, checks:
#   1. Did the agent report success or failure?
#   2. If worktree isolation was used, were changes produced?
#   3. Do expected files exist (from GSD files_owned if available)?
#   4. Quick build check (tsc --noEmit) if TypeScript files were modified
# Reports pass/fail via additionalContext to the orchestrator.

set -euo pipefail
umask 077  # UltraThink: restrict temp files to owner only

source "$(dirname "${BASH_SOURCE[0]}")/hook-log.sh" 2>/dev/null || hook_log() { :; }

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)
[[ "$TOOL_NAME" != "Agent" ]] && exit 0

hook_log "subagent-verify" "started"

CC_SID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null | head -c 12)
[[ -z "$CC_SID" ]] && { echo '{}'; exit 0; }

# Extract agent result info
TOOL_RESULT=$(echo "$INPUT" | jq -r '.tool_result // ""' 2>/dev/null || true)
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // ""' 2>/dev/null || true)
ISOLATION=$(echo "$INPUT" | jq -r '.tool_input.isolation // ""' 2>/dev/null || true)

# --- Determine verification scope ---

ISSUES=()
CHECKS_RUN=0
CHECKS_PASSED=0

# Check 1: Did the agent return an error/failure signal?
if echo "$TOOL_RESULT" | grep -qi "error\|failed\|STOP\|Rule 4\|architecture change"; then
  ISSUES+=("Agent reported failure or Rule 4 stop — review result before continuing")
fi
CHECKS_RUN=$((CHECKS_RUN + 1))
[[ ${#ISSUES[@]} -eq 0 ]] && CHECKS_PASSED=$((CHECKS_PASSED + 1))

# Check 2: If worktree isolation, check for changes
if [[ "$ISOLATION" == "worktree" ]]; then
  CHECKS_RUN=$((CHECKS_RUN + 1))
  # Worktree agents report branch/path in result
  if echo "$TOOL_RESULT" | grep -qi "no changes\|worktree.*cleaned"; then
    ISSUES+=("Worktree agent produced no changes — may have failed silently")
  else
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  fi
fi

# Check 3: GSD files_owned verification
# Look for a GSD progress file with plan info
GSD_PROGRESS="/tmp/ultrathink-progress-${CC_SID}"
if [[ -f "$GSD_PROGRESS" ]]; then
  # Try to find the plan this agent was executing (match by description)
  PLAN_DIR=""
  WORKSPACE=$(echo "$INPUT" | jq -r '.workspace.current_dir // ""' 2>/dev/null || true)
  if [[ -n "$WORKSPACE" ]]; then
    PLAN_DIR="$WORKSPACE/.planning"
  fi

  if [[ -d "$PLAN_DIR" ]]; then
    # Search plan files for files_owned metadata
    SLUG=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | head -c 30)
    for plan_file in "$PLAN_DIR"/PLAN-*.md; do
      [[ -f "$plan_file" ]] || continue
      # Extract files_owned from plan_metadata
      FILES_OWNED=$(sed -n '/files_owned:/p' "$plan_file" 2>/dev/null | head -1 | sed 's/.*files_owned:\s*\[//;s/\].*//' | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      if [[ -n "$FILES_OWNED" ]]; then
        CHECKS_RUN=$((CHECKS_RUN + 1))
        MISSING_FILES=""
        while IFS= read -r expected_file; do
          expected_file=$(echo "$expected_file" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
          [[ -z "$expected_file" ]] && continue
          FULL_PATH="$WORKSPACE/$expected_file"
          if [[ ! -f "$FULL_PATH" ]]; then
            MISSING_FILES+="  - $expected_file\n"
          fi
        done <<< "$FILES_OWNED"
        if [[ -n "$MISSING_FILES" ]]; then
          ISSUES+=("Expected files not found:\n${MISSING_FILES}")
        else
          CHECKS_PASSED=$((CHECKS_PASSED + 1))
        fi
        break  # Only check the first matching plan
      fi
    done
  fi
fi

# Check 4: Quick TypeScript build check
# Only if the workspace has a tsconfig.json and the agent modified .ts/.tsx files
WORKSPACE=$(echo "$INPUT" | jq -r '.workspace.current_dir // ""' 2>/dev/null || true)
if [[ -n "$WORKSPACE" && -f "$WORKSPACE/tsconfig.json" ]]; then
  # Check if any .ts/.tsx files were likely modified (heuristic: agent description mentions TS-related work)
  if echo "$DESCRIPTION $TOOL_RESULT" | grep -qi "\.ts\|\.tsx\|typescript\|component\|hook\|api\|route"; then
    CHECKS_RUN=$((CHECKS_RUN + 1))
    # Quick typecheck — timeout 15s, capture only errors
    TSC_OUT=$(cd "$WORKSPACE" && timeout 15 npx tsc --noEmit 2>&1 | tail -5) || true
    if echo "$TSC_OUT" | grep -q "error TS"; then
      ERROR_COUNT=$(echo "$TSC_OUT" | grep -c "error TS" || echo "?")
      ISSUES+=("TypeScript errors detected (${ERROR_COUNT} errors) — run tsc --noEmit to see details")
    else
      CHECKS_PASSED=$((CHECKS_PASSED + 1))
    fi
  fi
fi

# --- Build report ---

if [[ $CHECKS_RUN -eq 0 ]]; then
  hook_log "subagent-verify" "done" "no checks applicable"
  echo '{}'
  exit 0
fi

if [[ ${#ISSUES[@]} -eq 0 ]]; then
  hook_log "subagent-verify" "done" "pass ${CHECKS_PASSED}/${CHECKS_RUN}"
  # All checks passed — inject brief confirmation
  jq -n --arg ctx "Subagent verification: ${CHECKS_PASSED}/${CHECKS_RUN} checks passed for \"${DESCRIPTION}\"" \
    '{ "additionalContext": $ctx }'
else
  hook_log "subagent-verify" "done" "issues ${#ISSUES[@]}/${CHECKS_RUN}"
  # Build issue report
  REPORT="Subagent verification for \"${DESCRIPTION}\": ${CHECKS_PASSED}/${CHECKS_RUN} checks passed\n\nIssues found:"
  for issue in "${ISSUES[@]}"; do
    REPORT+="\n- ${issue}"
  done
  REPORT+="\n\nReview these issues before proceeding to dependent work."

  ESCAPED=$(printf '%s' "$REPORT" | jq -Rs .)
  echo "{\"additionalContext\": ${ESCAPED}}"
fi