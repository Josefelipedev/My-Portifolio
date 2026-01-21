from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


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
    job_type: Optional[str] = None  # Remote, Hybrid, On-site
    salary: Optional[str] = None
    tags: List[str] = []
    posted_at: Optional[datetime] = None
    country: Optional[str] = None


class SearchParams(BaseModel):
    keyword: str = "desenvolvedor"
    country: str = "br"
    limit: int = 50
    source: Optional[str] = None  # None = all sources


class SearchResponse(BaseModel):
    jobs: List[JobListing]
    total: int
    source: str
    timestamp: datetime
    errors: List[str] = []
