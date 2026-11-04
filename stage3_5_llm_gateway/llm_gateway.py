"""LLM Gateway — provider-agnostic interface for triage, fix prompts, and reports.

Supports: Meta Model API (Muse models), OpenAI, Anthropic, Google (Gemini), local Ollama, or no-LLM fallback.

Architecture:
  - llm_gateway.py: config + completion dispatch
  - grounding.py: web-search backed grounding for remediation suggestions
"""

import asyncio
import json
import logging
import os
import re
import socket
from typing import Any, AsyncIterator
from dotenv import load_dotenv

# Prefer IPv4 on dual-stack hosts to avoid Windows WinError 10060 when ISP lacks IPv6 routing
_orig_getaddrinfo = socket.getaddrinfo
def _getaddrinfo_ipv4_pref(host, port, family=0, type=0, proto=0, flags=0):
    try:
        res = _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
        if res:
            return res
    except Exception:
        pass
    return _orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = _getaddrinfo_ipv4_pref

load_dotenv()

logger = logging.getLogger("nikspider.llm")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[%(levelname)s] %(name)s: %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.WARNING)

DEFAULT_BASE_URL = "https://api.meta.ai/v1"
DEFAULT_MODEL = "muse-spark-1.3"
DEFAULT_HEAVY_MODEL = "muse-wonder-1.0"

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "meta").lower()
LLM_MODEL = os.getenv("LLM_MODEL") or {
    "meta": DEFAULT_MODEL,
    "openai": DEFAULT_MODEL,
    "anthropic": "claude-3-haiku-20240307",
    "google": "gemini-1.5-flash-002",
    "ollama": "llama3.1:8b",
}.get(LLM_PROVIDER, DEFAULT_MODEL)

API_KEY_ENV = {
    "meta": "LLM_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "ollama": None,
}

LAST_LLM_STATUS: dict[str, Any] = {
    "mode": "unknown",       # "live" | "mock_fallback"
    "status_code": None,
    "model": None,
    "endpoint": None,
    "last_warning": None,
}


def _sanitize_model_id(model_id: str) -> str:
    """Ensure '-contributor' model variants (which train on inputs) are never used."""
    cleaned = (model_id or DEFAULT_MODEL).strip()
    if cleaned.endswith("-contributor"):
        cleaned = cleaned[: -len("-contributor")]
    return cleaned or DEFAULT_MODEL


class LLMGateway:
    """Unified LLM client for completion and streaming."""

    def __init__(
        self,
        provider: str | None = None,
        model: str | None = None,
        cfg: dict | None = None,
    ):
        cfg = cfg or {}
        self.provider = (
            provider
            or cfg.get("provider")
            or os.getenv("LLM_PROVIDER", LLM_PROVIDER)
        ).lower()
        self.base_url = (
            cfg.get("base_url")
            or os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL)
        ).rstrip("/")
        raw_model = model or cfg.get("model") or os.getenv("LLM_MODEL") or LLM_MODEL
        self.model = _sanitize_model_id(raw_model)
        raw_heavy = (
            cfg.get("model_heavy")
            or os.getenv("LLM_MODEL_HEAVY")
            or self.model
        )
        self.model_heavy = _sanitize_model_id(raw_heavy)

        self.api_key = (
            cfg.get("api_key")
            or os.getenv("LLM_API_KEY")
            or os.getenv("META_API_KEY")
        )
        if not self.api_key:
            key_env = API_KEY_ENV.get(self.provider)
            if key_env:
                self.api_key = os.getenv(key_env)
        if self.api_key:
            self.api_key = self.api_key.strip()

    @property
    def available(self) -> bool:
        if self.provider == "ollama":
            return True  # assumed local
        return bool(
            self.api_key
            and not self.api_key.startswith("mock")
            and self.api_key != "your_api_key_here"
            and not self.api_key.startswith("<placeholder")
        )

    async def acomplete(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 2000,
        use_heavy: bool = False,
    ) -> str:
        """Alias for complete() — the async completion entry point."""
        return await self.complete(
            prompt, system=system, max_tokens=max_tokens, use_heavy=use_heavy
        )

    async def complete(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 2000,
        use_heavy: bool = False,
    ) -> str:
        """Return a single completion string. Falls back to structured mock/call_llm."""
        if not self.available:
            return ""
        selected_model = self.model_heavy if use_heavy else self.model
        if self.provider in ("openai", "meta"):
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            res = await call_llm(
                messages,
                json_mode=("json" in prompt.lower() or "json" in system.lower()),
                cfg={
                    "base_url": self.base_url,
                    "api_key": self.api_key,
                    "model": selected_model,
                    "model_heavy": self.model_heavy,
                },
                use_heavy=use_heavy,
            )
            if isinstance(res, str):
                return res
            return json.dumps(res)
        try:
            if self.provider == "anthropic":
                return await self._complete_anthropic(prompt, system, max_tokens)
            elif self.provider == "google":
                return await self._complete_google(prompt, system, max_tokens)
            elif self.provider == "ollama":
                return await self._complete_ollama(prompt, system, max_tokens)
        except Exception:
            pass
        return ""

    async def stream(self, prompt: str, system: str = "") -> AsyncIterator[str]:
        """Stream completion tokens."""
        if not self.available:
            yield ""
            return
        try:
            if self.provider in ("openai", "meta"):
                async for token in self._stream_openai(prompt, system):
                    yield token
            else:
                text = await self.complete(prompt, system)
                yield text
        except Exception:
            yield ""

    async def _complete_openai(self, prompt: str, system: str, max_tokens: int) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        r = await client.chat.completions.create(
            model=self.model, messages=messages, max_tokens=max_tokens, temperature=0.3
        )
        return r.choices[0].message.content or ""

    async def _stream_openai(self, prompt: str, system: str) -> AsyncIterator[str]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        stream = await client.chat.completions.create(
            model=self.model, messages=messages, max_tokens=2000, temperature=0.3, stream=True
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def _complete_anthropic(self, prompt: str, system: str, max_tokens: int) -> str:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=self.api_key)
        r = await client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system or "You are a helpful security expert.",
            messages=[{"role": "user", "content": prompt}],
        )
        return r.content[0].text if r.content else ""

    async def _complete_google(self, prompt: str, system: str, max_tokens: int) -> str:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model)
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        r = await model.generate_content_async(full_prompt)
        return r.text or ""

    async def _complete_ollama(self, prompt: str, system: str, max_tokens: int) -> str:
        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "system": system,
                    "stream": False,
                    "options": {"num_predict": max_tokens},
                },
            )
            return r.json().get("response", "")


# --------------------------------------------------------------------------
# Functional LLM API (mock-aware) — used by planner, triage and roadmap
# --------------------------------------------------------------------------

from nikspider.stage3_5_llm_gateway.mock_llm import (  # noqa: E402,F401
    _extract_json,
    _get_mock_response,
)

LLM_SEMAPHORE = asyncio.Semaphore(3)


async def call_llm(
    messages: list[dict],
    json_mode: bool = True,
    retries: int = 2,
    cfg: dict | None = None,
    use_heavy: bool = False,
):
    """OpenAI-compatible chat completions against Meta Model API (https://api.meta.ai/v1) with mock fallback.

    - Key is sent as-is in `Authorization: Bearer <LLM_API_KEY>`.
    - Retries with exponential backoff on 429 and 5xx.
    - Fails fast (no retry) on 401, 403, and 404, logging the response body.
    - Records live vs. mock fallback state in `LAST_LLM_STATUS`.
    """
    import httpx

    default_model = os.getenv("LLM_MODEL", DEFAULT_MODEL)
    heavy_model = os.getenv("LLM_MODEL_HEAVY") or default_model
    env_cfg = {
        "base_url": os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL),
        "api_key": os.getenv("LLM_API_KEY") or os.getenv("META_API_KEY") or "",
        "model": heavy_model if use_heavy else default_model,
    }
    if cfg:
        env_cfg.update(cfg)
        if use_heavy and cfg.get("model_heavy"):
            env_cfg["model"] = cfg["model_heavy"]

    base_url = str(env_cfg.get("base_url", DEFAULT_BASE_URL)).rstrip("/")
    api_key = str(env_cfg.get("api_key", "")).strip()
    model = _sanitize_model_id(str(env_cfg.get("model", DEFAULT_MODEL)))
    endpoint = f"{base_url}/chat/completions"

    if (
        not api_key
        or api_key.startswith("mock")
        or api_key == "your_api_key_here"
        or api_key.startswith("<placeholder")
    ):
        msg = f"LLM key missing/mock: using MOCK response, live model NOT called (model={model}, endpoint={endpoint})"
        logger.warning(msg)
        LAST_LLM_STATUS.update({
            "mode": "mock_fallback",
            "status_code": 0,
            "model": model,
            "endpoint": endpoint,
            "last_warning": msg,
        })
        return _get_mock_response(messages, json_mode)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    current_messages = list(messages)

    async with LLM_SEMAPHORE:
        async with httpx.AsyncClient(timeout=25.0) as client:
            for attempt in range(retries + 1):
                payload: dict[str, Any] = {
                    "model": model,
                    "messages": current_messages,
                    "temperature": 0.2,
                }
                if model.startswith("muse-"):
                    payload["reasoning_effort"] = "low" if use_heavy else "minimal"
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}
                    if not any(
                        "json" in str(m.get("content", "")).lower()
                        for m in current_messages
                    ):
                        current_messages.insert(
                            0,
                            {
                                "role": "system",
                                "content": "You are a helpful assistant that outputs JSON.",
                            },
                        )
                        payload["messages"] = current_messages
                try:
                    r = await client.post(endpoint, headers=headers, json=payload)
                    r.raise_for_status()
                    content = r.json()["choices"][0]["message"]["content"]
                    LAST_LLM_STATUS.update({
                        "mode": "live",
                        "status_code": r.status_code,
                        "model": model,
                        "endpoint": endpoint,
                        "last_warning": None,
                    })
                    if not json_mode:
                        return content
                    parsed = _extract_json(content)
                    if parsed is not None:
                        return parsed
                    if attempt < retries:
                        current_messages.append({"role": "assistant", "content": content})
                        current_messages.append({
                            "role": "user",
                            "content": "Return valid JSON only. No markdown commentary "
                                       "or code fences outside the JSON.",
                        })
                        continue
                except httpx.HTTPStatusError as e:
                    code = e.response.status_code if e.response is not None else 0
                    body_text = (e.response.text[:400] if e.response is not None else "")
                    # Fail fast (no retry) on 401, 403, and 404, and log the response body
                    if code in (401, 403, 404):
                        msg = (
                            f"LLM {code}: using MOCK response, live model NOT called "
                            f"(model={model}, endpoint={endpoint}, body={body_text})"
                        )
                        logger.warning(msg)
                        LAST_LLM_STATUS.update({
                            "mode": "mock_fallback",
                            "status_code": code,
                            "model": model,
                            "endpoint": endpoint,
                            "last_warning": msg,
                        })
                        return _get_mock_response(messages, json_mode)
                    # Retry with exponential backoff on 429 and 5xx
                    if (code == 429 or 500 <= code < 600) and attempt < retries:
                        backoff = 1.0 * (2 ** attempt)
                        logger.warning(
                            "LLM HTTP %s on %s (model=%s): retrying in %.1fs (body=%s)",
                            code, endpoint, model, backoff, body_text,
                        )
                        await asyncio.sleep(backoff)
                        continue
                    msg = (
                        f"LLM HTTP {code}: using MOCK response, live model NOT called "
                        f"(model={model}, endpoint={endpoint}, body={body_text})"
                    )
                    logger.warning(msg)
                    LAST_LLM_STATUS.update({
                        "mode": "mock_fallback",
                        "status_code": code,
                        "model": model,
                        "endpoint": endpoint,
                        "last_warning": msg,
                    })
                    return _get_mock_response(messages, json_mode)
                except Exception as exc:
                    if attempt < retries:
                        backoff = 1.0 * (2 ** attempt)
                        await asyncio.sleep(backoff)
                        continue
                    msg = (
                        f"LLM error ({exc}): using MOCK response, live model NOT called "
                        f"(model={model}, endpoint={endpoint})"
                    )
                    logger.warning(msg)
                    LAST_LLM_STATUS.update({
                        "mode": "mock_fallback",
                        "status_code": -1,
                        "model": model,
                        "endpoint": endpoint,
                        "last_warning": msg,
                    })
                    return _get_mock_response(messages, json_mode)

    msg = f"LLM retries exhausted: using MOCK response, live model NOT called (model={model}, endpoint={endpoint})"
    logger.warning(msg)
    LAST_LLM_STATUS.update({
        "mode": "mock_fallback",
        "status_code": -1,
        "model": model,
        "endpoint": endpoint,
        "last_warning": msg,
    })
    return _get_mock_response(messages, json_mode)
