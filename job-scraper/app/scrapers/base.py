from abc import ABC, abstractmethod
from typing import List
from models import JobListing


class BaseScraper(ABC):
    """Base class for all scrapers"""

    name: str = "base"
    base_url: str = ""

    @abstractmethod
    async def search(self, keyword: str, country: str, limit: int) -> List[JobListing]:
        """Search for jobs - must be implemented by subclasses"""
        pass

    def generate_id(self, unique_part: str) -> str:
        """Generate a unique job ID"""
        return f"{self.name}-{unique_part}"
