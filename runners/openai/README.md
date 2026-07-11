# OpenAI API Runner Template

Ready-to-use examples for injecting UltraThink as high-priority instructions in OpenAI and OpenAI-compatible runners.

These examples are secret-safe by default:

- They read API keys from environment variables.
- They never print credentials or `.env` contents.
- They load only `CLAUDE.md` and `AGENTS.md` from the repo root.
- They keep user input separate from the injected instruction block.

## Files

- `node-runner.mjs` - Node.js example using the OpenAI Responses API.
- `python_runner.py` - Python example using the OpenAI Responses API.
- `openai-compatible.mjs` - Node.js example for OpenAI-compatible chat completions APIs.

## Node: OpenAI Responses API

Install the SDK:

```bash
npm install openai
```

Run with an environment-provided key:

```bash
OPENAI_API_KEY="your-key" node runners/openai/node-runner.mjs "Summarize this repo's operating rules."
```

Optional environment variables:

- `OPENAI_MODEL` defaults to `gpt-5.1`.
- `ULTRATHINK_ROOT` defaults to the repository root inferred from this file.

## Python: OpenAI Responses API

Install the SDK:

```bash
python -m pip install openai
```

Run with an environment-provided key:

```bash
OPENAI_API_KEY="your-key" python runners/openai/python_runner.py "List the UltraThink workflow steps."
```

Optional environment variables:

- `OPENAI_MODEL` defaults to `gpt-5.1`.
- `ULTRATHINK_ROOT` defaults to the repository root inferred from this file.

## OpenAI-Compatible APIs

Use this for providers exposing an OpenAI-style `/v1/chat/completions` endpoint.

```bash
OPENAI_API_KEY="your-provider-key" \
OPENAI_BASE_URL="https://api.example.com/v1" \
OPENAI_MODEL="provider-model-name" \
node runners/openai/openai-compatible.mjs "Explain how to preserve UltraThink instruction priority."
```

`OPENAI_BASE_URL` is required for the compatible runner. Do not include credentials in the URL.

## Prompt Injection Model

The runners build one instruction payload from:

1. `CLAUDE.md`
2. `AGENTS.md`
3. A short runner guardrail telling the model to treat those files as high-priority project instructions

For OpenAI Responses API examples, that payload is passed through the `instructions` parameter. For OpenAI-compatible chat APIs, it is passed as the first `system` message.
