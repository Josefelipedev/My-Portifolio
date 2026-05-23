"""
HTTP Client com retry, User-Agent rotation e proxy automático.

Combina:
- tenacity (retry com backoff exponencial) — do clawlite
- User-Agent rotation (5 UAs diferentes) — do multiscraper
- Proxy automático: tenta sem → fallback com proxy em 403/429 — do multiscraper
- fetch_json separado para APIs JSON — do multiscraper
"""

import asyncio
import logging
import random
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from config import config

logger = logging.getLogger(__name__)

# ── User-Agent rotation (5 browsers/OSes) ───────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

# Domínios que sempre precisam de proxy (bloqueiam scrapers agressivamente)
ALWAYS_PROXY_DOMAINS: set[str] = set()

RETRYABLE_STATUS_CODES = {403, 429, 500, 502, 503, 504}


def _random_headers(accept: str = "html") -> dict:
    accept_map = {
        "html": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "json": "application/json, text/plain, */*",
    }
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": accept_map.get(accept, accept_map["html"]),
        "Accept-Language": "pt-PT,pt;q=0.9,pt-BR;q=0.8,en-US;q=0.7,en;q=0.6",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
    }


def _build_proxy() -> Optional[str]:
    if config.PROXY_CONFIGURED:
        return config.proxy_url
    return None


def _needs_proxy(url: str) -> bool:
    """Sempre usa proxy para domínios conhecidos por bloquear scrapers."""
    if not config.PROXY_CONFIGURED:
        return False
    return any(domain in url for domain in ALWAYS_PROXY_DOMAINS)


async def fetch_html(
    url: str,
    params: dict = None,
    extra_headers: dict = None,
    force_proxy: bool = False,
) -> Optional[str]:
    """
    Busca HTML de uma URL com User-Agent aleatório.

    Estratégia de proxy:
    1. Tenta SEM proxy
    2. Se 403/429 → tenta COM proxy automaticamente (se configurado)
    3. Domínios em ALWAYS_PROXY_DOMAINS → sempre usa proxy desde o início

    Args:
        url: URL para buscar
        params: Query params adicionais
        extra_headers: Headers extras para mesclar
        force_proxy: Forçar uso do proxy mesmo sem bot-detection

    Returns:
        HTML como string ou None em caso de erro
    """
    headers = _random_headers("html")
    if extra_headers:
        headers.update(extra_headers)

    use_proxy = force_proxy or _needs_proxy(url)
    proxy = _build_proxy() if use_proxy else None

    try:
        async with httpx.AsyncClient(
            headers=headers,
            proxy=proxy,
            follow_redirects=True,
            timeout=config.SCRAPER_TIMEOUT,
        ) as client:
            resp = await client.get(url, params=params)

            if resp.status_code == 200:
                return resp.text

            # Fallback para proxy em bot-detection
            if resp.status_code in (403, 429, 503) and not use_proxy:
                fallback_proxy = _build_proxy()
                if fallback_proxy:
                    logger.info(
                        "Bot detection (%d) em %s — retentando via proxy",
                        resp.status_code, url,
                    )
                    await asyncio.sleep(1)
                    return await fetch_html(url, params, extra_headers, force_proxy=True)

            logger.warning("fetch_html %s → HTTP %d", url, resp.status_code)
            return None

    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning("fetch_html timeout/connection error em %s: %s", url, e)
        return None
    except Exception as e:
        logger.debug("fetch_html error em %s: %s", url, e)
        return None


async def fetch_json(
    url: str,
    params: dict = None,
    extra_headers: dict = None,
    force_proxy: bool = False,
) -> Optional[dict | list]:
    """
    Busca JSON de uma API com User-Agent aleatório.

    Mesma estratégia de proxy que fetch_html.

    Returns:
        dict/list parseado ou None em caso de erro
    """
    headers = _random_headers("json")
    if extra_headers:
        headers.update(extra_headers)

    use_proxy = force_proxy or _needs_proxy(url)
    proxy = _build_proxy() if use_proxy else None

    try:
        async with httpx.AsyncClient(
            headers=headers,
            proxy=proxy,
            follow_redirects=True,
            timeout=config.SCRAPER_TIMEOUT,
        ) as client:
            resp = await client.get(url, params=params)

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code in (403, 429, 503) and not use_proxy:
                fallback_proxy = _build_proxy()
                if fallback_proxy:
                    logger.info(
                        "Bot detection (%d) em %s — retentando via proxy",
                        resp.status_code, url,
                    )
                    await asyncio.sleep(1)
                    return await fetch_json(url, params, extra_headers, force_proxy=True)

            logger.warning("fetch_json %s → HTTP %d", url, resp.status_code)
            return None

    except Exception as e:
        logger.debug("fetch_json error em %s: %s", url, e)
        return None


def extract_links(html: str, base_url: str) -> list[str]:
    """
    Extrai todos os links internos de uma página HTML.

    Returns:
        Lista de URLs únicas do mesmo domínio, preservando ordem
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    base_domain = urlparse(base_url).netloc
    links = []

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        if not href or href.startswith(("#", "mailto:", "javascript:", "tel:")):
            continue
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        if parsed.scheme in ("http", "https") and parsed.netloc == base_domain:
            links.append(full_url)

    return list(dict.fromkeys(links))
