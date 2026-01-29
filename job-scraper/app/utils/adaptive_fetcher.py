"""
Adaptive Fetcher - Busca paginas de forma inteligente.

Usa HTTP simples para sites estaticos e Playwright para sites dinamicos.
Economiza recursos ao evitar Playwright quando nao necessario.
"""

import asyncio
import logging
from typing import Optional, Tuple
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from utils.browser import browser_manager

logger = logging.getLogger(__name__)

# Sites que SEMPRE precisam de JavaScript
JS_REQUIRED_DOMAINS = {
    "geekhunter.com.br",
    "vagas.com.br",
    "catho.com.br",
    "99jobs.com",
}

# User-Agent padrao
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


class AdaptiveFetcher:
    """
    Busca paginas de forma inteligente.

    Estrategia:
    1. Verificar se dominio requer JS
    2. Se nao, tentar HTTP simples primeiro
    3. Se HTML parecer incompleto, usar Playwright
    """

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Obtem cliente HTTP singleton."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=self.timeout,
                headers={"User-Agent": DEFAULT_USER_AGENT},
                follow_redirects=True,
            )
        return self._http_client

    async def close(self):
        """Fecha recursos."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    def _domain_requires_js(self, url: str) -> bool:
        """Verifica se o dominio requer JavaScript."""
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Remover www. para comparacao
        if domain.startswith("www."):
            domain = domain[4:]

        return domain in JS_REQUIRED_DOMAINS

    def _html_needs_js(self, html: str) -> bool:
        """
        Detecta se o HTML precisa de JavaScript para renderizar conteudo.

        Sinais de SPA/JS-heavy:
        - Muito pouco texto (<500 chars)
        - Presenca de frameworks JS
        - Div root vazio (#app, #root)
        - Mensagens de "loading"
        """
        soup = BeautifulSoup(html, "lxml")

        # Remover scripts e styles
        for tag in soup.select("script, style, noscript"):
            tag.decompose()

        text = soup.get_text(separator=" ", strip=True)

        # Pouco texto = provavelmente SPA
        if len(text) < 500:
            logger.debug(f"HTML tem pouco texto ({len(text)} chars), pode precisar de JS")
            return True

        # Verificar sinais de SPA
        spa_indicators = [
            "React",
            "__NEXT_DATA__",
            "ng-app",
            "data-reactroot",
            'id="app"',
            'id="root"',
            'id="__next"',
            "loading...",
            "carregando...",
        ]

        html_lower = html.lower()
        for indicator in spa_indicators:
            if indicator.lower() in html_lower:
                # Mas verificar se tem conteudo mesmo assim
                if len(text) < 1000:
                    logger.debug(f"Detectado indicador SPA: {indicator}")
                    return True

        return False

    async def fetch_with_http(self, url: str) -> Tuple[str, int]:
        """
        Busca pagina usando HTTP simples.

        Returns:
            Tuple[html, status_code]
        """
        client = await self._get_http_client()

        try:
            response = await client.get(url)
            return response.text, response.status_code
        except Exception as e:
            logger.error(f"HTTP fetch failed for {url}: {e}")
            raise

    async def fetch_with_playwright(
        self,
        url: str,
        wait_for_selector: Optional[str] = None,
        wait_until: str = "networkidle",
    ) -> str:
        """
        Busca pagina usando Playwright (renderiza JavaScript).

        Args:
            url: URL para buscar
            wait_for_selector: Seletor CSS para aguardar (opcional)
            wait_until: Evento de navegacao para aguardar

        Returns:
            HTML renderizado
        """
        context = await browser_manager.create_context()
        page = await context.new_page()

        try:
            await page.goto(url, wait_until=wait_until, timeout=int(self.timeout * 1000))

            if wait_for_selector:
                try:
                    await page.wait_for_selector(wait_for_selector, timeout=10000)
                except Exception:
                    logger.warning(f"Selector '{wait_for_selector}' nao encontrado")

            return await page.content()
        finally:
            await context.close()

    async def fetch(
        self,
        url: str,
        force_js: bool = False,
        wait_for_selector: Optional[str] = None,
    ) -> str:
        """
        Busca pagina de forma adaptativa.

        Estrategia:
        1. Se force_js=True ou dominio conhecido por JS, usa Playwright
        2. Senao, tenta HTTP primeiro
        3. Se HTML parecer incompleto, faz fallback para Playwright

        Args:
            url: URL para buscar
            force_js: Forcar uso de Playwright
            wait_for_selector: Seletor CSS para aguardar (Playwright)

        Returns:
            HTML da pagina
        """
        # Verificar se precisa forcar JS
        needs_js = force_js or self._domain_requires_js(url)

        if needs_js:
            logger.info(f"Usando Playwright para {url} (JS required)")
            return await self.fetch_with_playwright(url, wait_for_selector)

        # Tentar HTTP primeiro
        logger.info(f"Tentando HTTP para {url}")
        try:
            html, status = await self.fetch_with_http(url)

            if status != 200:
                logger.warning(f"HTTP retornou {status}, tentando Playwright")
                return await self.fetch_with_playwright(url, wait_for_selector)

            # Verificar se HTML precisa de JS
            if self._html_needs_js(html):
                logger.info(f"HTML incompleto, usando Playwright para {url}")
                return await self.fetch_with_playwright(url, wait_for_selector)

            logger.info(f"HTTP bem-sucedido para {url}")
            return html

        except Exception as e:
            logger.warning(f"HTTP falhou ({e}), tentando Playwright")
            return await self.fetch_with_playwright(url, wait_for_selector)


# Singleton instance
_fetcher: Optional[AdaptiveFetcher] = None


def get_adaptive_fetcher() -> AdaptiveFetcher:
    """Obtem instancia singleton do fetcher."""
    global _fetcher
    if _fetcher is None:
        _fetcher = AdaptiveFetcher()
    return _fetcher
