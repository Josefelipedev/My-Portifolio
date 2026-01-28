from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from datetime import datetime
from collections import deque
import logging
import time
import os

from models import SearchParams, SearchResponse, JobListing, EduPortugalSearchResponse
from scrapers.geekhunter import GeekHunterScraper
from scrapers.vagas import VagasComBrScraper
from scrapers.eduportugal import EduPortugalScraper, eduportugal_scraper, EDUPORTUGAL_BASE_URL
from scrapers.dges import DGESScraper, dges_scraper, DGES_BASE_URL
from agents.orchestrator import AgentOrchestrator, report_execution
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


@app.get("/config")
async def get_scraper_config():
    """Get current scraper configuration including source URLs."""
    return {
        "sources": {
            "dges": {
                "name": "DGES - Direção-Geral do Ensino Superior",
                "base_url": DGES_BASE_URL,
                "description": "Fonte oficial do governo português",
                "configurable_via": "DGES_BASE_URL",
            },
            "eduportugal": {
                "name": "EduPortugal",
                "base_url": EDUPORTUGAL_BASE_URL,
                "description": "Agregador privado de cursos",
                "configurable_via": "EDUPORTUGAL_BASE_URL",
            },
        },
        "ai": {
            "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "provider": "Together AI",
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


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
):
    """
    Scrape universities from EduPortugal.

    Retorna lista de universidades portuguesas com informacoes de contato,
    localizacao e link para a pagina no eduportugal.
    """
    import json
    import os

    stats["requests_total"] += 1

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


@app.get("/eduportugal/courses")
async def scrape_courses(
    levels: str = Query(default=None, description="Niveis separados por virgula"),
    max_pages: int = Query(default=None, description="Limite de paginas por nivel"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
):
    """
    Scrape courses from EduPortugal.

    Parametros:
    - levels: Niveis de curso separados por virgula (ex: "mestrado,doutorado")
              Se nao especificado, busca todos os niveis.
    - max_pages: Limite de paginas por nivel (util para testes)
    - sync_id: ID para tracking de progresso
    - save_to_file: Salvar automaticamente em /app/data/courses_TIMESTAMP.json

    Retorna lista de cursos com informacoes detalhadas.
    """
    import json
    import os

    stats["requests_total"] += 1

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


@app.get("/dges/courses")
async def scrape_dges_courses(
    regions: str = Query(default=None, description="Códigos de região separados por vírgula"),
    levels: str = Query(default=None, description="Níveis separados por vírgula (licenciatura,mestrado,doutorado)"),
    max_per_institution: int = Query(default=None, description="Limite de cursos por instituição"),
    sync_id: str = Query(default=None, description="ID do sync para tracking"),
    save_to_file: bool = Query(default=True, description="Salvar resultado em arquivo JSON"),
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
