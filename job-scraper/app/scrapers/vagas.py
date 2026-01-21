import hashlib
from datetime import datetime
from typing import List
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import logging

from scrapers.base import BaseScraper
from models import JobListing, JobSource

logger = logging.getLogger(__name__)


class VagasComBrScraper(BaseScraper):
    name = "vagascombr"
    base_url = "https://www.vagas.com.br"

    async def search(self, keyword: str, country: str, limit: int) -> List[JobListing]:
        """Search Vagas.com.br using Playwright"""
        jobs: List[JobListing] = []
        keyword_slug = keyword.replace(" ", "-")
        url = f"{self.base_url}/vagas-de-{keyword_slug}"

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"]
                )

                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    locale="pt-BR",
                )

                page = await context.new_page()

                # Navigate
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Wait for job listings
                try:
                    await page.wait_for_selector(
                        ".link-detalhes-vaga, .vaga", timeout=10000
                    )
                except Exception:
                    logger.warning("No job elements found")

                html = await page.content()
                await browser.close()

                jobs = self._parse_html(html, limit)

        except Exception as e:
            logger.error(f"Vagas.com.br scraping error: {e}")
            raise

        return jobs

    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parse Vagas.com.br HTML"""
        jobs: List[JobListing] = []
        soup = BeautifulSoup(html, "lxml")

        # Find job links
        job_links = soup.select("a.link-detalhes-vaga")

        seen_urls = set()

        for link in job_links[: limit * 2]:
            try:
                url = link.get("href", "")
                title = link.get("title", "") or link.get_text(strip=True)

                if not url or not title or url in seen_urls:
                    continue

                if not url.startswith("http"):
                    url = f"{self.base_url}{url}"

                seen_urls.add(url)

                # Find parent container for more info
                container = link.find_parent("li") or link.find_parent("div")

                company = ""
                location = "Brasil"
                level = ""

                if container:
                    # Extract company
                    company_elem = container.select_one(".emprVaga, .empresa")
                    if company_elem:
                        company = company_elem.get_text(strip=True)

                    # Extract location
                    location_elem = container.select_one(".vaga-local, .local")
                    if location_elem:
                        location = location_elem.get_text(strip=True)

                    # Extract level
                    level_elem = container.select_one(".nivelVaga, .nivel")
                    if level_elem:
                        level = level_elem.get_text(strip=True)

                job_id = self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12])

                jobs.append(
                    JobListing(
                        id=job_id,
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
                )

            except Exception as e:
                logger.debug(f"Error parsing job: {e}")
                continue

        return jobs[:limit]
