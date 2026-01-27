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


# ==========================================
# EduPortugal Models
# ==========================================

class CourseLevel(str, Enum):
    GRADUACAO = "graduacao"
    MESTRADO = "mestrado"
    MESTRADO_INTEGRADO = "mestrado-integrado"
    DOUTORADO = "doutorado"
    POS_DOUTORADO = "pos-doutorado"
    MBA = "mba"
    POS_GRADUACAO = "pos-graduacao"
    CURSO_TECNICO = "curso-tecnico"


class UniversityListing(BaseModel):
    id: str
    name: str
    slug: str
    short_name: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    source_url: str
    city: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    type: Optional[str] = None  # "publica", "privada", "politecnico"


class CourseListing(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    level: str
    area: Optional[str] = None
    sub_area: Optional[str] = None
    duration: Optional[str] = None
    duration_months: Optional[int] = None
    credits: Optional[int] = None
    modality: Optional[str] = None
    schedule: Optional[str] = None
    language: Optional[str] = None
    city: Optional[str] = None
    campus: Optional[str] = None
    start_date: Optional[str] = None
    application_deadline: Optional[str] = None
    price: Optional[str] = None
    source_url: str
    official_url: Optional[str] = None
    application_url: Optional[str] = None
    tags: Optional[str] = None
    university_name: Optional[str] = None
    university_slug: Optional[str] = None


class EduPortugalSearchResponse(BaseModel):
    universities: List[UniversityListing] = []
    courses: List[CourseListing] = []
    total: int
    timestamp: datetime
    errors: List[str] = []


class SyncProgress(BaseModel):
    sync_type: str
    status: str
    current_page: int = 0
    total_pages: int = 0
    current_level: Optional[str] = None
    universities_found: int = 0
    courses_found: int = 0
    errors: List[str] = []
