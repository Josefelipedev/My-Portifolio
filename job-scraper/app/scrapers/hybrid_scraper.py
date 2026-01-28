"""
Hybrid Scraper - Combina parsing tradicional com AI fallback.

Estrategia:
1. Busca pagina com AdaptiveFetcher (HTTP ou Playwright)
2. Tenta parsing tradicional com seletores CSS
3. Se encontrar poucas vagas, usa AI como fallback
4. Deduplicar e retornar resultados
"""

import logging
import os
from abc import abstractmethod
from typing import List, Optional, Set

from scrapers.base import BaseScraper
from models import JobListing
from utils.adaptive_fetcher import get_adaptive_fetcher
from agents.agno_job_extractor import get_agno_job_extractor

logger = logging.getLogger(__name__)

# Configuracao de AI fallback
AI_FALLBACK_ENABLED = os.getenv("ENABLE_AI_FALLBACK", "true").lower() == "true"
AI_FALLBACK_THRESHOLD = int(os.getenv("AI_FALLBACK_THRESHOLD", "3"))


class HybridScraper(BaseScraper):
    """
    Base class para scrapers hibridos.

    Combina:
    - AdaptiveFetcher: HTTP para sites estaticos, Playwright para dinamicos
    - Parsing tradicional: Seletores CSS especificos do site
    - AI fallback: Quando parsing tradicional falha

    Subclasses devem implementar:
    - name: Nome do scraper
    - base_url: URL base do site
    - REQUIRES_JS: Se precisa JavaScript
    - build_search_url(): Construir URL de busca
    - _parse_html(): Parsing especifico do site
    """

    # Configuracao (override na subclass)
    REQUIRES_JS: bool = False
    WAIT_FOR_SELECTOR: Optional[str] = None

    async def search(
        self,
        keyword: str,
        country: str = "br",
        limit: int = 50,
    ) -> List[JobListing]:
        """
        Busca vagas usando estrategia hibrida.

        Args:
            keyword: Palavra-chave de busca
            country: Codigo do pais
            limit: Limite de vagas

        Returns:
            Lista de JobListing
        """
        # 1. Construir URL
        url = self.build_search_url(keyword, country)
        logger.info(f"[{self.name}] Buscando: {url}")

        # 2. Buscar pagina
        fetcher = get_adaptive_fetcher()
        html = await fetcher.fetch(
            url=url,
            force_js=self.REQUIRES_JS,
            wait_for_selector=self.WAIT_FOR_SELECTOR,
        )

        # 3. Tentar parsing tradicional
        jobs = self._parse_html(html, limit)
        logger.info(f"[{self.name}] Parsing tradicional: {len(jobs)} vagas")

        # 4. AI fallback se necessario
        if len(jobs) < AI_FALLBACK_THRESHOLD and AI_FALLBACK_ENABLED:
            logger.info(
                f"[{self.name}] Poucas vagas ({len(jobs)}), "
                f"tentando AI fallback (threshold={AI_FALLBACK_THRESHOLD})"
            )
            ai_jobs = await self._try_ai_extraction(html, limit)

            if ai_jobs:
                # Mesclar resultados, priorizando parsing tradicional
                jobs = self._merge_jobs(jobs, ai_jobs, limit)
                logger.info(f"[{self.name}] Apos AI merge: {len(jobs)} vagas")

        return jobs[:limit]

    @abstractmethod
    def build_search_url(self, keyword: str, country: str) -> str:
        """Constroi URL de busca. Override na subclass."""
        pass

    @abstractmethod
    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parsing especifico do site. Override na subclass."""
        pass

    async def _try_ai_extraction(
        self,
        html: str,
        limit: int,
    ) -> List[JobListing]:
        """Tenta extrair vagas com AI."""
        try:
            extractor = get_agno_job_extractor()

            if not extractor.is_available():
                logger.warning(f"[{self.name}] AI extraction not available")
                return []

            return await extractor.extract_jobs(
                html=html,
                source=self.name,
                max_jobs=limit,
            )
        except Exception as e:
            logger.error(f"[{self.name}] AI extraction failed: {e}")
            return []

    def _merge_jobs(
        self,
        primary: List[JobListing],
        secondary: List[JobListing],
        limit: int,
    ) -> List[JobListing]:
        """
        Mescla duas listas de vagas, removendo duplicatas.

        Primary tem prioridade (geralmente parsing tradicional).
        """
        # Usar URL como chave de deduplicacao
        seen_urls: Set[str] = {job.url for job in primary if job.url}

        # Tambem usar titulo+empresa para detectar duplicatas
        seen_keys: Set[str] = {
            f"{job.title.lower()}|{job.company.lower()}"
            for job in primary
        }

        merged = list(primary)

        for job in secondary:
            # Pular se URL ja existe
            if job.url and job.url in seen_urls:
                continue

            # Pular se titulo+empresa ja existe
            key = f"{job.title.lower()}|{job.company.lower()}"
            if key in seen_keys:
                continue

            merged.append(job)
            if job.url:
                seen_urls.add(job.url)
            seen_keys.add(key)

            if len(merged) >= limit:
                break

        return merged
