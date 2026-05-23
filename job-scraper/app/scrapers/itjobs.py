"""
ITJobs.pt Scraper — Vagas de TI em Portugal

Estratégia dual:
1. API oficial (api.itjobs.pt) se ITJOBS_API_KEY estiver configurada
2. HTML scraping com BeautifulSoup como fallback

ITJobs não é SPA — HTTP simples é suficiente (sem Playwright).
"""

import hashlib
import logging
import os
import re
from typing import List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from models import JobListing, JobSource
from utils.http_client import fetch_html, fetch_json
from security.robots import can_fetch

logger = logging.getLogger(__name__)

BASE_URL = "https://www.itjobs.pt"
API_BASE = "https://api.itjobs.pt"
ITJOBS_API_KEY = os.getenv("ITJOBS_API_KEY", "")

# Padrão de URL de vaga: /oferta/ID/slug
JOB_URL_RE = re.compile(r"/oferta/\d+/[^/?#\s\"']+")


class ITJobsScraper(BaseScraper):
    """Scraper para ITJobs.pt — principal plataforma de TI em Portugal."""

    name = "itjobs"
    base_url = BASE_URL

    async def search(
        self,
        keyword: str,
        country: str = "pt",
        limit: int = 50,
    ) -> List[JobListing]:
        """
        Busca vagas no ITJobs.pt.

        Tenta API oficial primeiro (se chave configurada),
        depois fallback para HTML scraping.
        """
        # Verificar robots.txt
        search_url = f"{BASE_URL}/pesquisa/?q={keyword}"
        if not await can_fetch(search_url):
            logger.warning("[itjobs] robots.txt não permite scraping de %s", search_url)
            return []

        # Estratégia 1: API oficial
        if ITJOBS_API_KEY:
            logger.info("[itjobs] Usando API oficial")
            jobs = await self._search_via_api(keyword, limit)
            if jobs:
                return jobs
            logger.warning("[itjobs] API falhou, tentando HTML scraping")

        # Estratégia 2: HTML scraping
        logger.info("[itjobs] Usando HTML scraping")
        return await self._search_via_html(keyword, limit)

    # ── Estratégia 1: API oficial ────────────────────────────────────────────

    async def _search_via_api(self, keyword: str, limit: int) -> List[JobListing]:
        """Busca via api.itjobs.pt/job/list.json"""
        try:
            data = await fetch_json(
                f"{API_BASE}/job/list.json",
                params={
                    "api_key": ITJOBS_API_KEY,
                    "q": keyword,
                    "limit": min(limit, 50),
                    "page": 1,
                },
                extra_headers={"Referer": BASE_URL},
            )

            if not data or "results" not in data:
                return []

            jobs = []
            for item in data["results"][:limit]:
                job = self._parse_api_item(item)
                if job:
                    jobs.append(job)

            logger.info("[itjobs] API: %d vagas encontradas", len(jobs))
            return jobs

        except Exception as e:
            logger.error("[itjobs] API error: %s", e)
            return []

    def _parse_api_item(self, item: dict) -> Optional[JobListing]:
        """Parseia um item da resposta da API."""
        try:
            job_id = str(item.get("id", ""))
            title = item.get("title", "").strip()
            if not title or not job_id:
                return None

            slug = item.get("slug", title.lower().replace(" ", "-"))
            url = f"{BASE_URL}/oferta/{job_id}/{slug}"

            company_data = item.get("company") or {}
            company = company_data.get("name", "").strip() or "Empresa não identificada"
            company_logo = (company_data.get("logo") or {}).get("url")

            locations = item.get("locations") or []
            location = ", ".join(loc.get("name", "") for loc in locations if loc.get("name")) or "Portugal"

            salary_min = item.get("wageMin")
            salary_max = item.get("wageMax")
            salary = None
            if salary_min and salary_max:
                salary = f"€{salary_min:,.0f} – €{salary_max:,.0f}"
            elif salary_min:
                salary = f"€{salary_min:,.0f}+"

            tags = [t.get("name", "") for t in (item.get("technologies") or []) if t.get("name")]

            job_type_raw = (item.get("contractTypes") or [{}])[0].get("name", "")
            job_type = self._map_job_type(job_type_raw)

            published = item.get("publishedAt") or item.get("updatedAt")
            from datetime import datetime
            posted_at = None
            if published:
                try:
                    posted_at = datetime.fromisoformat(published.replace("Z", "+00:00"))
                except Exception:
                    pass

            return JobListing(
                id=self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12]),
                source=JobSource.ITJOBS,
                title=title,
                company=company,
                company_logo=company_logo,
                description=item.get("body", ""),
                url=url,
                location=location,
                job_type=job_type,
                salary=salary,
                tags=tags[:10],
                posted_at=posted_at,
                country="pt",
            )
        except Exception as e:
            logger.debug("[itjobs] Erro ao parsear item API: %s", e)
            return None

    # ── Estratégia 2: HTML scraping ──────────────────────────────────────────

    async def _search_via_html(self, keyword: str, limit: int) -> List[JobListing]:
        """Scraping da página de pesquisa do ITJobs.pt"""
        try:
            html = await fetch_html(
                f"{BASE_URL}/pesquisa/",
                params={"q": keyword},
                extra_headers={"Referer": BASE_URL},
            )

            if not html:
                logger.warning("[itjobs] HTML scraping: resposta vazia")
                return []

            jobs = self._parse_html(html, limit)
            logger.info("[itjobs] HTML scraping: %d vagas encontradas", len(jobs))
            return jobs

        except Exception as e:
            logger.error("[itjobs] HTML scraping error: %s", e)
            return []

    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parseia a listagem de vagas do ITJobs.pt com BeautifulSoup."""
        soup = BeautifulSoup(html, "lxml")
        jobs: List[JobListing] = []
        seen_urls: set[str] = set()

        # Estratégia 1: cards com estrutura semântica
        # ITJobs usa <article> ou <li> com links /oferta/
        for card in soup.select("article, li.job, .job-listing, [class*='job-item']"):
            job = self._parse_card(card, seen_urls)
            if job:
                jobs.append(job)
                if len(jobs) >= limit:
                    return jobs

        # Estratégia 2: fallback — todos os links /oferta/
        if len(jobs) < 3:
            logger.debug("[itjobs] Poucos resultados via cards, usando fallback por links")
            jobs.extend(self._parse_links(soup, seen_urls, limit - len(jobs)))

        return jobs[:limit]

    def _parse_card(self, card, seen_urls: set) -> Optional[JobListing]:
        """Parseia um card individual de vaga."""
        # Link da vaga
        link = card.select_one(f'a[href*="/oferta/"]')
        if not link:
            return None

        href = link.get("href", "")
        url = href if href.startswith("http") else f"{BASE_URL}{href}"

        if url in seen_urls or not JOB_URL_RE.search(href):
            return None
        seen_urls.add(url)

        # Título
        title = (
            link.get_text(strip=True)
            or card.select_one("h2, h3, .job-title, [class*='title']") and
               card.select_one("h2, h3, .job-title, [class*='title']").get_text(strip=True)
            or ""
        )
        if not title or len(title) < 3:
            return None

        # Empresa
        company_el = card.select_one('a[href*="/empresa/"], .company, [class*="company"]')
        company = company_el.get_text(strip=True) if company_el else ""

        # Logo
        logo_el = card.select_one("img[src*='logo'], img[alt]")
        logo = logo_el.get("src") if logo_el else None
        if logo and logo.startswith("//"):
            logo = "https:" + logo

        # Localização
        location_el = card.select_one(
            ".location, [class*='location'], [class*='local'], "
            "span[title], [data-location]"
        )
        location = location_el.get_text(strip=True) if location_el else "Portugal"

        # Salário
        salary_el = card.select_one("[class*='salary'], [class*='wage'], [class*='salario']")
        salary = salary_el.get_text(strip=True) if salary_el else None
        if salary and "€" not in salary and not any(c.isdigit() for c in salary):
            salary = None

        # Tags / tecnologias
        tags = [t.get_text(strip=True) for t in card.select(".tag, .tech, .skill, [class*='tech']")][:10]

        # Data
        date_el = card.select_one("time[datetime], [class*='date'], [class*='published']")
        posted_at = None
        if date_el:
            dt_str = date_el.get("datetime") or date_el.get_text(strip=True)
            try:
                from datetime import datetime
                posted_at = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            except Exception:
                pass

        return JobListing(
            id=self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12]),
            source=JobSource.ITJOBS,
            title=title,
            company=company or "Empresa não identificada",
            company_logo=logo,
            description="",
            url=url,
            location=location,
            job_type="On-site",
            salary=salary,
            tags=tags,
            posted_at=posted_at,
            country="pt",
        )

    def _parse_links(self, soup: BeautifulSoup, seen_urls: set, limit: int) -> List[JobListing]:
        """Fallback: extrai vagas diretamente dos links /oferta/."""
        jobs: List[JobListing] = []

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not JOB_URL_RE.search(href):
                continue

            url = href if href.startswith("http") else f"{BASE_URL}{href}"
            if url in seen_urls:
                continue
            seen_urls.add(url)

            title = a.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Empresa do container pai
            container = a.find_parent("li") or a.find_parent("article") or a.find_parent("div")
            company = ""
            location = "Portugal"
            if container:
                comp_el = container.select_one('a[href*="/empresa/"]')
                company = comp_el.get_text(strip=True) if comp_el else ""
                loc_el = container.select_one(".location, [class*='location']")
                location = loc_el.get_text(strip=True) if loc_el else "Portugal"

            jobs.append(JobListing(
                id=self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12]),
                source=JobSource.ITJOBS,
                title=title,
                company=company or "Empresa não identificada",
                description="",
                url=url,
                location=location,
                job_type="On-site",
                salary=None,
                tags=[],
                posted_at=None,
                country="pt",
            ))

            if len(jobs) >= limit:
                break

        return jobs

    @staticmethod
    def _map_job_type(raw: str) -> str:
        raw = raw.lower()
        if "remoto" in raw or "remote" in raw:
            return "Remote"
        if "híbrido" in raw or "hybrid" in raw:
            return "Hybrid"
        return "On-site"
