from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Job Search Models ────────────────────────────────────────────────────────

class JobSource(str, Enum):
    GEEKHUNTER = "geekhunter"
    VAGASCOMBR = "vagascombr"
    LINKEDIN = "linkedin"


class JobListing(BaseModel):
    id: str
    source: JobSource
    title: str
    company: str
    company_logo: Optional[str] = None
    description: str
    url: str
    location: Optional[str] = None
    job_type: Optional[str] = None   # Remote, Hybrid, On-site
    salary: Optional[str] = None
    tags: List[str] = []
    posted_at: Optional[datetime] = None
    country: Optional[str] = None


class SearchParams(BaseModel):
    keyword: str = "desenvolvedor"
    country: str = "br"
    limit: int = 50
    source: Optional[str] = None   # None = todas as fontes


class SearchResponse(BaseModel):
    jobs: List[JobListing]
    total: int
    source: str
    timestamp: datetime
    errors: List[str] = []


# ── Web Scraping Models (migrado do clawlite) ────────────────────────────────

class ScrapeRequest(BaseModel):
    url: str
    format: str = "markdown"   # "markdown" | "text" | "html"
    use_proxy: bool = False
    include_links: bool = False


class ScrapeResponse(BaseModel):
    url: str
    title: str
    content_markdown: str
    word_count: int
    links: List[str] = []
    status: str   # "success" | "error"
    error: Optional[str] = None


class CrawlRequest(BaseModel):
    start_url: str
    max_pages: int = 10
    depth: int = 2
    use_proxy: bool = False
    delay: float = 1.0


class CrawlResponse(BaseModel):
    start_url: str
    pages_crawled: int
    pages: List[ScrapeResponse]
    status: str


class ExtractRequest(BaseModel):
    url: str
    fields: List[str] = []   # campos específicos (uso futuro)
    use_proxy: bool = False


class SummarizeRequest(BaseModel):
    url: str
    use_proxy: bool = False
    max_length: int = 500
