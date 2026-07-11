#!/usr/bin/env bash
# MiroFish — start backend (Flask/Python 3.12) + frontend (Vite/Vue)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Validate required env vars
if [[ -f "$ROOT/.env" ]]; then
  set -a; source "$ROOT/.env"; set +a
fi

if [[ -z "$LLM_API_KEY" ]]; then
  echo "❌  Set LLM_API_KEY in apps/mirofish/.env (use 'ollama' for local Ollama)"
  exit 1
fi
if [[ -z "$ZEP_API_KEY" ]]; then
  echo "❌  Set ZEP_API_KEY=local in apps/mirofish/.env (uses built-in SQLite shim)"
  exit 1
fi
if [[ "$ZEP_API_KEY" == "local" ]]; then
  echo "✓  Zep local shim active (SQLite + Ollama entity extraction)"
fi

# Verify Ollama is reachable when using local endpoint
if [[ "$LLM_BASE_URL" == *"localhost:11434"* ]]; then
  if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "❌  Ollama is not running. Start it with: ollama serve"
    exit 1
  fi
  echo "✓  Ollama running — model: $LLM_MODEL_NAME"
fi

echo "Starting MiroFish backend on :5000 and frontend on :5173..."
cd "$ROOT" && npx --yes concurrently --kill-others \
  -n "backend,frontend" -c "green,cyan" \
  "cd backend && uv run --python python3.12 python run.py" \
  "cd frontend && npm run dev"
