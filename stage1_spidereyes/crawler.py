"""Async crawler: BFS with httpx + BeautifulSoup, SPA detection via Playwright.

Extracts links, forms, form fields, static JS src URLs, API routes.
"""

import asyncio
import re
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
from bs4 import BeautifulSoup
import httpx

try:
    from nikspider.stage0_intake_guard.guard import GuardedClient, is_allowed_target
except ImportError:
    from backend.guard import GuardedClient, is_allowed_target

SKIP_EXTENSIONS = (
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".css", ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".pdf", ".mp4", ".mp3", ".map"
)

API_PATH_PATTERN = re.compile(
    r'["\'](/(?:api|rest)/[a-zA-Z0-9_\-\./]+(?:\?[a-zA-Z0-9_\-\.&=]*)?)["\']'
)


class Crawler:
    def __init__(
        self,
        start_url: str,
        max_pages: int = 200,
        max_depth: int = 3,
        delay: float = 0.2,
        seed_endpoints: list[str] | None = None,
        scan_id: str | None = None,
        use_playwright_for_spa: bool = True,
        client: httpx.AsyncClient | None = None,
    ):
        self.start_url = start_url
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.delay = delay
        self.seed_endpoints = seed_endpoints or []
        self.scan_id = scan_id
        self.use_playwright_for_spa = use_playwright_for_spa
        self._ext_client = client

        parsed = urlparse(start_url)
        self.base_host = parsed.netloc
        self.scheme = parsed.scheme
        self.base_origin = f"{parsed.scheme}://{parsed.netloc}"

        self.seen: set[str] = set()
        self.queue: list[tuple[str, int]] = [(start_url, 0)]
        self.pages: list[dict] = []
        self.captured_apis: set[str] = set()

    def _is_in_scope(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.netloc != self.base_host:
            return False
        clean_path = parsed.path.lower()
        if any(clean_path.endswith(ext) for ext in SKIP_EXTENSIONS):
            return False
        return True

    def _normalize_url(self, url: str) -> str:
        parsed = urlparse(url)
        fragment = parsed.fragment
        if fragment and fragment.startswith("/"):
            return f"{parsed.scheme}://{parsed.netloc}{parsed.path}#{fragment}"
        base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            base += f"?{parsed.query}"
        return base

    async def _try_playwright_spa(self, url: str) -> dict | None:
        if not self.use_playwright_for_spa:
            return None
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                spa_apis: list[str] = []
                page.on(
                    "request",
                    lambda req: spa_apis.append(req.url)
                    if ("/api/" in req.url or "/rest/" in req.url)
                    else None,
                )
                try:
                    await page.goto(url, wait_until="networkidle", timeout=12000)
                except Exception:
                    await page.goto(url, wait_until="domcontentloaded", timeout=6000)

                content = await page.content()
                current_url = page.url
                inputs = await page.eval_on_selector_all(
                    "input",
                    "els => els.map(e => ({ name: e.name || e.id || e.placeholder, type: e.type }))",
                )
                await browser.close()

                for api in spa_apis:
                    self.captured_apis.add(api)

                return {
                    "content": content,
                    "url": current_url,
                    "inputs": [i["name"] for i in inputs if i.get("name")],
                    "apis": spa_apis,
                }
        except Exception:
            return None

    async def _crawl_with(self, client: httpx.AsyncClient) -> None:
        while self.queue and len(self.pages) < self.max_pages:
            current_url, depth = self.queue.pop(0)
            norm_url = self._normalize_url(current_url)

            if norm_url in self.seen:
                continue
            if depth > self.max_depth:
                continue
            self.seen.add(norm_url)

            if self.delay > 0:
                await asyncio.sleep(self.delay)

            response = None
            content_type = ""
            status_code = 0
            text = ""

            try:
                response = await client.get(norm_url)
                status_code = response.status_code
                content_type = response.headers.get("content-type", "").lower()
                text = response.text
            except Exception:
                continue

            is_spa_suspect = "#/" in norm_url or '<div id="root">' in text or "<app-root>" in text
            spa_data = None
            if is_spa_suspect and depth == 0:
                spa_data = await self._try_playwright_spa(norm_url)
                if spa_data and spa_data.get("content"):
                    text = spa_data["content"]

            soup = (
                BeautifulSoup(text, "html.parser")
                if ("html" in content_type or "<html" in text.lower())
                else None
            )
            forms: list[dict] = []
            scripts: list[str] = []
            links: list[str] = []

            if soup:
                for f in soup.find_all("form"):
                    action = f.get("action")
                    action_url = urljoin(norm_url, action) if action else norm_url
                    input_names = [
                        i.get("name")
                        for i in f.find_all(["input", "textarea", "select"])
                        if i.get("name")
                    ]
                    forms.append({
                        "action": action_url,
                        "method": f.get("method", "get").lower(),
                        "inputs": input_names,
                    })

                for s in soup.find_all("script", src=True):
                    scripts.append(urljoin(norm_url, s["src"]))

                if depth < self.max_depth:
                    for a in soup.find_all("a", href=True):
                        href = a["href"].strip()
                        if href and not href.startswith(("javascript:", "mailto:", "tel:")):
                            resolved = urljoin(norm_url, href)
                            clean = self._normalize_url(resolved)
                            links.append(clean)
                            if self._is_in_scope(clean) and clean not in self.seen:
                                self.queue.append((clean, depth + 1))

            if "html" in content_type or "javascript" in content_type or "<html" in text.lower():
                for match in API_PATH_PATTERN.findall(text):
                    self.captured_apis.add(urljoin(norm_url, match))

            set_cookies: list[str] = []
            if response:
                sc = response.headers.get("set-cookie")
                if sc:
                    set_cookies = [sc]

            query_params = list(parse_qs(urlparse(norm_url).query).keys())

            page_record: dict = {
                "url": norm_url,
                "status": status_code,
                "content_type": content_type,
                "depth": depth,
                "query_params": query_params,
                "forms": forms,
                "scripts": scripts,
                "links": links,
                "set_cookies": set_cookies,
                "apis_detected": list(self.captured_apis),
            }

            if spa_data and spa_data.get("inputs"):
                page_record["forms"].append({
                    "action": norm_url,
                    "method": "get",
                    "inputs": spa_data["inputs"],
                })

            self.pages.append(page_record)

    async def crawl(self) -> list[dict]:
        for seed in self.seed_endpoints:
            full_seed = urljoin(self.base_origin, seed)
            if self._is_in_scope(full_seed):
                self.queue.append((full_seed, 1))

        if self._ext_client is not None:
            await self._crawl_with(self._ext_client)
        else:
            async with GuardedClient(
                scan_id=self.scan_id, timeout=12.0, follow_redirects=True, verify=False
            ) as client:
                await self._crawl_with(client)

        for api_url in list(self.captured_apis):
            if len(self.pages) >= self.max_pages:
                break
            norm_api = self._normalize_url(api_url)
            if norm_api not in self.seen and self._is_in_scope(norm_api):
                self.seen.add(norm_api)
                parsed_api = urlparse(norm_api)
                self.pages.append({
                    "url": norm_api,
                    "status": 200,
                    "content_type": "application/json",
                    "depth": 1,
                    "query_params": list(parse_qs(parsed_api.query).keys()),
                    "forms": [],
                    "scripts": [],
                    "links": [],
                    "set_cookies": [],
                    "apis_detected": [],
                })

        return self.pages


async def crawl(
    start_url: str,
    max_pages: int = 200,
    max_depth: int = 3,
    delay: float = 0.2,
    seed_endpoints: list[str] | None = None,
    scan_id: str | None = None,
) -> list[dict]:
    return await Crawler(
        start_url=start_url,
        max_pages=max_pages,
        max_depth=max_depth,
        delay=delay,
        seed_endpoints=seed_endpoints,
        scan_id=scan_id,
    ).crawl()