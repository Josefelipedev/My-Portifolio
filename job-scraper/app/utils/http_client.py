"""
HTTP Client com retry — busca páginas via HTTP simples (sem Playwright).

Migrado do clawlite/scraper.py com adaptação para async (httpx) e
suporte a proxy DataImpulse. Usa tenacity para retry com backoff exponencial.
"""

import logging
from urllib.parse import urljoin, urlparse

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import config

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {403, 429, 500, 502, 503, 504}

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
}


def _build_proxies() -> dict | None:
    if not config.PROXY_CONFIGURED:
        return None
    proxy_url = config.proxy_url
    return {"http://": proxy_url, "https://": proxy_url}


@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def fetch_html(url: str, use_proxy: bool = False) -> str:
    """
    Busca HTML de uma URL via HTTP (async httpx) com retry automático.

    Args:
        url: URL para buscar
        use_proxy: Se True, usa proxy DataImpulse configurado

    Returns:
        HTML como string

    Raises:
        httpx.HTTPStatusError: Para status não-retentáveis
        httpx.TimeoutException: Após esgotar as tentativas
    """
    proxies = _build_proxies() if use_proxy else None

    async with httpx.AsyncClient(
        headers=DEFAULT_HEADERS,
        follow_redirects=True,
        timeout=config.SCRAPER_TIMEOUT,
        proxies=proxies,
    ) as client:
        response = await client.get(url)

        if response.status_code in RETRYABLE_STATUS_CODES:
            response.raise_for_status()  # triggera retry

        response.raise_for_status()

        # Forçar detecção de encoding correto
        text = response.text
        return text


def extract_links(html: str, base_url: str) -> list[str]:
    """
    Extrai todos os links internos de uma página HTML.

    Args:
        html: HTML da página
        base_url: URL base para resolver links relativos

    Returns:
        Lista de URLs únicas do mesmo domínio
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

    return list(dict.fromkeys(links))  # deduplica preservando ordem
