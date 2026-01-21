import asyncio
import hashlib
import os
from datetime import datetime
from typing import List
from playwright.async_api import async_playwright, Page
from bs4 import BeautifulSoup
import logging

from scrapers.base import BaseScraper
from models import JobListing, JobSource
from config import config

logger = logging.getLogger(__name__)


class GeekHunterScraper(BaseScraper):
    name = "geekhunter"
    base_url = "https://www.geekhunter.com.br"

    async def _save_debug(self, page: Page, html: str, keyword: str):
        """Save screenshot and HTML for debugging"""
        if not config.DEBUG_MODE:
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"geekhunter_{keyword}_{timestamp}"

        try:
            # Save screenshot
            screenshot_path = os.path.join(config.DEBUG_DIR, f"{base_name}.png")
            await page.screenshot(path=screenshot_path, full_page=True)
            logger.info(f"Debug screenshot saved: {screenshot_path}")

            # Save HTML
            html_path = os.path.join(config.DEBUG_DIR, f"{base_name}.html")
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(html)
            logger.info(f"Debug HTML saved: {html_path}")

        except Exception as e:
            logger.error(f"Failed to save debug files: {e}")

    async def search(self, keyword: str, country: str, limit: int) -> List[JobListing]:
        """Search GeekHunter using Playwright for JS rendering"""
        jobs: List[JobListing] = []
        url = f"{self.base_url}/vagas?search={keyword}"

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                    ],
                )

                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    viewport={"width": 1920, "height": 1080},
                    locale="pt-BR",
                )

                page = await context.new_page()

                # Navigate and wait for content
                await page.goto(url, wait_until="networkidle", timeout=30000)

                # Wait for job cards to load
                try:
                    await page.wait_for_selector(
                        '[data-testid="job-card"], .job-card, .vaga-card', timeout=10000
                    )
                except Exception:
                    logger.warning(
                        "No job cards found with standard selectors, trying alternatives"
                    )

                # Get rendered HTML
                html = await page.content()

                # Parse HTML
                jobs = self._parse_html(html, limit)

                # Save debug if no jobs found
                if len(jobs) == 0:
                    logger.warning(f"No jobs found for '{keyword}', saving debug files")
                    await self._save_debug(page, html, keyword)

                await browser.close()

        except Exception as e:
            logger.error(f"GeekHunter scraping error: {e}")
            raise

        return jobs

    def _parse_html(self, html: str, limit: int) -> List[JobListing]:
        """Parse GeekHunter HTML to extract jobs"""
        jobs: List[JobListing] = []
        soup = BeautifulSoup(html, "lxml")

        # Try multiple selectors for job cards
        job_cards = (
            soup.select('[data-testid="job-card"]')
            or soup.select(".job-card")
            or soup.select(".vaga-card")
            or soup.select('a[href*="/vagas/"]')
        )

        seen_urls = set()

        for card in job_cards[: limit * 2]:  # Get extra to filter duplicates
            try:
                # Extract URL
                link = card if card.name == "a" else card.select_one('a[href*="/vagas/"]')
                if not link:
                    continue

                url = link.get("href", "")
                if not url or url in seen_urls:
                    continue

                if not url.startswith("http"):
                    url = f"{self.base_url}{url}"

                seen_urls.add(url)

                # Extract title
                title_elem = card.select_one(
                    'h2, h3, .job-title, [data-testid="job-title"]'
                )
                title = (
                    title_elem.get_text(strip=True)
                    if title_elem
                    else link.get_text(strip=True)
                )

                if not title or len(title) < 5:
                    continue

                # Extract company
                company_elem = card.select_one(
                    '.company, .empresa, [data-testid="company-name"]'
                )
                company = company_elem.get_text(strip=True) if company_elem else ""

                # Extract location
                location_elem = card.select_one(
                    '.location, .local, [data-testid="location"]'
                )
                location = (
                    location_elem.get_text(strip=True) if location_elem else "Brasil"
                )

                # Extract salary
                salary_elem = card.select_one(
                    '.salary, .salario, [data-testid="salary"]'
                )
                salary = salary_elem.get_text(strip=True) if salary_elem else None

                # Extract tags
                tag_elems = card.select(".tag, .skill, .tech-stack span")
                tags = [t.get_text(strip=True) for t in tag_elems][:10]

                # Generate unique ID
                job_id = self.generate_id(hashlib.md5(url.encode()).hexdigest()[:12])

                jobs.append(
                    JobListing(
                        id=job_id,
                        source=JobSource.GEEKHUNTER,
                        title=title,
                        company=company or "Empresa não identificada",
                        description="",  # Would need to fetch detail page
                        url=url,
                        location=location,
                        job_type="On-site",
                        salary=salary,
                        tags=tags,
                        posted_at=None,
                        country="br",
                    )
                )

            except Exception as e:
                logger.debug(f"Error parsing job card: {e}")
                continue

        return jobs[:limit]
