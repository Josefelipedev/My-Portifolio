from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from datetime import datetime
from collections import deque
from typing import Optional, List, Dict, Any
import logging
import time
import os

from models import (
    SearchParams, SearchResponse, JobListing, EduPortugalSearchResponse,
    UniversityEnrichment, ManualUploadRequest, ExtractionResponse,
    ContentType, ExtractionMode, HierarchyScrapingResult,
)
from scrapers.geekhunter import GeekHunterScraper
from scrapers.vagas import VagasComBrScraper
from scrapers.eduportugal import EduPortugalScraper, eduportugal_scraper
from scrapers.dges import DGESScraper, dges_scraper
from scrapers.enricher import UniversityEnricher, get_enricher
from scrapers.dges_manual import get_dges_manual_extractor
from agents.orchestrator import AgentOrchestrator, report_execution
from agents.agno_extractor import get_agno_agent
from config import config

# Custom log handler to store logs in memory
class MemoryLogHandler(logging.Handler):
    def __init__(self, max_logs: int = 100):
        super().__init__()
        self.logs = deque(maxlen=max_logs)

    def emit(self, record):
        self.logs.append({
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "source": record.name,
        })

# Setup logging with memory handler
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL))
logger = logging.getLogger(__name__)
memory_handler = MemoryLogHandler(max_logs=200)
memory_handler.setFormatter(logging.Formatter('%(message)s'))
logging.getLogger().addHandler(memory_handler)

# Stats tracking
stats = {
    "requests_total": 0,
    "requests_success": 0,
    "requests_failed": 0,
    "jobs_found": 0,
    "start_time": time.time(),
}

app = FastAPI(
    title="Job Scraper Service",
    description="Python service for scraping Brazilian job sites",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scrapers
scrapers = {
    "geekhunter": GeekHunterScraper(),
    "vagascombr": VagasComBrScraper(),
}

# Initialize agent orchestrator
orchestrator = AgentOrchestrator()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}


@app.get("/search", response_model=SearchResponse)
async def search_jobs(
    keyword: str = Query(default="desenvolvedor"),
    country: str = Query(default="br"),
    limit: int = Query(default=50, le=100),
    source: str = Query(default=None),
):
    """Search for jobs across configured scrapers"""
    stats["requests_total"] += 1
    all_jobs: list[JobListing] = []
    errors: list[str] = []
    has_error = False

    # Select scrapers
    if source and source in scrapers:
        selected_scrapers = {source: scrapers[source]}
    else:
        selected_scrapers = scrapers

    # Run scrapers
    for name, scraper in selected_scrapers.items():
        try:
            logger.info(f"Searching {name} for '{keyword}'")
            jobs = await scraper.search(keyword=keyword, country=country, limit=limit)
            all_jobs.extend(jobs)
            logger.info(f"Found {len(jobs)} jobs from {name}")
        except Exception as e:
            has_error = True
            error_msg = f"{name}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"Error in {name}: {e}")

    # Update stats
    stats["jobs_found"] += len(all_jobs)
    if has_error and len(all_jobs) == 0:
        stats["requests_failed"] += 1
    else:
        stats["requests_success"] += 1

    return SearchResponse(
        jobs=all_jobs[:limit],
        total=len(all_jobs),
        source=source or "all",
        timestamp=datetime.utcnow(),
        errors=errors,
    )


@app.get("/search/{source}", response_model=SearchResponse)
async def search_specific_source(
    source: str,
    keyword: str = Query(default="desenvolvedor"),
    country: str = Query(default="br"),
    limit: int = Query(default=50, le=100),
):
    """Search a specific source"""
    if source not in scrapers:
        raise HTTPException(status_code=404, detail=f"Source '{source}' not found")

    return await search_jobs(keyword=keyword, country=country, limit=limit, source=source)


@app.get("/sources")
async def list_sources():
    """List available scrapers"""
    return {
        "sources": list(scrapers.keys()),
        "total": len(scrapers),
    }


@app.get("/logs")
async def get_logs(
    limit: int = Query(default=50, le=200),
    level: str = Query(default=None),
):
    """Get recent logs"""
    logs = list(memory_handler.logs)

    # Filter by level if specified
    if level:
        level_upper = level.upper()
        logs = [log for log in logs if log["level"] == level_upper]

    # Return most recent first, limited
    return {
        "logs": list(reversed(logs))[:limit],
        "total": len(logs),
    }


@app.delete("/logs")
async def clear_logs():
    """Clear all in-memory logs"""
    count = len(memory_handler.logs)
    memory_handler.logs.clear()
    logger.info(f"Cleared {count} logs")
    return {"cleared": count}


@app.get("/stats")
async def get_stats():
    """Get scraper statistics"""
    uptime = time.time() - stats["start_time"]
    return {
        "requests_total": stats["requests_total"],
        "requests_success": stats["requests_success"],
        "requests_failed": stats["requests_failed"],
        "jobs_found": stats["jobs_found"],
        "uptime_seconds": int(uptime),
        "uptime_human": f"{int(uptime // 3600)}h {int((uptime % 3600) // 60)}m",
    }


@app.get("/debug")
async def list_debug_files():
    """List available debug files (screenshots and HTML)"""
    if not config.DEBUG_MODE:
        return {"enabled": False, "message": "Debug mode is disabled", "files": []}

    if not os.path.exists(config.DEBUG_DIR):
        return {"enabled": True, "files": [], "message": "No debug files yet"}

    files = []
    for filename in os.listdir(config.DEBUG_DIR):
        filepath = os.path.join(config.DEBUG_DIR, filename)
        if os.path.isfile(filepath):
            stat = os.stat(filepath)
            files.append({
                "name": filename,
                "size": stat.st_size,
                "created": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "type": "screenshot" if filename.endswith(".png") else "html",
            })

    # Sort by creation time, newest first
    files.sort(key=lambda x: x["created"], reverse=True)

    return {
        "enabled": True,
        "debug_dir": config.DEBUG_DIR,
        "files": files,
        "total": len(files),
    }


@app.get("/debug/{filename}")
async def get_debug_file(filename: str):
    """Get a specific debug file"""
    if not config.DEBUG_MODE:
        raise HTTPException(status_code=400, detail="Debug mode is disabled")

    # Security: only allow alphanumeric, dash, underscore, dot
    safe_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")
    if not all(c in safe_chars for c in filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = os.path.join(config.DEBUG_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    if filename.endswith(".png"):
        return FileResponse(filepath, media_type="image/png")
    elif filename.endswith(".html"):
        return FileResponse(filepath, media_type="text/html")
    else:
        raise HTTPException(status_code=400, detail="Unknown file type")


@app.delete("/debug")
async def clear_debug_files():
    """Clear all debug files"""
    if not config.DEBUG_MODE:
        raise HTTPException(status_code=400, detail="Debug mode is disabled")

    if not os.path.exists(config.DEBUG_DIR):
        return {"deleted": 0}

    deleted = 0
    for filename in os.listdir(config.DEBUG_DIR):
        filepath = os.path.join(config.DEBUG_DIR, filename)
        if os.path.isfile(filepath):
            os.remove(filepath)
            deleted += 1

    logger.info(f"Cleared {deleted} debug files")
    return {"deleted": deleted}


# ============================================================================
# Agent-based Scraping Endpoints
# ============================================================================


@app.get("/search/agent", response_model=SearchResponse)
async def search_with_agents(
    keyword: str = Query(default="desenvolvedor"),
    source: str = Query(default="geekhunter"),
    country: str = Query(default="br"),
    limit: int = Query(default=50, le=100),
    trigger: str = Query(default="manual"),
):
    """
    Search for jobs using the agent-based architecture.

    Pipeline:
    1. SearchAgent - Builds search URL
    2. PageAgent - Fetches page with Playwright
    3. AnalyzerAgent - Detects page structure
    4. ExtractorAgent - Extracts job listings
    """
    stats["requests_total"] += 1

    if source not in ("geekhunter", "vagascombr"):
        raise HTTPException(
            status_code=400,
            detail=f"Source '{source}' not supported by agent architecture. Use: geekhunter, vagascombr"
        )

    try:
        logger.info(f"Agent search: '{keyword}' on {source}")

        # Use search_with_details to get pipeline info for tracking
        result = await orchestrator.search_with_details(
            keyword=keyword,
            source=source,
            country=country,
            limit=limit,
        )

        jobs = [JobListing(**job) for job in result.get("jobs", [])]
        errors = result.get("errors", [])

        stats["jobs_found"] += len(jobs)

        if errors and len(jobs) == 0:
            stats["requests_failed"] += 1
        else:
            stats["requests_success"] += 1

        # Report execution to tracking API (fire and forget)
        await report_execution(result, trigger=trigger)

        return SearchResponse(
            jobs=jobs,
            total=len(jobs),
            source=source,
            timestamp=datetime.utcnow(),
            errors=errors,
        )

    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"Agent search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search/agent/details")
async def search_with_agents_detailed(
    keyword: str = Query(default="desenvolvedor"),
    source: str = Query(default="geekhunter"),
    country: str = Query(default="br"),
    limit: int = Query(default=50, le=100),
    trigger: str = Query(default="manual"),
):
    """
    Search with agents and return detailed pipeline information.

    Returns job listings plus debug information about each pipeline stage.
    Useful for debugging and understanding how the agents work.
    """
    if source not in ("geekhunter", "vagascombr"):
        raise HTTPException(
            status_code=400,
            detail=f"Source '{source}' not supported by agent architecture"
        )

    try:
        logger.info(f"Agent detailed search: '{keyword}' on {source}")

        result = await orchestrator.search_with_details(
            keyword=keyword,
            source=source,
            country=country,
            limit=limit,
        )

        # Report execution to tracking API (fire and forget)
        await report_execution(result, trigger=trigger)

        return result

    except Exception as e:
        logger.error(f"Agent detailed search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EduPortugal - Universities & Courses Endpoints
# ============================================================================

# Track running syncs
eduportugal_syncs: dict = {}


@app.get("/eduportugal/levels")
async def get_course_levels():
    """List available course levels for EduPortugal."""
    return {
        "levels": list(EduPortugalScraper.COURSE_LEVELS.keys()),
        "urls": EduPortugalScraper.COURSE_LEVELS,
        "descriptions": {
            "licenciatura": "Licenciatura / Graduacao (3-4 anos)",
            "mestrado": "Mestrado (1-2 anos)",
            "mestrado-integrado": "Mestrado Integrado (5-6 anos)",
            "doutorado": "Doutorado / PhD (3-4 anos)",
            "pos-doutorado": "Pos-Doutorado",
            "mba": "MBA - Master of Business Administration",
            "pos-graduacao": "Pos-Graduacao / Especializacao",
            "curso-tecnico": "Curso Tecnico Superior Profissional",
            "b-learning": "B-Learning (Blended Learning)",
            "e-learning": "E-Learning (Online)",
            "formacao-executiva": "Formacao Executiva / MBA",
            "especializacao": "Cursos de Especializacao",
        },
    }


@app.get("/eduportugal/universities")
async def scrape_universities(
    max_pages: int = Query(default=None, description="Limite de paginas"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
    base_url: str = Query(default=None, description="URL base customizada (ex: https://eduportugal.eu)"),
):
    """
    Scrape universities from EduPortugal.

    Retorna lista de universidades portuguesas com informacoes de contato,
    localizacao e link para a pagina no eduportugal.
    """
    import json
    import os

    stats["requests_total"] += 1

    # Apply custom base URL if provided
    original_base_url = eduportugal_scraper.base_url
    if base_url:
        eduportugal_scraper.base_url = base_url.rstrip("/")
        logger.info(f"Using custom base URL: {eduportugal_scraper.base_url}")

    async def progress_callback(progress: dict):
        if sync_id and sync_id in eduportugal_syncs:
            eduportugal_syncs[sync_id].update(progress)

    try:
        logger.info(f"Scraping universities (max_pages={max_pages})")

        universities = await eduportugal_scraper.scrape_universities(
            max_pages=max_pages,
            progress_callback=progress_callback if sync_id else None,
        )

        stats["requests_success"] += 1

        result = {
            "universities": [u.model_dump() for u in universities],
            "total": len(universities),
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Auto-save to file
        if save_to_file and universities:
            os.makedirs("/app/data", exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"/app/data/universities_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(universities)} universities to {filename}")
            result["saved_to_file"] = filename

        return result

    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"EduPortugal universities error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Restore original base URL
        if base_url:
            eduportugal_scraper.base_url = original_base_url


@app.get("/eduportugal/courses")
async def scrape_courses(
    levels: str = Query(default=None, description="Niveis separados por virgula"),
    max_pages: int = Query(default=None, description="Limite de paginas por nivel"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
    base_url: str = Query(default=None, description="URL base customizada (ex: https://eduportugal.eu)"),
):
    """
    Scrape courses from EduPortugal.

    Parametros:
    - levels: Niveis de curso separados por virgula (ex: "mestrado,doutorado")
              Se nao especificado, busca todos os niveis.
    - max_pages: Limite de paginas por nivel (util para testes)
    - sync_id: ID para tracking de progresso
    - save_to_file: Salvar automaticamente em /app/data/courses_TIMESTAMP.json
    - base_url: URL base customizada para o scraper

    Retorna lista de cursos com informacoes detalhadas.
    """
    import json
    import os

    stats["requests_total"] += 1

    # Apply custom base URL if provided
    original_base_url = eduportugal_scraper.base_url
    if base_url:
        eduportugal_scraper.base_url = base_url.rstrip("/")
        logger.info(f"Using custom base URL: {eduportugal_scraper.base_url}")

    levels_list = levels.split(",") if levels else None

    async def progress_callback(progress: dict):
        if sync_id and sync_id in eduportugal_syncs:
            eduportugal_syncs[sync_id].update(progress)

    try:
        logger.info(f"Scraping courses (levels={levels_list}, max_pages={max_pages})")

        courses = await eduportugal_scraper.scrape_courses(
            levels=levels_list,
            max_pages_per_level=max_pages,
            progress_callback=progress_callback if sync_id else None,
        )

        stats["requests_success"] += 1

        # Group by level for stats
        by_level = {}
        for course in courses:
            level = course.level
            by_level[level] = by_level.get(level, 0) + 1

        result = {
            "courses": [c.model_dump() for c in courses],
            "total": len(courses),
            "by_level": by_level,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Auto-save to file
        if save_to_file and courses:
            os.makedirs("/app/data", exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"/app/data/courses_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(courses)} courses to {filename}")
            result["saved_to_file"] = filename

        return result

    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"EduPortugal courses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Restore original base URL
        if base_url:
            eduportugal_scraper.base_url = original_base_url


@app.get("/eduportugal/course/details")
async def get_course_details(
    url: str = Query(..., description="URL do curso no eduportugal"),
):
    """
    Get detailed information about a specific course.

    Busca informacoes adicionais como creditos ECTS, requisitos,
    precos, etc. diretamente da pagina do curso.
    """
    try:
        logger.info(f"Getting course details: {url}")

        details = await eduportugal_scraper.scrape_course_details(url)

        if not details:
            raise HTTPException(status_code=404, detail="Could not fetch course details")

        return {
            "details": details,
            "source_url": url,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Course details error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/eduportugal/hierarchy")
async def scrape_eduportugal_hierarchy(
    max_universities: int = Query(default=None, description="Limite de universidades"),
    max_courses_per_university: int = Query(default=None, description="Limite de cursos por universidade"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
):
    """
    Scraping hierárquico: visita cada página de universidade para extrair cursos.

    Fluxo:
    1. Scrape listagem de universidades
    2. Para cada universidade, visita página individual
    3. Extrai cursos dessa universidade
    4. Retorna hierarquia completa University → Courses
    """
    import json

    stats["requests_total"] += 1

    async def progress_callback(progress: dict):
        if sync_id and sync_id in eduportugal_syncs:
            eduportugal_syncs[sync_id].update(progress)

    try:
        logger.info(f"Starting hierarchical scrape: max_unis={max_universities}")

        result = await eduportugal_scraper.scrape_full_hierarchy(
            max_universities=max_universities,
            max_courses_per_university=max_courses_per_university,
            progress_callback=progress_callback if sync_id else None,
            use_ai=True,
        )

        stats["requests_success"] += 1

        response = {
            "universities": [u.model_dump() for u in result["universities"]],
            "courses": [c.model_dump() for c in result["courses"]],
            "hierarchy": result["hierarchy"],
            "stats": result["stats"],
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Auto-save
        if save_to_file and (result["universities"] or result["courses"]):
            os.makedirs("/app/data", exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"/app/data/eduportugal_hierarchy_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(response, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved hierarchy to {filename}")
            response["saved_to_file"] = filename

        return response

    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"Hierarchy scrape error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/eduportugal/university/{slug}/courses")
async def scrape_university_courses(
    slug: str,
    save_to_file: bool = Query(default=False, description="Salvar resultado"),
):
    """
    Scrape cursos de uma universidade específica.

    Visita a página individual da universidade no EduPortugal
    e extrai todos os cursos listados.
    """
    import json

    stats["requests_total"] += 1

    try:
        # Primeiro buscar a universidade pelo slug
        universities = await eduportugal_scraper.scrape_universities(max_pages=10, use_ai=False)

        university = None
        for uni in universities:
            if uni.slug == slug:
                university = uni
                break

        if not university:
            raise HTTPException(status_code=404, detail=f"Universidade não encontrada: {slug}")

        # Buscar cursos
        courses = await eduportugal_scraper.scrape_university_courses(university)

        stats["requests_success"] += 1

        response = {
            "university": university.model_dump(),
            "courses": [c.model_dump() for c in courses],
            "total_courses": len(courses),
            "timestamp": datetime.utcnow().isoformat(),
        }

        if save_to_file and courses:
            os.makedirs("/app/data", exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"/app/data/university_{slug}_courses_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(response, f, ensure_ascii=False, indent=2)
            response["saved_to_file"] = filename

        return response

    except HTTPException:
        raise
    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"University courses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/eduportugal/sync/start")
async def start_eduportugal_sync(
    sync_type: str = Query(default="full", description="full, universities, ou courses"),
    levels: str = Query(default=None, description="Niveis para sync de cursos"),
):
    """
    Start a sync operation and return sync ID for tracking.

    Tipos de sync:
    - full: Sincroniza universidades e todos os cursos
    - universities: Apenas universidades
    - courses: Apenas cursos (pode filtrar por nivel)
    """
    import uuid
    sync_id = str(uuid.uuid4())

    eduportugal_syncs[sync_id] = {
        "sync_id": sync_id,
        "sync_type": sync_type,
        "status": "started",
        "started_at": datetime.utcnow().isoformat(),
        "current_page": 0,
        "total_pages": 0,
        "universities_found": 0,
        "courses_found": 0,
        "current_level": None,
        "errors": [],
    }

    logger.info(f"Started EduPortugal sync: {sync_id} ({sync_type})")

    return {
        "sync_id": sync_id,
        "status": "started",
        "sync_type": sync_type,
        "message": f"Sync {sync_type} started. Use /eduportugal/sync/{sync_id}/status to track progress.",
    }


@app.get("/eduportugal/sync/{sync_id}/status")
async def get_sync_status(sync_id: str):
    """Get status of a running sync operation."""
    if sync_id not in eduportugal_syncs:
        raise HTTPException(status_code=404, detail="Sync not found")

    return eduportugal_syncs[sync_id]


@app.get("/eduportugal/stats")
async def get_eduportugal_stats():
    """Get EduPortugal scraper statistics."""
    return {
        "available_levels": len(EduPortugalScraper.COURSE_LEVELS),
        "levels": list(EduPortugalScraper.COURSE_LEVELS.keys()),
        "active_syncs": len([s for s in eduportugal_syncs.values() if s.get("status") == "running"]),
        "total_syncs": len(eduportugal_syncs),
        "rate_limit_delay": EduPortugalScraper.RATE_LIMIT_DELAY,
    }


@app.get("/eduportugal/files")
async def list_saved_files():
    """List all saved JSON files from scraping."""
    import os
    import glob

    data_dir = "/app/data"
    if not os.path.exists(data_dir):
        return {"files": [], "message": "No data directory yet"}

    files = []
    for filepath in glob.glob(f"{data_dir}/*.json"):
        stat = os.stat(filepath)
        files.append({
            "filename": os.path.basename(filepath),
            "path": filepath,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / 1024 / 1024, 2),
            "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
        })

    files.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "files": files,
        "total": len(files),
        "data_dir": data_dir,
    }


@app.get("/eduportugal/files/{filename}")
async def get_saved_file(filename: str):
    """Download a specific saved JSON file."""
    import os
    import json
    from fastapi.responses import FileResponse

    filepath = f"/app/data/{filename}"

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    # Security check - prevent path traversal
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    return FileResponse(
        filepath,
        media_type="application/json",
        filename=filename,
    )


@app.delete("/eduportugal/files/{filename}")
async def delete_saved_file(filename: str):
    """Delete a specific saved JSON file."""
    import os

    # Security check - prevent path traversal
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = f"/app/data/{filename}"

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(filepath)
        logger.info(f"Deleted file: {filename}")
        return {"success": True, "deleted": filename}
    except Exception as e:
        logger.error(f"Failed to delete file {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


# ============================================================================
# DGES - Fonte Oficial do Ensino Superior em Portugal
# ============================================================================

# Track running syncs
dges_syncs: dict = {}


@app.get("/dges/regions")
async def get_dges_regions():
    """List available regions for DGES scraping."""
    return {
        "regions": DGESScraper.REGIONS,
        "institution_types": DGESScraper.INSTITUTION_TYPES,
        "source": "Direção-Geral do Ensino Superior (DGES)",
        "website": "https://www.dges.gov.pt",
    }


@app.get("/dges/universities")
async def scrape_dges_universities(
    regions: str = Query(default=None, description="Códigos de região separados por vírgula (ex: 11,13)"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
    base_url: str = Query(default=None, description="URL base customizada (ex: https://www.dges.gov.pt)"),
):
    """
    Scrape universities from DGES (official government source).

    Regiões disponíveis:
    - 11: Lisboa
    - 12: Centro
    - 13: Norte
    - 14: Alentejo
    - 15: Algarve
    - 16: Açores
    - 17: Madeira
    """
    import json
    import os

    stats["requests_total"] += 1

    # Apply custom base URL if provided
    original_base_url = dges_scraper.base_url
    if base_url:
        dges_scraper.base_url = base_url.rstrip("/")
        logger.info(f"Using custom DGES base URL: {dges_scraper.base_url}")

    regions_list = regions.split(",") if regions else None

    async def progress_callback(progress: dict):
        if sync_id and sync_id in dges_syncs:
            dges_syncs[sync_id].update(progress)

    try:
        logger.info(f"DGES: Scraping universities (regions={regions_list})")

        universities = await dges_scraper.scrape_universities(
            regions=regions_list,
            progress_callback=progress_callback if sync_id else None,
        )

        stats["requests_success"] += 1

        result = {
            "universities": [u.model_dump() for u in universities],
            "total": len(universities),
            "source": "DGES",
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Auto-save to file
        if save_to_file and universities:
            os.makedirs("/app/data", exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"/app/data/dges_universities_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(universities)} DGES universities to {filename}")
            result["saved_to_file"] = filename

        return result

    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"DGES universities error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Restore original base URL
        if base_url:
            dges_scraper.base_url = original_base_url


@app.get("/dges/courses")
async def scrape_dges_courses(
    regions: str = Query(default=None, description="Códigos de região separados por vírgula"),
    levels: str = Query(default=None, description="Níveis separados por vírgula (licenciatura,mestrado,doutorado)"),
    max_per_institution: int = Query(default=None, description="Limite de cursos por instituição"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
    base_url: str = Query(default=None, description="URL base customizada (ex: https://www.dges.gov.pt)"),
):
    """
    Scrape courses from DGES (official government source).

    Fonte oficial com dados de:
    - Vagas disponíveis
    - Requisitos de entrada
    - Notas de corte históricas
    - Informações de propinas
    """
    import json
    import os

    stats["requests_total"] += 1

    # Apply custom base URL if provided
    original_base_url = dges_scraper.base_url
    if base_url:
        dges_scraper.base_url = base_url.rstrip("/")
        logger.info(f"Using custom DGES base URL: {dges_scraper.base_url}")

    regions_list = regions.split(",") if regions else None
    levels_list = levels.split(",") if levels else None

    async def progress_callback(progress: dict):
        if sync_id and sync_id in dges_syncs:
            dges_syncs[sync_id].update(progress)

    try:
        logger.info(f"DGES: Scraping courses (regions={regions_list}, levels={levels_list})")

        courses = await dges_scraper.scrape_courses(
            regions=regions_list,
            levels=levels_list,
            max_per_institution=max_per_institution,
            progress_callback=progress_callback if sync_id else None,
        )

        stats["requests_success"] += 1

        # Group by level for stats
        by_level = {}
        for course in courses:
            level = course.level
            by_level[level] = by_level.get(level, 0) + 1

        result = {
            "courses": [c.model_dump() for c in courses],
            "total": len(courses),
            "by_level": by_level,
            "source": "DGES",
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Auto-save to file
        if save_to_file and courses:
            os.makedirs("/app/data", exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"/app/data/dges_courses_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(courses)} DGES courses to {filename}")
            result["saved_to_file"] = filename

        return result

    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"DGES courses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Restore original base URL
        if base_url:
            dges_scraper.base_url = original_base_url


@app.get("/dges/all")
async def scrape_dges_all(
    regions: str = Query(default=None, description="Códigos de região separados por vírgula"),
    max_courses_per_institution: int = Query(default=None, description="Limite de cursos por instituição"),
    fetch_details: bool = Query(default=False, description="Buscar detalhes de cada curso (mais lento)"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
):
    """
    Scrape all universities and courses from DGES.

    Esta é a fonte oficial do governo português para dados de ensino superior.
    Retorna dados mais completos e confiáveis que o EduPortugal.
    """
    import json
    import os

    stats["requests_total"] += 1

    regions_list = regions.split(",") if regions else None

    async def progress_callback(progress: dict):
        if sync_id and sync_id in dges_syncs:
            dges_syncs[sync_id].update(progress)

    try:
        logger.info(f"DGES: Full scrape (regions={regions_list})")

        result_data = await dges_scraper.scrape_all(
            regions=regions_list,
            max_courses_per_institution=max_courses_per_institution,
            fetch_details=fetch_details,
            progress_callback=progress_callback if sync_id else None,
        )

        stats["requests_success"] += 1

        # Group courses by level
        by_level = {}
        for course in result_data["courses"]:
            level = course.level
            by_level[level] = by_level.get(level, 0) + 1

        result = {
            "universities": [u.model_dump() for u in result_data["universities"]],
            "courses": [c.model_dump() for c in result_data["courses"]],
            "total_universities": len(result_data["universities"]),
            "total_courses": len(result_data["courses"]),
            "courses_by_level": by_level,
            "source": "DGES",
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Auto-save to file
        if save_to_file:
            os.makedirs("/app/data", exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"/app/data/dges_full_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved DGES data to {filename}")
            result["saved_to_file"] = filename

        return result

    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"DGES full scrape error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dges/course/details")
async def get_dges_course_details(
    url: str = Query(..., description="URL do curso na DGES"),
):
    """
    Get detailed information about a specific course from DGES.

    Retorna informações detalhadas incluindo:
    - Créditos ECTS
    - Duração
    - Vagas
    - Requisitos de entrada
    - Provas de ingresso
    - Contatos da instituição
    """
    try:
        logger.info(f"DGES: Getting course details: {url}")

        details = await dges_scraper.fetch_course_details(url)

        if not details:
            raise HTTPException(status_code=404, detail="Could not fetch course details")

        return {
            "details": details,
            "source_url": url,
            "source": "DGES",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DGES course details error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dges/stats")
async def get_dges_stats():
    """Get DGES scraper statistics."""
    return {
        "available_regions": len(DGESScraper.REGIONS),
        "regions": DGESScraper.REGIONS,
        "institution_types": list(DGESScraper.INSTITUTION_TYPES.values()),
        "active_syncs": len([s for s in dges_syncs.values() if s.get("status") == "running"]),
        "total_syncs": len(dges_syncs),
        "rate_limit_delay": DGESScraper.RATE_LIMIT_DELAY,
        "source": "Direção-Geral do Ensino Superior",
    }


@app.post("/dges/extract")
async def dges_manual_extract(
    content_type: str = Query(..., description="Tipo: text, html, ou url"),
    content: str = Query(..., description="Conteúdo para extrair"),
    extraction_mode: str = Query(default="mixed", description="Modo: universities, courses, ou mixed"),
    region: str = Query(default=None, description="Hint de região"),
):
    """
    Upload manual de dados DGES com extração inteligente.

    Aceita:
    - text: Texto bruto (descrições de cursos, conteúdo copiado)
    - html: HTML de páginas salvas
    - url: URL para buscar e extrair

    Retorna dados extraídos + comparação com banco para evitar duplicatas.

    Exemplo:
    ```
    POST /dges/extract?content_type=text&content=Universidade de Lisboa...
    ```
    """
    from models import ManualUploadRequest, ContentType as CT, ExtractionMode as EM

    stats["requests_total"] += 1

    try:
        # Converter para enums
        try:
            ct = CT(content_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"content_type inválido: {content_type}. Use: text, html, url")

        try:
            em = EM(extraction_mode)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"extraction_mode inválido: {extraction_mode}. Use: universities, courses, mixed")

        # Criar request
        request = ManualUploadRequest(
            content_type=ct,
            content=content,
            extraction_mode=em,
            region=region,
        )

        # Processar extração
        extractor = get_dges_manual_extractor()
        result = await extractor.extract(request)

        stats["requests_success"] += 1

        return result.model_dump()

    except HTTPException:
        raise
    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"DGES manual extract error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dges/extract/stats")
async def get_dges_extract_stats():
    """
    Estatísticas do extractor manual DGES.

    Inclui informações sobre uso de tokens e modelo Agno.
    """
    agno = get_agno_agent()
    return {
        "agno_stats": agno.get_stats(),
        "description": "Estatísticas de extração manual via Agno",
    }


# Modelo para JSON body
from pydantic import BaseModel as PydanticBaseModel

class DGESManualUploadBody(PydanticBaseModel):
    """Body para upload manual DGES com conteúdos grandes."""
    content_type: str  # "text", "html", "url"
    content: str  # O conteúdo a extrair
    extraction_mode: str = "mixed"  # "universities", "courses", "mixed"
    region: Optional[str] = None  # Hint de região


@app.post("/dges/manual/extract")
async def dges_manual_extract_json(body: DGESManualUploadBody):
    """
    Upload manual de dados DGES com JSON body (para conteúdos grandes).

    Endpoint preferido para uploads de HTML ou texto extenso.

    Body:
    ```json
    {
        "content_type": "html",
        "content": "<html>...</html>",
        "extraction_mode": "mixed",
        "region": "Lisboa"
    }
    ```

    Retorna:
    - extracted: {universities: [...], courses: [...]}
    - comparison: {new: [...], existing: [...], updated: [...]}
    - stats: {tokens_used, model_used, extraction_time_ms}
    """
    from models import ManualUploadRequest, ContentType as CT, ExtractionMode as EM

    stats["requests_total"] += 1

    try:
        # Converter para enums
        try:
            ct = CT(body.content_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"content_type inválido: {body.content_type}. Use: text, html, url"
            )

        try:
            em = EM(body.extraction_mode)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"extraction_mode inválido: {body.extraction_mode}. Use: universities, courses, mixed"
            )

        # Criar request
        request = ManualUploadRequest(
            content_type=ct,
            content=body.content,
            extraction_mode=em,
            region=body.region,
        )

        # Processar extração
        extractor = get_dges_manual_extractor()
        result = await extractor.extract(request)

        stats["requests_success"] += 1

        return result.model_dump()

    except HTTPException:
        raise
    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"DGES manual extract (JSON) error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EduPortugal - Manual Upload / Extraction
# ============================================================================


class EduPortugalManualUploadBody(PydanticBaseModel):
    """Body para upload manual EduPortugal com conteúdos grandes."""
    content_type: str  # "text", "html", "url"
    content: str  # O conteúdo a extrair
    extraction_mode: str = "mixed"  # "universities", "courses", "mixed"
    region: Optional[str] = None  # Hint de região


@app.post("/eduportugal/manual/extract")
async def eduportugal_manual_extract_json(body: EduPortugalManualUploadBody):
    """
    Upload manual de dados EduPortugal com JSON body (para conteúdos grandes).

    Endpoint para extrair dados de universidades e cursos a partir de conteúdo
    copiado do site EduPortugal ou outros portais de educação em Portugal.

    Body:
    ```json
    {
        "content_type": "html",
        "content": "<html>...</html>",
        "extraction_mode": "mixed",
        "region": "Lisboa"
    }
    ```

    Retorna:
    - extracted: {universities: [...], courses: [...]}
    - comparison: {new: [...], existing: [...], updated: [...]}
    - stats: {tokens_used, model_used, extraction_time_ms}
    """
    from models import ManualUploadRequest, ContentType as CT, ExtractionMode as EM

    stats["requests_total"] += 1

    try:
        # Converter para enums
        try:
            ct = CT(body.content_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"content_type inválido: {body.content_type}. Use: text, html, url"
            )

        try:
            em = EM(body.extraction_mode)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"extraction_mode inválido: {body.extraction_mode}. Use: universities, courses, mixed"
            )

        # Criar request
        request = ManualUploadRequest(
            content_type=ct,
            content=body.content,
            extraction_mode=em,
            region=body.region,
        )

        # Processar extração usando o mesmo extractor (Agno é source-agnostic)
        extractor = get_dges_manual_extractor()
        result = await extractor.extract(request)

        # Atualizar source nos dados extraídos para "eduportugal"
        if result.extracted:
            for uni in result.extracted.get("universities", []):
                if "id" in uni:
                    uni["id"] = uni["id"].replace("dges-", "eduportugal-")
            for course in result.extracted.get("courses", []):
                if "id" in course:
                    course["id"] = course["id"].replace("dges-", "eduportugal-")

        stats["requests_success"] += 1

        return result.model_dump()

    except HTTPException:
        raise
    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"EduPortugal manual extract (JSON) error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Unified Manual Extract - Supports both DGES and EduPortugal
# ============================================================================


class UnifiedManualUploadBody(PydanticBaseModel):
    """Body para upload manual unificado."""
    content_type: str  # "text", "html", "url"
    content: str  # O conteúdo a extrair
    extraction_mode: str = "mixed"  # "universities", "courses", "mixed"
    source: str = "auto"  # "dges", "eduportugal", "auto"
    region: Optional[str] = None  # Hint de região


@app.post("/manual/extract")
async def unified_manual_extract(body: UnifiedManualUploadBody):
    """
    Endpoint unificado para upload manual de dados de educação.

    Suporta extração de dados de:
    - DGES (fonte oficial do governo português)
    - EduPortugal (portal privado de educação)
    - Outras fontes (modo auto detecta automaticamente)

    Body:
    ```json
    {
        "content_type": "html",
        "content": "<html>...</html>",
        "extraction_mode": "mixed",
        "source": "auto",
        "region": "Lisboa"
    }
    ```

    O parâmetro "source" define a fonte:
    - "dges": Dados da Direção-Geral do Ensino Superior
    - "eduportugal": Dados do portal EduPortugal
    - "auto": Detecta automaticamente a fonte (padrão)

    Retorna:
    - extracted: {universities: [...], courses: [...]}
    - comparison: {new: [...], existing: [...], updated: [...]}
    - stats: {tokens_used, model_used, extraction_time_ms, detected_source}
    """
    from models import ManualUploadRequest, ContentType as CT, ExtractionMode as EM

    stats["requests_total"] += 1

    try:
        # Converter para enums
        try:
            ct = CT(body.content_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"content_type inválido: {body.content_type}. Use: text, html, url"
            )

        try:
            em = EM(body.extraction_mode)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"extraction_mode inválido: {body.extraction_mode}. Use: universities, courses, mixed"
            )

        # Validar source
        valid_sources = ["dges", "eduportugal", "auto"]
        if body.source not in valid_sources:
            raise HTTPException(
                status_code=400,
                detail=f"source inválido: {body.source}. Use: {', '.join(valid_sources)}"
            )

        # Auto-detectar fonte se necessário
        detected_source = body.source
        if body.source == "auto":
            content_lower = body.content.lower()
            if "dges.gov.pt" in content_lower or "direcao-geral" in content_lower:
                detected_source = "dges"
            elif "eduportugal" in content_lower:
                detected_source = "eduportugal"
            else:
                # Padrão para DGES se não conseguir detectar
                detected_source = "dges"

        # Criar request
        request = ManualUploadRequest(
            content_type=ct,
            content=body.content,
            extraction_mode=em,
            region=body.region,
        )

        # Processar extração
        extractor = get_dges_manual_extractor()
        result = await extractor.extract(request)

        # Atualizar source nos dados extraídos
        if result.extracted and detected_source != "dges":
            for uni in result.extracted.get("universities", []):
                if "id" in uni:
                    uni["id"] = uni["id"].replace("dges-", f"{detected_source}-")
            for course in result.extracted.get("courses", []):
                if "id" in course:
                    course["id"] = course["id"].replace("dges-", f"{detected_source}-")

        stats["requests_success"] += 1

        result_dict = result.model_dump()
        result_dict["stats"]["detected_source"] = detected_source

        return result_dict

    except HTTPException:
        raise
    except Exception as e:
        stats["requests_failed"] += 1
        logger.error(f"Unified manual extract error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# University Enricher - Extração inteligente de dados extras
# ============================================================================

@app.post("/enrich/university")
async def enrich_university(
    website_url: str = Query(..., description="URL do site oficial da universidade"),
    force: bool = Query(default=False, description="Ignorar cache e forçar nova extração"),
):
    """
    Enriquece dados de uma universidade a partir do seu site oficial.

    Estratégia de economia de tokens:
    1. HTML parsing primeiro (0 tokens)
    2. Micro-prompt AI apenas se necessário (~500 tokens)

    Extrai:
    - Logo URL
    - Redes sociais (Instagram, LinkedIn, Facebook, Twitter, YouTube)
    - Email e telefone de contacto
    """
    enricher = get_enricher()

    try:
        result = await enricher.enrich(website_url, force=force)
        return {
            "success": True,
            "data": result.model_dump(),
            "stats": enricher.get_stats(),
        }
    except Exception as e:
        logger.error(f"Enrich error for {website_url}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/enrich/batch")
async def enrich_universities_batch(
    universities: list = Query(..., description="Lista de universidades com 'id' e 'website'"),
    max_concurrent: int = Query(default=3, description="Máximo de requisições simultâneas"),
    delay_seconds: float = Query(default=1.0, description="Delay entre batches"),
):
    """
    Enriquece um lote de universidades com rate limiting.

    Exemplo de entrada:
    [
        {"id": "uni-1", "website": "https://www.ipmaia.pt"},
        {"id": "uni-2", "website": "https://www.umaia.pt"}
    ]
    """
    enricher = get_enricher()

    try:
        results = await enricher.enrich_batch(
            universities=universities,
            max_concurrent=max_concurrent,
            delay_seconds=delay_seconds,
        )
        return {
            "success": True,
            "results": results,
            "total": len(results),
            "stats": enricher.get_stats(),
        }
    except Exception as e:
        logger.error(f"Batch enrich error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/enrich/stats")
async def get_enricher_stats():
    """
    Retorna estatísticas do enricher.

    Inclui:
    - Total enriquecido
    - Quantos usaram apenas HTML (0 tokens)
    - Quantos precisaram de AI
    - Total de tokens usados
    - Cache hits
    """
    enricher = get_enricher()
    return enricher.get_stats()


@app.post("/enrich/search")
async def enrich_with_search(
    university_name: str = Query(..., description="Nome da universidade"),
    website_url: str = Query(default=None, description="URL do site (opcional, buscará se não fornecido)"),
    force: bool = Query(default=False, description="Ignorar cache"),
):
    """
    Enriquece dados de universidade, buscando o website oficial se não fornecido.

    Fluxo:
    1. Se website_url não fornecido, busca via DuckDuckGo
    2. Visita o site encontrado
    3. Extrai logo, redes sociais, contatos

    Útil quando você tem apenas o nome da universidade mas não o website.

    Exemplo:
    ```
    POST /enrich/search?university_name=IPMAIA
    ```
    """
    enricher = get_enricher()

    try:
        result = await enricher.enrich_with_search(
            university_name=university_name,
            website_url=website_url,
            force=force,
        )

        return {
            "success": result.error is None,
            "university_name": university_name,
            "website_searched": website_url is None,
            "data": result.model_dump(),
            "stats": enricher.get_stats(),
        }

    except Exception as e:
        logger.error(f"Enrich with search error for {university_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/enrich/batch/search")
async def enrich_batch_with_search(
    universities: List[Dict[str, Any]],
    delay_seconds: float = Query(default=2.0, description="Delay entre requisições (rate limiting)"),
):
    """
    Enriquece lote de universidades, buscando websites quando necessário.

    Para cada universidade:
    - Se tem 'website': usa diretamente
    - Se não tem: busca via DuckDuckGo primeiro

    Rate limiting mais conservador para evitar bloqueios de busca.

    Body (JSON):
    ```json
    [
        {"id": "uni-1", "name": "IPMAIA"},
        {"id": "uni-2", "name": "Universidade do Porto", "website": "https://up.pt"}
    ]
    ```
    """
    import asyncio
    enricher = get_enricher()
    results = []

    for uni in universities:
        try:
            name = uni.get('name', '')
            website = uni.get('website')

            result = await enricher.enrich_with_search(
                university_name=name,
                website_url=website,
                force=False,
            )

            results.append({
                **uni,
                'enrichment': result.model_dump(),
                'enrichment_error': result.error,
            })

        except Exception as e:
            results.append({
                **uni,
                'enrichment': None,
                'enrichment_error': str(e),
            })

        # Rate limiting
        await asyncio.sleep(delay_seconds)

    return {
        "success": True,
        "results": results,
        "total": len(results),
        "enriched": len([r for r in results if r.get('enrichment_error') is None]),
        "failed": len([r for r in results if r.get('enrichment_error') is not None]),
        "stats": enricher.get_stats(),
    }
