from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal, Union
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
    LICENCIATURA = "licenciatura"
    MESTRADO = "mestrado"
    MESTRADO_INTEGRADO = "mestrado-integrado"
    DOUTORADO = "doutorado"
    POS_DOUTORADO = "pos-doutorado"
    MBA = "mba"
    POS_GRADUACAO = "pos-graduacao"
    CURSO_TECNICO = "curso-tecnico"
    B_LEARNING = "b-learning"
    E_LEARNING = "e-learning"
    FORMACAO_EXECUTIVA = "formacao-executiva"
    ESPECIALIZACAO = "especializacao"


class UniversityListing(BaseModel):
    id: str
    name: str
    slug: str
    short_name: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    source_url: str
    individual_page_url: Optional[str] = None  # URL da página individual no EduPortugal
    city: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    type: Optional[str] = None  # "publica", "privada", "politecnico"
    # Redes sociais (preenchidas pelo enricher)
    instagram_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    facebook_url: Optional[str] = None
    twitter_url: Optional[str] = None
    youtube_url: Optional[str] = None


class UniversityEnrichment(BaseModel):
    """Dados extraídos do site oficial da universidade."""
    logo_url: Optional[str] = None
    instagram_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    facebook_url: Optional[str] = None
    twitter_url: Optional[str] = None
    youtube_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    # Metadados do enriquecimento
    tokens_used: int = 0
    ai_used: bool = False
    error: Optional[str] = None


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


# ==========================================
# DGES Manual Upload Models
# ==========================================

class ContentType(str, Enum):
    """Tipo de conteúdo para upload manual."""
    TEXT = "text"
    HTML = "html"
    URL = "url"


class ExtractionMode(str, Enum):
    """Modo de extração."""
    UNIVERSITIES = "universities"
    COURSES = "courses"
    MIXED = "mixed"


class ManualUploadRequest(BaseModel):
    """Request para upload manual de dados DGES."""
    content_type: ContentType
    content: str  # Texto bruto, HTML, ou URL
    extraction_mode: ExtractionMode = ExtractionMode.MIXED
    region: Optional[str] = None  # Hint para extração


class ComparisonStatus(str, Enum):
    """Status de comparação com dados existentes."""
    NEW = "new"
    EXISTING = "existing"
    UPDATED = "updated"


class ComparisonResult(BaseModel):
    """Resultado da comparação de um item."""
    id: str
    external_id: Optional[str] = None
    name: str
    status: ComparisonStatus
    changes: Optional[Dict[str, Any]] = None  # Campos alterados se UPDATED


class ExtractionResponse(BaseModel):
    """Resposta da extração manual."""
    extracted: Dict[str, List[Any]]  # {universities: [...], courses: [...]}
    comparison: Dict[str, List[ComparisonResult]]  # {new: [...], existing: [...], updated: [...]}
    stats: Dict[str, Any]  # {tokens_used, extraction_method, duration_ms}


# ==========================================
# Agno Extraction Models
# ==========================================

class UniversityExtractionSchema(BaseModel):
    """Schema para extração de universidade via Agno."""
    code: str = Field(description="Código da instituição (4 dígitos)")
    name: str = Field(description="Nome completo da instituição")
    url: Optional[str] = Field(default=None, description="URL da página da instituição (extraída do HTML)")
    type: Literal[
        "publica_universitario",
        "publica_politecnico",
        "privada_universitario",
        "privada_politecnico",
        "outro"
    ] = Field(default="outro", description="Tipo de instituição")
    region: Optional[str] = Field(default=None, description="Região geográfica")
    city: Optional[str] = Field(default=None, description="Cidade")
    website: Optional[str] = Field(default=None, description="Site oficial")


class CourseExtractionSchema(BaseModel):
    """Schema para extração de curso via Agno."""
    code: str = Field(description="Código do curso")
    name: str = Field(description="Nome do curso")
    url: Optional[str] = Field(default=None, description="URL da página do curso (extraída do HTML)")
    level: Literal[
        "licenciatura",
        "mestrado",
        "doutorado",
        "mestrado-integrado",
        "curso-tecnico",
        "pos-graduacao",
        "mba",
        "outro"
    ] = Field(default="outro", description="Nível académico")
    university_code: Optional[str] = Field(default=None, description="Código da instituição")
    university_name: Optional[str] = Field(default=None, description="Nome da instituição")
    duration: Optional[str] = Field(default=None, description="Duração do curso")


class AgnoExtractionResult(BaseModel):
    """Resultado da extração via Agno."""
    universities: List[UniversityExtractionSchema] = []
    courses: List[CourseExtractionSchema] = []
    tokens_used: int = 0
    model_used: str = ""
    extraction_time_ms: int = 0


# ==========================================
# Hierarchy Scraping Models
# ==========================================

class HierarchyScrapingResult(BaseModel):
    """Resultado do scraping hierárquico."""
    universities: List[UniversityListing] = []
    courses: List[CourseListing] = []
    hierarchy: Dict[str, List[str]] = {}  # university_id -> [course_ids]
    stats: Dict[str, Any] = {}  # {total_universities, total_courses, duration_ms}
