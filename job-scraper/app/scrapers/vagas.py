"""
Vagas.com.br Scraper - Busca vagas no Vagas.com.br

Site com conteudo dinamico que requer Playwright.
"""

import hashlib
import logging
from typing import List, Optional, Set

from bs4 import BeautifulSoup
from bs4.element import Tag

from scrapers.hybrid_scraper import HybridScraper
from models import JobListing, JobSource

logger = logging.getLogger(__name__)


class VagasComBrScraper(HybridScraper):
    """Scraper para Vagas.com.br"""

    name = "vagascombr"
    base_url = "https://www.vagas.com.br"

    # Vagas.com.br precisa de JS
    REQUIRES_JS = True
    WAIT_FOR_SELECTOR = ".link-detalhes-vaga, .vaga"

    def build_search_url(self, keyword: str, country: str) -> str:
        """Constroi URL de busca."""
        keyword_slug = keyword.replace(" ", "-")
        return f"{self.base_url}/vagas-de-{keyword_slug}"

    def _extract_url(self, link: Tag) -> Optional[str]:
        """Extrai URL da vaga."""
        url = link.get("href", "")
        if not url:
            return None

        if not url.startswith("http"):
            url = f"{self.base_url}{url}"

        return url

    def _extract_title(self, link: Tag) -> str:
        """Extrai titulo da vaga."""
        return link.get("title", "") or link.get_text(strip=True)

    def _extract_container_field(
        self, container: Optional[Tag], selectors: str
    ) -> str:
        """Extrai campo do container."""
        if not container:
            return ""
        elem = container.select_one(selectors)
        return elem.get_text(strip=True) if elem else ""

    def _parse_job_link(
        self, link: Tag, seen_urls: Set[str]
    ) -> Optional[JobListing]:
        """Parseia um link de vaga e retorna JobListing ou None."""
        url = self._extract_url(link)
        title = self._extract_title(link)

        if not url or not title or url in seen_urls:
            return None

        seen_urls.add(url)

        # Encontrar container pai para mais informacoes
        container = link.find_parent("li") or link.find_parent("div")

        company = self._extract_container_field(container, ".emprVaga, .empresa")
        location = self._extract_container_field(container, ".vaga-local, .local")
        level = self._extract_container_field(container, ".nivelVaga, .nivel")

        job_id = self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12])

        return JobListing(
            id=job_id,
            source=JobSource.VAGASCOMBR,
            title=title,
            company=company or "Empresa confidencial",
            description=f"Nivel: {level}" if level else "",
            url=url,
            location=location or "Brasil",
            job_type="On-site",
            salary=None,
            tags=[level] if level else [],
            posted_at=None,
            country="br",
        )

    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parse Vagas.com.br HTML para extrair vagas."""
        jobs: List[JobListing] = []
        soup = BeautifulSoup(html, "lxml")
        seen_urls: Set[str] = set()

        job_links = soup.select("a.link-detalhes-vaga")

        for link in job_links[: limit * 2]:
            try:
                job = self._parse_job_link(link, seen_urls)
                if job:
                    jobs.append(job)
                    if len(jobs) >= limit:
                        break
            except Exception as e:
                logger.debug(f"Erro ao parsear vaga: {e}")

        return jobs
