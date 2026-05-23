"""
Vagas.com.br Scraper — Busca vagas no Vagas.com.br

Site com conteúdo dinâmico que requer Playwright.
Parser melhorado com base no clawlite: extrai logo, descrição,
nível de senioridade, data e limpa prefixos numéricos do título.
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

BASE_URL = "https://www.vagas.com.br"

# Remove prefixo numérico tipo "11189 - " do título
_TITLE_PREFIX_RE = re.compile(r"^\d+\s*[-–]\s*")


class VagasComBrScraper(HybridScraper):
    """Scraper para Vagas.com.br"""

    name = "vagascombr"
    base_url = BASE_URL

    # Vagas.com.br precisa de JS
    REQUIRES_JS = True
    WAIT_FOR_SELECTOR = "a.link-detalhes-vaga, li.vaga"

    def build_search_url(self, keyword: str, country: str) -> str:
        keyword_slug = re.sub(r"\s+", "-", keyword.strip().lower())
        return f"{self.base_url}/vagas-de-{keyword_slug}"

    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parse Vagas.com.br HTML para extrair vagas."""
        soup = BeautifulSoup(html, "lxml")
        jobs: List[JobListing] = []

        # Estratégia 1: <li class="vaga"> (mais completo)
        for li in soup.select("li.vaga")[: limit * 2]:
            try:
                job = self._parse_li(li)
                if job:
                    jobs.append(job)
                    if len(jobs) >= limit:
                        break
            except Exception as e:
                logger.debug(f"Erro ao parsear li.vaga: {e}")

        # Estratégia 2: fallback via links diretos
        if len(jobs) < 3:
            logger.info(f"[vagascombr] Poucos resultados via li ({len(jobs)}), usando fallback por links")
            seen_urls: Set[str] = {j.url for j in jobs}
            for link in soup.select("a.link-detalhes-vaga")[: limit * 2]:
                try:
                    job = self._parse_link(link, seen_urls)
                    if job:
                        jobs.append(job)
                        if len(jobs) >= limit:
                            break
                except Exception as e:
                    logger.debug(f"Erro ao parsear link: {e}")

        return jobs[:limit]

    # ── Parser principal: li.vaga ────────────────────────────────────────────

    def _parse_li(self, li: Tag) -> Optional[JobListing]:
        # Título e URL
        link = li.select_one("a.link-detalhes-vaga")
        if not link:
            return None

        title = link.get_text(separator=" ", strip=True)
        title = _TITLE_PREFIX_RE.sub("", title).strip()
        title = re.sub(r"\s+", " ", title)
        if not title:
            return None

        href = link.get("href", "")
        url = urljoin(BASE_URL, href) if href else BASE_URL

        # Empresa
        company_el = li.select_one("span.emprVaga")
        company = company_el.get_text(strip=True) if company_el else "Empresa confidencial"

        # Logo da empresa
        logo_el = li.select_one("figure.logoEmpresa img")
        logo = logo_el.get("src") if logo_el else None

        # Nível / senioridade
        level_el = li.select_one("span.nivelVaga")
        level = level_el.get_text(strip=True) if level_el else ""

        # Localização
        location_el = li.select_one("span.vaga-local")
        location = location_el.get_text(strip=True) if location_el else "Brasil"

        # Descrição
        desc_el = li.select_one("div.detalhes p")
        description = desc_el.get_text(strip=True) if desc_el else ""

        # Data de publicação
        date_el = li.select_one("span.data-publicacao")
        posted_at_str = date_el.get_text(strip=True) if date_el else None

        tags = [level] if level else []

        return JobListing(
            id=self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12]),
            source=JobSource.VAGASCOMBR,
            title=title,
            company=company,
            company_logo=logo,
            description=description,
            url=url,
            location=location,
            job_type="On-site",
            salary=None,
            tags=tags,
            posted_at=None,  # posted_at_str é texto relativo, não datetime
            country="br",
        )

    # ── Parser fallback: a.link-detalhes-vaga ───────────────────────────────

    def _parse_link(self, link: Tag, seen_urls: Set[str]) -> Optional[JobListing]:
        href = link.get("href", "")
        if not href:
            return None

        url = urljoin(BASE_URL, href)
        if url in seen_urls:
            return None
        seen_urls.add(url)

        title = link.get("title", "") or link.get_text(strip=True)
        title = _TITLE_PREFIX_RE.sub("", title).strip()
        if not title:
            return None

        # Tentar extrair empresa e localização do container pai
        container = link.find_parent("li") or link.find_parent("div")
        company = ""
        location = "Brasil"

        if container:
            company_el = container.select_one(".emprVaga, .empresa")
            company = company_el.get_text(strip=True) if company_el else ""
            location_el = container.select_one(".vaga-local, .local")
            location = location_el.get_text(strip=True) if location_el else "Brasil"
            level_el = container.select_one(".nivelVaga, .nivel")
            level = level_el.get_text(strip=True) if level_el else ""
        else:
            level = ""

        return JobListing(
            id=self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12]),
            source=JobSource.VAGASCOMBR,
            title=title,
            company=company or "Empresa confidencial",
            description=f"Nível: {level}" if level else "",
            url=url,
            location=location,
            job_type="On-site",
            salary=None,
            tags=[level] if level else [],
            posted_at=None,
            country="br",
        )
