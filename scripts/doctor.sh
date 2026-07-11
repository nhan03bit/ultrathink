#!/usr/bin/env bash
# intent: verify local UltraThink runtime wiring without exposing secrets
# status: done
# next: extend checks when new runtime links or MCP config formats are added
# blockers: none
# confidence: high
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
CODEX_DIR="$HOME/.codex"
ULTRA_DIR="$HOME/.ultrathink"

OK=0
WARN=0
FAIL=0

if [[ -t 1 ]]; then
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  GREEN=''
  YELLOW=''
  RED=''
  BLUE=''
  BOLD=''
  NC=''
fi

section() { printf '\n%s%s%s\n' "$BOLD" "$1" "$NC"; }
pass() { OK=$((OK + 1)); printf '%b[OK]%b    %s\n' "$GREEN" "$NC" "$1"; }
warn() { WARN=$((WARN + 1)); printf '%b[WARN]%b  %s\n' "$YELLOW" "$NC" "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '%b[FAIL]%b  %s\n' "$RED" "$NC" "$1"; }
info() { printf '%b[INFO]%b  %s\n' "$BLUE" "$NC" "$1"; }

relative_to_root() {
  local path="$1"
  if [[ "$path" == "$ROOT"* ]]; then
    printf '.%s' "${path#"$ROOT"}"
  else
    printf '%s' "$path"
  fi
}

expected_tier() {
  if [[ -f "$ROOT/scripts/upgrade-to-builder.sh" ]]; then
    printf 'core'
  else
    printf 'oss'
  fi
}

check_file() {
  local label="$1"
  local path="$2"
  if [[ -f "$path" ]]; then
    pass "$label exists ($(relative_to_root "$path"))"
  else
    fail "$label missing ($(relative_to_root "$path"))"
  fi
}

check_dir() {
  local label="$1"
  local path="$2"
  if [[ -d "$path" ]]; then
    pass "$label exists ($(relative_to_root "$path"))"
  else
    fail "$label missing ($(relative_to_root "$path"))"
  fi
}

check_symlink_target() {
  local label="$1"
  local link="$2"
  local expected="$3"
  if [[ ! -e "$link" && ! -L "$link" ]]; then
    fail "$label missing ($link)"
    return
  fi
  if [[ ! -L "$link" ]]; then
    warn "$label exists but is not a symlink ($link)"
    return
  fi

  local actual
  actual="$(readlink "$link")"
  if [[ "$actual" != /* ]]; then
    actual="$(cd "$(dirname "$link")" && cd "$(dirname "$actual")" && pwd)/$(basename "$actual")"
  fi

  if [[ "$actual" == "$expected" ]]; then
    pass "$label points to $(relative_to_root "$expected")"
  else
    fail "$label points to $actual, expected $(relative_to_root "$expected")"
  fi
}

check_command_version() {
  local cmd="$1"
  local version_arg="${2:---version}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    warn "$cmd is not installed or not on PATH"
    return
  fi

  local version
  version="$($cmd "$version_arg" 2>/dev/null | tr '\n' ' ' | cut -c 1-120 || true)"
  if [[ -n "$version" ]]; then
    pass "$cmd available ($version)"
  else
    pass "$cmd available"
  fi
}

check_executable_command() {
  local label="$1"
  local cmd="$2"
  if [[ "$cmd" == http://* || "$cmd" == https://* ]]; then
    pass "$label uses HTTP endpoint"
  elif [[ "$cmd" == */* ]]; then
    local abs="$cmd"
    [[ "$cmd" != /* ]] && abs="$ROOT/${cmd#./}"
    if [[ -x "$abs" ]]; then
      pass "$label command executable ($(relative_to_root "$abs"))"
    elif [[ -f "$abs" ]]; then
      warn "$label command exists but is not executable ($(relative_to_root "$abs"))"
    else
      fail "$label command missing ($(relative_to_root "$abs"))"
    fi
  elif command -v "$cmd" >/dev/null 2>&1; then
    pass "$label command on PATH ($cmd)"
  else
    fail "$label command not found on PATH ($cmd)"
  fi
}

check_arg_path() {
  local label="$1"
  local arg="$2"
  [[ "$arg" == */* || "$arg" == *.js || "$arg" == *.ts || "$arg" == *.sh ]] || return 0
  local abs="$arg"
  [[ "$arg" != /* ]] && abs="$ROOT/${arg#./}"
  if [[ -e "$abs" ]]; then
    pass "$label arg path exists ($(relative_to_root "$abs"))"
  else
    fail "$label arg path missing ($(relative_to_root "$abs"))"
  fi
}

node_json() {
  local file="$1"
  local script="$2"
  node -e "const fs=require('fs'); const p=process.argv[1]; const data=JSON.parse(fs.readFileSync(p,'utf8')); $script" "$file"
}

section "Runtime Health Check"
info "Repo: $ROOT"
info "Secrets are not printed; only existence, target paths, and versions are reported."

section "Claude Links"
check_file "Global Claude instructions" "$CLAUDE_DIR/CLAUDE.md"
check_dir "Global Claude skills" "$CLAUDE_DIR/skills"
check_symlink_target "Claude skill registry" "$CLAUDE_DIR/skills/_registry.json" "$ROOT/.claude/skills/_registry.json"
check_symlink_target "Claude references" "$CLAUDE_DIR/references" "$ROOT/.claude/references"
check_symlink_target "Claude agents" "$CLAUDE_DIR/agents" "$ROOT/.claude/agents"

section "Codex Links"
check_file "Project Codex config" "$ROOT/.codex/config.toml"
check_file "Project Codex hooks" "$ROOT/.codex/hooks.json"
check_file "Global Codex instructions" "$CODEX_DIR/AGENTS.md"
check_file "Global Codex config" "$CODEX_DIR/config.toml"
check_file "Global Codex hooks" "$CODEX_DIR/hooks.json"

section "Hooks"
if [[ -d "$ROOT/.claude/hooks" ]]; then
  missing_sources=0
  for source in memory-session-start.sh codeintel-session-check.sh memory-session-end.sh pre-compact.sh prompt-submit.sh privacy-hook.sh agent-tracker-pre.sh tool-failure-log.sh desktop-notify.sh post-edit-quality.sh post-edit-codeintel.sh memory-auto-save.sh tool-observe.sh context-monitor.sh progress-display.sh; do
    if [[ -f "$ROOT/.claude/hooks/$source" ]]; then
      pass "Hook source exists (.claude/hooks/$source)"
    else
      missing_sources=$((missing_sources + 1))
      fail "Hook source missing (.claude/hooks/$source)"
    fi
  done
  [[ "$missing_sources" -eq 0 ]] && info "All expected project hook sources are present."
else
  fail "Project hook directory missing (.claude/hooks)"
fi

if [[ -d "$CLAUDE_DIR/hooks" ]]; then
  shopt -s nullglob
  hook_links=("$CLAUDE_DIR/hooks"/ultrathink-*)
  shopt -u nullglob
  if [[ ${#hook_links[@]} -gt 0 ]]; then
    for link in "${hook_links[@]}"; do
      if [[ -L "$link" && -e "$link" ]]; then
        pass "Claude hook link valid ($(basename "$link"))"
      elif [[ -L "$link" ]]; then
        fail "Claude hook link broken ($(basename "$link"))"
      else
        warn "Claude hook is not a symlink ($(basename "$link"))"
      fi
    done
  else
    warn "No ultrathink-* hooks found in $CLAUDE_DIR/hooks"
  fi
else
  fail "Global Claude hooks directory missing ($CLAUDE_DIR/hooks)"
fi

if [[ -f "$ROOT/.codex/hooks.json" && $(command -v node || true) ]]; then
  # mapfile requires bash 4+; use while-read for bash 3.2 compatibility (macOS default)
  codex_commands=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && codex_commands+=("$line")
  done < <(node_json "$ROOT/.codex/hooks.json" "for (const entries of Object.values(data.hooks || {})) for (const entry of entries || []) for (const hook of entry.hooks || []) if (hook.command) console.log(hook.command);" 2>/dev/null || true)
  if [[ ${#codex_commands[@]} -eq 0 ]]; then
    warn "No Codex hook commands found in .codex/hooks.json"
  else
    for command_line in "${codex_commands[@]}"; do
      first_word="${command_line%% *}"
      check_executable_command "Codex hook" "$first_word"
      IFS=' ' read -r -a command_tokens <<< "$command_line"
      for token in "${command_tokens[@]}"; do
        [[ "$token" == *.sh || "$token" == *.ts || "$token" == *.js || "$token" == *.mjs ]] || continue
        candidate="$token"
        [[ "$candidate" != /* ]] && candidate="$ROOT/$candidate"
        if [[ -e "$candidate" ]]; then
          pass "Codex hook path exists ($(relative_to_root "$candidate"))"
        else
          fail "Codex hook path missing ($(relative_to_root "$candidate"))"
        fi
      done
    done
  fi
fi

section "MCP Servers"
check_file "Claude MCP config" "$ROOT/.mcp.json"
if [[ -f "$ROOT/.mcp.json" && $(command -v node || true) ]]; then
  # mapfile requires bash 4+; use while-read for bash 3.2 compatibility (macOS default)
  mcp_lines=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && mcp_lines+=("$line")
  done < <(node_json "$ROOT/.mcp.json" "for (const [name, cfg] of Object.entries(data.mcpServers || {})) { if (cfg.command) console.log([name, cfg.command, ...((cfg.args || []).filter(v => typeof v === 'string'))].join('\\t')); else if (cfg.url) console.log([name, cfg.url].join('\\t')); }" 2>/dev/null || true)
  for line in "${mcp_lines[@]}"; do
    IFS=$'\t' read -r name command rest <<< "$line"
    check_executable_command "MCP $name" "$command"
    IFS=$'\t' read -r -a parts <<< "$line"
    for ((i = 2; i < ${#parts[@]}; i++)); do
      check_arg_path "MCP $name" "${parts[$i]}"
    done
  done
else
  warn "Skipping .mcp.json parsing because node is unavailable"
fi

if [[ -f "$ROOT/.codex/config.toml" ]]; then
  current=""
  while IFS= read -r line; do
    if [[ "$line" =~ ^\[mcp_servers\.([^].]+)\]$ ]]; then
      current="${BASH_REMATCH[1]}"
      continue
    fi
    if [[ -n "$current" && "$line" =~ ^command[[:space:]]*=[[:space:]]*\"([^\"]+)\" ]]; then
      check_executable_command "Codex MCP $current" "${BASH_REMATCH[1]}"
    fi
    if [[ -n "$current" && "$line" =~ ^args[[:space:]]*=[[:space:]]*\[(.*)\] ]]; then
      args="${BASH_REMATCH[1]}"
      while [[ "$args" =~ \"([^\"]+)\" ]]; do
        check_arg_path "Codex MCP $current" "${BASH_REMATCH[1]}"
        args="${args#*\"${BASH_REMATCH[1]}\"}"
      done
    fi
  done < "$ROOT/.codex/config.toml"
fi

section "Memory Config"
config="$ULTRA_DIR/config.json"
if [[ -f "$config" && $(command -v node || true) ]]; then
  tier="$(node_json "$config" "process.stdout.write(String(data.tier || 'missing'));" 2>/dev/null || printf 'unreadable')"
  expected="$(expected_tier)"
  if [[ "$tier" == "$expected" ]]; then
    pass "Memory config tier is $tier"
  elif [[ "$tier" == "unreadable" ]]; then
    fail "Memory config exists but could not be parsed ($config)"
  else
    warn "Memory config tier is $tier, expected $expected"
  fi
else
  warn "Memory config missing ($config)"
fi

if [[ -d "$ROOT/packages/memory" ]]; then
  check_file "Memory runner" "$ROOT/packages/memory/scripts/memory-runner.ts"
else
  fail "Memory package missing (packages/memory)"
fi

section "CLI Versions"
check_command_version node
check_command_version npm
check_command_version pnpm
check_command_version npx
check_command_version tsx
check_command_version claude
check_command_version codex
check_command_version vfs

section "Dependencies"
check_file "Root package manifest" "$ROOT/package.json"
if [[ -d "$ROOT/node_modules" ]]; then
  pass "Root node_modules exists"
else
  warn "Root node_modules missing; run npm install or pnpm install"
fi

if [[ -f "$ROOT/pnpm-lock.yaml" && -f "$ROOT/package-lock.json" ]]; then
  warn "Both pnpm-lock.yaml and package-lock.json exist; use the repo's intended package manager consistently"
elif [[ -f "$ROOT/pnpm-lock.yaml" ]]; then
  pass "pnpm lockfile exists"
elif [[ -f "$ROOT/package-lock.json" ]]; then
  pass "npm lockfile exists"
else
  warn "No root lockfile found"
fi

for required in "$ROOT/packages/code-intel/dist/index.js" "$ROOT/mcp/agora/dist/index.js" "$ROOT/mcp/design-doc/launch.sh"; do
  if [[ -e "$required" ]]; then
    pass "Runtime dependency exists ($(relative_to_root "$required"))"
  else
    warn "Runtime dependency missing ($(relative_to_root "$required"))"
  fi
done

section "Summary"
printf 'Checks: %b%d ok%b, %b%d warn%b, %b%d fail%b\n' "$GREEN" "$OK" "$NC" "$YELLOW" "$WARN" "$NC" "$RED" "$FAIL" "$NC"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
