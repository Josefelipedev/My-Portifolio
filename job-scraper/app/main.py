from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging

from models import SearchParams, SearchResponse, JobListing
from scrapers.geekhunter import GeekHunterScraper
from scrapers.vagas import VagasComBrScraper
from config import config

logging.basicConfig(level=getattr(logging, config.LOG_LEVEL))
logger = logging.getLogger(__name__)

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
    all_jobs: list[JobListing] = []
    errors: list[str] = []

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
            error_msg = f"{name}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"Error in {name}: {e}")

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
