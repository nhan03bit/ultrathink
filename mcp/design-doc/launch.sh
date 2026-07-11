#!/bin/bash
# intent: keep the committed MCP launcher portable and secret-safe
# status: done
# next: set real env values only in an untracked project .env or shell profile
# blockers: none
# confidence: high
# design-doc MCP launcher — sources UltraThink .env (using a dotenv-safe parser
# that handles values containing `&`, `=`, etc. without shell interpretation)
# then execs the server. Avoids the Claude Code .mcp.json env-interpolation bug.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    [[ "$value" =~ ^\".*\"$ ]] && value="${value:1:-1}"
    [[ "$value" =~ ^\'.*\'$ ]] && value="${value:1:-1}"
    export "$key=$value"
  done < "$ENV_FILE"
fi
export PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://127.0.0.1:3100}"
export PAPERCLIP_DIRECTOR_AGENT_ID="${PAPERCLIP_DIRECTOR_AGENT_ID:-}"
exec node "$ROOT_DIR/mcp/design-doc/dist/index.js"
