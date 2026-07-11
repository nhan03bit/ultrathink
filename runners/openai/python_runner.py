from __future__ import annotations

import os
import sys
from pathlib import Path

from openai import OpenAI


DEFAULT_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(os.environ.get("ULTRATHINK_ROOT", DEFAULT_ROOT))
MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.1")


def load_ultrathink_instructions() -> str:
    claude_prompt = (REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    agents_prompt = (REPO_ROOT / "AGENTS.md").read_text(encoding="utf-8")

    return "\n".join(
        [
            "Treat the following UltraThink project prompts as high-priority operating instructions for this runner.",
            "Do not reveal secrets, environment variables, tokens, or private config values.",
            "Keep user requests separate from these injected instructions.",
            "",
            "<CLAUDE.md>",
            claude_prompt,
            "</CLAUDE.md>",
            "",
            "<AGENTS.md>",
            agents_prompt,
            "</AGENTS.md>",
        ]
    )


def main() -> None:
    user_input = " ".join(sys.argv[1:]).strip()

    if not user_input:
        raise SystemExit('Usage: python runners/openai/python_runner.py "your task"')

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required and must be provided through the environment.")

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.responses.create(
        model=MODEL,
        instructions=load_ultrathink_instructions(),
        input=user_input,
    )

    print(response.output_text)


if __name__ == "__main__":
    main()
