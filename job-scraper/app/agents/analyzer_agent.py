"""Analyzer Agent - Responsible for identifying page structure and selectors"""

from typing import Optional, List, Dict
from bs4 import BeautifulSoup

from agents.base_agent import BaseAgent, AgentContext, AgentResult


class AnalyzerAgent(BaseAgent):
    """
    Agent responsible for analyzing page structure and detecting selectors.

    Responsibilities:
    - Analyze HTML structure
    - Detect job card selectors
    - Identify pagination elements
    - Provide selector hints for ExtractorAgent
    """

    name = "analyzer"

    # Known selectors by source
    KNOWN_SELECTORS = {
        "geekhunter": {
            "job_cards": [
                '[data-testid="job-card"]',
                '.job-card',
                '.vaga-card',
                'a[href*="/vagas/"]',
            ],
            "title": ['h2', 'h3', '.job-title', '[data-testid="job-title"]'],
            "company": ['.company', '.empresa', '[data-testid="company-name"]'],
            "location": ['.location', '.local', '[data-testid="location"]'],
            "salary": ['.salary', '.salario', '[data-testid="salary"]'],
            "tags": ['.tag', '.skill', '.tech-stack span'],
            "link": ['a[href*="/vagas/"]'],
        },
        "vagascombr": {
            "job_cards": [
                '.vaga',
                '.job-listing',
                '.resultado-item',
                'a[href*="/vaga/"]',
            ],
            "title": ['h2', '.titulo', '.vaga-title'],
            "company": ['.empresa', '.company'],
            "location": ['.local', '.location'],
            "salary": ['.salario', '.salary'],
            "tags": ['.tag', '.skill'],
            "link": ['a[href*="/vaga/"]'],
        },
    }

    def validate_context(self, context: AgentContext) -> Optional[str]:
        """Validate that HTML content is present"""
        if not context.html_content:
            return "html_content is required for AnalyzerAgent"
        return None

    async def execute(self, context: AgentContext) -> AgentResult:
        """Analyze page structure and detect selectors"""
        soup = BeautifulSoup(context.html_content, "lxml")

        # Get known selectors for this source
        known = self.KNOWN_SELECTORS.get(context.source, {})

        # Detect job cards
        job_card_selector, job_cards_count = self._detect_job_cards(soup, known.get("job_cards", []))

        if job_cards_count == 0:
            # Try to auto-detect job cards
            job_card_selector, job_cards_count = self._auto_detect_job_cards(soup)

        # Build detected selectors
        detected_selectors = {
            "job_card": job_card_selector,
            "title": self._find_working_selector(soup, known.get("title", []), job_card_selector),
            "company": self._find_working_selector(soup, known.get("company", []), job_card_selector),
            "location": self._find_working_selector(soup, known.get("location", []), job_card_selector),
            "salary": self._find_working_selector(soup, known.get("salary", []), job_card_selector),
            "tags": self._find_working_selector(soup, known.get("tags", []), job_card_selector),
            "link": self._find_working_selector(soup, known.get("link", []), job_card_selector),
        }

        context.detected_selectors = detected_selectors

        # Analyze page structure
        context.page_structure = {
            "job_cards_found": job_cards_count,
            "has_pagination": self._detect_pagination(soup),
            "has_filters": self._detect_filters(soup),
            "page_language": self._detect_language(soup),
        }

        self.logger.info(f"Found {job_cards_count} job cards with selector: {job_card_selector}")
        self.logger.info(f"Detected selectors: {detected_selectors}")

        return AgentResult.success(
            message=f"Analyzed page structure, found {job_cards_count} job cards",
            data={
                "selectors": detected_selectors,
                "structure": context.page_structure,
            }
        )

    def _detect_job_cards(self, soup: BeautifulSoup, selectors: List[str]) -> tuple:
        """Try known selectors and return the one that finds the most cards"""
        best_selector = None
        best_count = 0

        for selector in selectors:
            try:
                cards = soup.select(selector)
                if len(cards) > best_count:
                    best_count = len(cards)
                    best_selector = selector
            except Exception:
                continue

        return best_selector, best_count

    def _auto_detect_job_cards(self, soup: BeautifulSoup) -> tuple:
        """Try to automatically detect job cards based on common patterns"""
        # Common patterns for job cards
        patterns = [
            # Data attributes
            '[data-job]',
            '[data-vaga]',
            '[data-listing]',
            '[data-testid*="job"]',
            '[data-testid*="vaga"]',

            # Class patterns
            '[class*="job-card"]',
            '[class*="vaga"]',
            '[class*="listing"]',
            '[class*="result-item"]',

            # Links to job pages
            'a[href*="/job/"]',
            'a[href*="/vaga/"]',
            'a[href*="/position/"]',
            'a[href*="/oportunidade/"]',

            # Common list items
            'li[class*="job"]',
            'article[class*="job"]',
            'div[class*="job"]',
        ]

        for pattern in patterns:
            try:
                cards = soup.select(pattern)
                if len(cards) >= 3:  # Minimum threshold
                    self.logger.info(f"Auto-detected job cards with: {pattern}")
                    return pattern, len(cards)
            except Exception:
                continue

        return None, 0

    def _find_working_selector(
        self,
        soup: BeautifulSoup,
        selectors: List[str],
        parent_selector: Optional[str]
    ) -> Optional[str]:
        """Find a working selector within job cards"""
        if not parent_selector:
            return selectors[0] if selectors else None

        try:
            # Get first job card
            card = soup.select_one(parent_selector)
            if not card:
                return selectors[0] if selectors else None

            # Try each selector within the card
            for selector in selectors:
                try:
                    element = card.select_one(selector)
                    if element and element.get_text(strip=True):
                        return selector
                except Exception:
                    continue

        except Exception:
            pass

        return selectors[0] if selectors else None

    def _detect_pagination(self, soup: BeautifulSoup) -> bool:
        """Detect if page has pagination"""
        pagination_patterns = [
            '.pagination',
            '.pager',
            '[class*="pagination"]',
            'nav[aria-label*="page"]',
            'nav[aria-label*="paginação"]',
            '.page-numbers',
            'a[href*="page="]',
            'a[href*="pagina="]',
        ]

        for pattern in pagination_patterns:
            try:
                if soup.select_one(pattern):
                    return True
            except Exception:
                continue

        return False

    def _detect_filters(self, soup: BeautifulSoup) -> bool:
        """Detect if page has filter controls"""
        filter_patterns = [
            '[class*="filter"]',
            '[class*="filtro"]',
            'select[name*="filter"]',
            'input[type="checkbox"][name*="filter"]',
            '[data-filter]',
        ]

        for pattern in filter_patterns:
            try:
                if soup.select_one(pattern):
                    return True
            except Exception:
                continue

        return False

    def _detect_language(self, soup: BeautifulSoup) -> str:
        """Detect page language"""
        # Check html lang attribute
        html = soup.find("html")
        if html and html.get("lang"):
            return html["lang"][:2]

        # Check meta tag
        meta = soup.find("meta", attrs={"http-equiv": "content-language"})
        if meta and meta.get("content"):
            return meta["content"][:2]

        return "pt"  # Default to Portuguese
