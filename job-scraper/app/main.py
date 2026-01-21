from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from datetime import datetime
from collections import deque
import logging
import time
import os

from models import SearchParams, SearchResponse, JobListing
from scrapers.geekhunter import GeekHunterScraper
from scrapers.vagas import VagasComBrScraper
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
