from bs4 import BeautifulSoup, Tag
from typing import Optional, List
import re
import logging

logger = logging.getLogger(__name__)


class HTMLParser:
    """HTML parsing utilities"""

    def __init__(self, html: str):
        self.soup = BeautifulSoup(html, "lxml")

    def select_one(self, *selectors: str) -> Optional[Tag]:
        """Try multiple selectors and return the first match"""
        for selector in selectors:
            result = self.soup.select_one(selector)
            if result:
                return result
        return None

    def select(self, *selectors: str) -> List[Tag]:
        """Try multiple selectors and return all matches from the first matching selector"""
        for selector in selectors:
            results = self.soup.select(selector)
            if results:
                return results
        return []

    @staticmethod
    def get_text(element: Optional[Tag], default: str = "") -> str:
        """Safely get text from an element"""
        if element is None:
            return default
        return element.get_text(strip=True) or default

    @staticmethod
    def get_attr(element: Optional[Tag], attr: str, default: str = "") -> str:
        """Safely get an attribute from an element"""
        if element is None:
            return default
        return element.get(attr, default) or default

    @staticmethod
    def clean_text(text: str) -> str:
        """Clean whitespace and normalize text"""
        # Replace multiple whitespace with single space
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    @staticmethod
    def extract_salary(text: str) -> Optional[str]:
        """Extract salary information from text"""
        # Common salary patterns
        patterns = [
            r"R\$[\s]?[\d.,]+",
            r"[\d.,]+\s*(?:k|mil)",
            r"de\s+R\$[\s]?[\d.,]+\s+a\s+R\$[\s]?[\d.,]+",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)
        return None

    @staticmethod
    def extract_location(text: str) -> Optional[str]:
        """Extract location from text"""
        # Common Brazilian location patterns
        # Look for "City - State" or "City/State" patterns
        pattern = r"([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*[-/]\s*([A-Z]{2})"
        match = re.search(pattern, text)
        if match:
            return f"{match.group(1)} - {match.group(2)}"
        return None
