"""
robots.txt checker — verifica se scraping é permitido antes de buscar.

Migrado do multiscraper/security/robots.py.
Cache de 24h por domínio para evitar requisições repetidas.
"""

import urllib.robotparser
from urllib.parse import urlparse
from typing import Dict, Tuple
from datetime import datetime, timedelta, timezone

import httpx

_cache: Dict[str, Tuple[urllib.robotparser.RobotFileParser, datetime]] = {}
_CACHE_TTL = timedelta(hours=24)
_BOT_NAME = "PortfolioJobScraper"


async def can_fetch(url: str) -> bool:
    """
    Verifica se o robots.txt permite scraping desta URL.

    Retorna True se:
    - scraping é explicitamente permitido
    - robots.txt não está acessível (assume permitido)
    - domínio ainda não foi verificado (cacheado por 24h)
    """
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    robots_url = f"{base}/robots.txt"

    now = datetime.now(timezone.utc)
    if base in _cache:
        parser, fetched_at = _cache[base]
        if now - fetched_at < _CACHE_TTL:
            return parser.can_fetch(_BOT_NAME, url) or parser.can_fetch("*", url)

    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(robots_url)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(robots_url, follow_redirects=True)
            if resp.status_code == 200:
                parser.parse(resp.text.splitlines())
            else:
                # Sem robots.txt = permite
                _cache[base] = (parser, now)
                return True
    except Exception:
        # Inacessível = assume permitido
        _cache[base] = (parser, now)
        return True

    _cache[base] = (parser, now)
    return parser.can_fetch(_BOT_NAME, url) or parser.can_fetch("*", url)
