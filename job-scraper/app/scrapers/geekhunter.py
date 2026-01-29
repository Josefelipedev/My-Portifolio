"""
GeekHunter Scraper - Busca vagas no GeekHunter.com.br

Site React SPA que requer Playwright para renderizar JavaScript.
"""

import hashlib
import logging
from typing import List, Optional, Set

from bs4 import BeautifulSoup
from bs4.element import Tag

from scrapers.hybrid_scraper import HybridScraper
from models import JobListing, JobSource

logger = logging.getLogger(__name__)


class GeekHunterScraper(HybridScraper):
    """Scraper para GeekHunter.com.br"""

    name = "geekhunter"
    base_url = "https://www.geekhunter.com.br"

    # GeekHunter e SPA React, precisa de JS
    REQUIRES_JS = True
    WAIT_FOR_SELECTOR = '[data-testid="job-card"], .job-card, .vaga-card'

    def build_search_url(self, keyword: str, country: str) -> str:
        """Constroi URL de busca."""
        return f"{self.base_url}/vagas?search={keyword}"

    def _find_job_cards(self, soup: BeautifulSoup) -> List[Tag]:
        """Encontra cards de vagas usando multiplos seletores."""
        selectors = [
            '[data-testid="job-card"]',
            ".job-card",
            ".vaga-card",
            'a[href*="/vagas/"]',
        ]
        for selector in selectors:
            cards = soup.select(selector)
            if cards:
                return cards
        return []

    def _extract_url(self, card: Tag) -> Optional[str]:
        """Extrai URL da vaga do card."""
        link = card if card.name == "a" else card.select_one('a[href*="/vagas/"]')
        if not link:
            return None

        url = link.get("href", "")
        if not url:
            return None

        if not url.startswith("http"):
            url = f"{self.base_url}{url}"

        return url

    def _extract_title(self, card: Tag) -> str:
        """Extrai titulo da vaga."""
        title_elem = card.select_one('h2, h3, .job-title, [data-testid="job-title"]')
        if title_elem:
            return title_elem.get_text(strip=True)

        link = card if card.name == "a" else card.select_one("a")
        if link:
            return link.get_text(strip=True)

        return ""

    def _extract_field(self, card: Tag, selectors: str, default: str = "") -> str:
        """Extrai campo do card usando seletores."""
        elem = card.select_one(selectors)
        return elem.get_text(strip=True) if elem else default

    def _extract_tags(self, card: Tag) -> List[str]:
        """Extrai tags/skills do card."""
        tag_elems = card.select(".tag, .skill, .tech-stack span")
        return [t.get_text(strip=True) for t in tag_elems][:10]

    def _parse_card(self, card: Tag, seen_urls: Set[str]) -> Optional[JobListing]:
        """Parseia um card individual e retorna JobListing ou None."""
        url = self._extract_url(card)
        if not url or url in seen_urls:
            return None

        title = self._extract_title(card)
        if not title or len(title) < 5:
            return None

        seen_urls.add(url)

        company = self._extract_field(
            card, '.company, .empresa, [data-testid="company-name"]'
        )
        location = self._extract_field(
            card, '.location, .local, [data-testid="location"]', "Brasil"
        )
        salary = self._extract_field(
            card, '.salary, .salario, [data-testid="salary"]'
        ) or None

        job_id = self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12])

        return JobListing(
            id=job_id,
            source=JobSource.GEEKHUNTER,
            title=title,
            company=company or "Empresa nao identificada",
            description="",
            url=url,
            location=location,
            job_type="On-site",
            salary=salary,
            tags=self._extract_tags(card),
            posted_at=None,
            country="br",
        )

    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parse GeekHunter HTML para extrair vagas."""
        jobs: List[JobListing] = []
        soup = BeautifulSoup(html, "lxml")
        seen_urls: Set[str] = set()

        job_cards = self._find_job_cards(soup)

        for card in job_cards[: limit * 2]:
            try:
                job = self._parse_card(card, seen_urls)
                if job:
                    jobs.append(job)
                    if len(jobs) >= limit:
                        break
            except Exception as e:
                logger.debug(f"Erro ao parsear job card: {e}")

        return jobs
