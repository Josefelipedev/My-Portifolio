"""
GeekHunter Scraper — Busca vagas no GeekHunter.com.br

Site React SPA que requer Playwright para renderizar JavaScript.
O parsing combina seletores CSS (HTML renderizado) com fallback regex
baseado nos hrefs dos links (técnica do clawlite).
"""

import hashlib
import logging
import re
from typing import List, Optional, Set
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from bs4.element import Tag

from scrapers.hybrid_scraper import HybridScraper
from models import JobListing, JobSource

logger = logging.getLogger(__name__)

BASE_URL = "https://www.geekhunter.com.br"

# Pattern de URL de vaga: /company-slug/jobs/job-slug
JOB_URL_RE = re.compile(r"geekhunter\.com\.br/[^/]+/jobs/[^/?#]+")

# Strips de texto indesejado
_STRIP_SUFFIX = re.compile(r"Visualizar\s+vaga.*$", re.IGNORECASE | re.DOTALL)
_PUBLICADA_RE = re.compile(r"Publicada\s+há\s+[\w\s]+", re.IGNORECASE)
_REMOTE_RE = re.compile(r"\b(Remoto|Híbrido|Presencial|Brasil)\b", re.IGNORECASE)


class GeekHunterScraper(HybridScraper):
    """Scraper para GeekHunter.com.br"""

    name = "geekhunter"
    base_url = BASE_URL

    # GeekHunter é SPA React — precisa de JS
    REQUIRES_JS = True
    WAIT_FOR_SELECTOR = '[data-testid="job-card"], .job-card, a[href*="/jobs/"]'

    def build_search_url(self, keyword: str, country: str) -> str:
        return f"{self.base_url}/vagas?search={keyword}"

    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parse GeekHunter HTML — tenta CSS primeiro, depois regex por href."""
        soup = BeautifulSoup(html, "lxml")
        seen_urls: Set[str] = set()
        jobs: List[JobListing] = []

        # Estratégia 1: cards renderizados pelo React
        jobs = self._parse_cards(soup, seen_urls, limit)

        # Estratégia 2: fallback via links (funciona mesmo sem JS completo)
        if len(jobs) < 3:
            logger.info(f"[geekhunter] Poucos resultados via CSS ({len(jobs)}), usando fallback por links")
            link_jobs = self._parse_links(soup, seen_urls, limit - len(jobs))
            jobs.extend(link_jobs)

        return jobs[:limit]

    # ── Estratégia 1: seletores CSS ─────────────────────────────────────────

    def _parse_cards(self, soup: BeautifulSoup, seen_urls: Set[str], limit: int) -> List[JobListing]:
        cards = soup.select(
            '[data-testid="job-card"], .job-card, .vaga-card'
        )
        jobs: List[JobListing] = []

        for card in cards[: limit * 2]:
            try:
                job = self._parse_card(card, seen_urls)
                if job:
                    jobs.append(job)
                    if len(jobs) >= limit:
                        break
            except Exception as e:
                logger.debug(f"Erro ao parsear card: {e}")

        return jobs

    def _parse_card(self, card: Tag, seen_urls: Set[str]) -> Optional[JobListing]:
        url = self._extract_card_url(card)
        if not url or url in seen_urls:
            return None

        title = self._extract_card_title(card)
        if not title or len(title) < 5:
            return None

        seen_urls.add(url)

        company = (
            self._field(card, '.company, .empresa, [data-testid="company-name"]')
            or self._company_from_url(url)
        )
        location = self._field(card, '.location, .local, [data-testid="location"]', "Brasil")
        salary = self._field(card, '.salary, .salario, [data-testid="salary"]') or None
        tags = [t.get_text(strip=True) for t in card.select(".tag, .skill, .tech-stack span")][:10]

        return JobListing(
            id=self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12]),
            source=JobSource.GEEKHUNTER,
            title=title,
            company=company or "Empresa não identificada",
            description="",
            url=url,
            location=location,
            job_type="On-site",
            salary=salary,
            tags=tags,
            posted_at=None,
            country="br",
        )

    def _extract_card_url(self, card: Tag) -> Optional[str]:
        link = card if card.name == "a" else card.select_one('a[href*="/jobs/"]')
        if not link:
            return None
        href = link.get("href", "")
        return href if href.startswith("http") else f"{self.base_url}{href}" if href else None

    def _extract_card_title(self, card: Tag) -> str:
        elem = card.select_one('h2, h3, .job-title, [data-testid="job-title"]')
        if elem:
            return elem.get_text(strip=True)
        link = card if card.name == "a" else card.select_one("a")
        return link.get_text(strip=True) if link else ""

    def _field(self, card: Tag, selector: str, default: str = "") -> str:
        elem = card.select_one(selector)
        return elem.get_text(strip=True) if elem else default

    # ── Estratégia 2: regex sobre hrefs (técnica do clawlite) ───────────────

    def _parse_links(self, soup: BeautifulSoup, seen_urls: Set[str], limit: int) -> List[JobListing]:
        jobs: List[JobListing] = []

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not JOB_URL_RE.search(href):
                continue

            url = href if href.startswith("http") else urljoin(BASE_URL, href)
            if url in seen_urls:
                continue
            seen_urls.add(url)

            raw_text = a.get_text(separator=" ", strip=True)
            text = _STRIP_SUFFIX.sub("", raw_text).strip()

            # Extrair data "Publicada há X"
            pub_match = _PUBLICADA_RE.search(text)
            if pub_match:
                after_pub = text[pub_match.end():].strip()
                text = text[: pub_match.start()].strip()
            else:
                after_pub = ""

            # Extrair localização
            loc_match = _REMOTE_RE.search(text)
            if loc_match:
                location = loc_match.group(0)
                title = text[: loc_match.start()].strip()
            else:
                loc_match2 = _REMOTE_RE.search(after_pub)
                location = loc_match2.group(0) if loc_match2 else "Brasil"
                title = text.strip()

            if not title or len(title) < 5:
                continue

            company = self._company_from_url(url)

            jobs.append(JobListing(
                id=self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12]),
                source=JobSource.GEEKHUNTER,
                title=title,
                company=company,
                description="",
                url=url,
                location=location,
                job_type="On-site",
                salary=None,
                tags=[],
                posted_at=None,
                country="br",
            ))

            if len(jobs) >= limit:
                break

        return jobs

    @staticmethod
    def _company_from_url(url: str) -> str:
        """Extrai nome da empresa do slug na URL: /company-slug/jobs/..."""
        parts = url.rstrip("/").split("/")
        # geekhunter.com.br/{company}/jobs/{slug}
        if len(parts) >= 3 and "jobs" in parts:
            idx = parts.index("jobs") if "jobs" in parts else -1
            if idx >= 1:
                slug = parts[idx - 1]
                return slug.replace("-", " ").replace("_", " ").title()
        return "Empresa não identificada"
