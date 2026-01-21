"""Extractor Agent - Responsible for extracting job data from HTML"""

import hashlib
from typing import Optional, List, Set
from bs4 import BeautifulSoup, Tag

from agents.base_agent import BaseAgent, AgentContext, AgentResult
from models import JobListing, JobSource


class ExtractorAgent(BaseAgent):
    """
    Agent responsible for extracting job listings from HTML.

    Responsibilities:
    - Parse HTML using detected selectors
    - Extract job details (title, company, location, etc.)
    - Normalize and clean extracted data
    - Generate unique job IDs
    """

    name = "extractor"

    # Map source names to JobSource enum
    SOURCE_MAP = {
        "geekhunter": JobSource.GEEKHUNTER,
        "vagascombr": JobSource.VAGASCOMBR,
    }

    # Base URLs for relative link resolution
    BASE_URLS = {
        "geekhunter": "https://www.geekhunter.com.br",
        "vagascombr": "https://www.vagas.com.br",
    }

    def validate_context(self, context: AgentContext) -> Optional[str]:
        """Validate that HTML content and selectors are present"""
        if not context.html_content:
            return "html_content is required for ExtractorAgent"
        if not context.detected_selectors:
            return "detected_selectors is required for ExtractorAgent"
        if not context.detected_selectors.get("job_card"):
            return "job_card selector is required for ExtractorAgent"
        return None

    async def execute(self, context: AgentContext) -> AgentResult:
        """Extract job listings from HTML"""
        soup = BeautifulSoup(context.html_content, "lxml")
        selectors = context.detected_selectors

        # Get job cards
        job_card_selector = selectors.get("job_card")
        job_cards = soup.select(job_card_selector) if job_card_selector else []

        if not job_cards:
            self.logger.warning("No job cards found")
            return AgentResult.success(
                message="No job cards found",
                data={"jobs_count": 0}
            )

        # Extract jobs
        jobs: List[JobListing] = []
        seen_urls: Set[str] = set()

        # Get extra to filter duplicates
        cards_to_process = job_cards[: context.limit * 2]

        for card in cards_to_process:
            try:
                job = self._extract_job(card, context, seen_urls)
                if job:
                    jobs.append(job)
                    seen_urls.add(job.url)

                    if len(jobs) >= context.limit:
                        break

            except Exception as e:
                self.logger.debug(f"Error extracting job: {e}")
                continue

        context.jobs = jobs

        self.logger.info(f"Extracted {len(jobs)} jobs from {len(job_cards)} cards")

        return AgentResult.success(
            message=f"Extracted {len(jobs)} jobs",
            data={
                "jobs_count": len(jobs),
                "cards_found": len(job_cards),
                "duplicates_filtered": len(cards_to_process) - len(jobs),
            }
        )

    def _extract_job(
        self,
        card: Tag,
        context: AgentContext,
        seen_urls: Set[str]
    ) -> Optional[JobListing]:
        """Extract a single job from a card element"""
        selectors = context.detected_selectors
        base_url = self.BASE_URLS.get(context.source, "")

        # Extract URL first (used for deduplication)
        url = self._extract_url(card, selectors.get("link"), base_url)
        if not url or url in seen_urls:
            return None

        # Extract title
        title = self._extract_text(card, selectors.get("title"))
        if not title or len(title) < 5:
            # Try to get title from link text
            link_elem = card if card.name == "a" else card.select_one("a")
            if link_elem:
                title = link_elem.get_text(strip=True)

        if not title or len(title) < 5:
            return None

        # Extract other fields
        company = self._extract_text(card, selectors.get("company")) or "Empresa não identificada"
        location = self._extract_text(card, selectors.get("location")) or "Brasil"
        salary = self._extract_text(card, selectors.get("salary"))
        tags = self._extract_tags(card, selectors.get("tags"))

        # Generate unique ID
        job_id = self._generate_id(context.source, url)

        # Get job source enum
        job_source = self.SOURCE_MAP.get(context.source, JobSource.GEEKHUNTER)

        return JobListing(
            id=job_id,
            source=job_source,
            title=title,
            company=company,
            description="",  # Would need to fetch detail page
            url=url,
            location=location,
            job_type="On-site",  # Default, could be detected
            salary=salary,
            tags=tags,
            posted_at=None,
            country=context.country,
        )

    def _extract_url(self, card: Tag, selector: Optional[str], base_url: str) -> Optional[str]:
        """Extract URL from card"""
        link = None

        # If card is a link
        if card.name == "a":
            link = card
        elif selector:
            link = card.select_one(selector)

        if not link:
            # Try to find any link
            link = card.select_one("a[href]")

        if not link:
            return None

        url = link.get("href", "")
        if not url:
            return None

        # Make absolute URL
        if not url.startswith("http"):
            url = f"{base_url}{url}"

        return url

    def _extract_text(self, card: Tag, selector: Optional[str]) -> Optional[str]:
        """Extract text from element using selector"""
        if not selector:
            return None

        try:
            # Handle multiple selectors (comma-separated)
            for sel in selector.split(","):
                sel = sel.strip()
                elem = card.select_one(sel)
                if elem:
                    text = elem.get_text(strip=True)
                    if text:
                        return text
        except Exception:
            pass

        return None

    def _extract_tags(self, card: Tag, selector: Optional[str]) -> List[str]:
        """Extract tags/skills from card"""
        if not selector:
            return []

        try:
            elements = card.select(selector)
            tags = [elem.get_text(strip=True) for elem in elements]
            # Filter and limit
            return [t for t in tags if t and len(t) < 50][:10]
        except Exception:
            return []

    def _generate_id(self, source: str, url: str) -> str:
        """Generate unique job ID"""
        hash_part = hashlib.md5(url.encode()).hexdigest()[:12]
        return f"{source}-{hash_part}"
