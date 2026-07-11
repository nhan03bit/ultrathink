"""
LLM Client Wrapper
Unified OpenAI-format API calls
"""

import json
import logging
import re
from typing import Optional, Dict, Any, List
from openai import OpenAI

from ..config import Config

logger = logging.getLogger(__name__)


class LLMClient:
    """LLM Client"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.api_key = api_key or Config.LLM_API_KEY
        self.base_url = base_url or Config.LLM_BASE_URL
        self.model = model or Config.LLM_MODEL_NAME

        if not self.api_key:
            raise ValueError("LLM_API_KEY is not configured")

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: Optional[Dict] = None,
        num_ctx: Optional[int] = None,
        disable_thinking: bool = False
    ) -> str:
        """
        Send a chat request

        Args:
            messages: List of messages
            temperature: Temperature parameter
            max_tokens: Maximum number of tokens
            response_format: Response format (e.g. JSON mode)
            num_ctx: Ollama context window size (default 2048, increase for long inputs)
            disable_thinking: Disable Qwen3/thinking-mode reasoning (prevents think tokens consuming max_tokens)

        Returns:
            Model response text
        """
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format:
            kwargs["response_format"] = response_format

        # Ollama-specific options passed via extra_body
        ollama_options: Dict[str, Any] = {}
        if num_ctx is not None:
            ollama_options["num_ctx"] = num_ctx
        if disable_thinking:
            # Qwen3 thinking mode consumes all max_tokens with <think> content,
            # leaving nothing for the actual response. Disable it for JSON tasks.
            ollama_options["think"] = False
        if ollama_options:
            kwargs["extra_body"] = {"options": ollama_options}

        response = self.client.chat.completions.create(**kwargs)
        raw_content = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        logger.warning(f"[LLM RAW] finish_reason={finish_reason!r} content_type={type(raw_content).__name__} content_len={len(raw_content or '')} content_preview={repr((raw_content or '')[:200])}")
        content = raw_content or ''
        # Some models (e.g. MiniMax M2.5) include <think> reasoning content in the response — strip it out
        stripped = re.sub(r'<think>[\s\S]*?</think>', '', content).strip()
        # If stripping the think block leaves the content empty (entire response was inside think block),
        # try to extract JSON from within the think block
        if not stripped:
            inner = re.search(r'<think>([\s\S]*?)</think>', content)
            if inner:
                json_match = re.search(r'\{[\s\S]*\}', inner.group(1))
                if json_match:
                    stripped = json_match.group(0)
        return stripped

    def chat_json(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 4096,
        num_ctx: Optional[int] = None,
        disable_thinking: bool = False
    ) -> Dict[str, Any]:
        """
        Send a chat request and return JSON

        Args:
            messages: List of messages
            temperature: Temperature parameter
            max_tokens: Maximum number of tokens

        Returns:
            Parsed JSON object
        """
        # Do not pass response_format to avoid conflicts with local models like Ollama + Qwen3
        # in thinking mode (JSON grammar constraints block <think> token output, causing empty responses)
        response = self.chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            num_ctx=num_ctx,
            disable_thinking=disable_thinking,
        )
        # Strip markdown code block markers
        cleaned_response = response.strip()
        cleaned_response = re.sub(r'^```(?:json)?\s*\n?', '', cleaned_response, flags=re.IGNORECASE)
        cleaned_response = re.sub(r'\n?```\s*$', '', cleaned_response)
        cleaned_response = cleaned_response.strip()

        # Extract JSON object from text (handles cases where the model outputs extra explanatory text)
        if cleaned_response and not cleaned_response.startswith('{'):
            json_match = re.search(r'\{[\s\S]*\}', cleaned_response)
            if json_match:
                cleaned_response = json_match.group(0)

        try:
            return json.loads(cleaned_response)
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON returned by LLM: {cleaned_response}")
