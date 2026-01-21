# Job Scraper Service

Python-based job scraping service using Playwright for JavaScript-heavy websites.

## Overview

This service solves the problem of scraping job listings from sites that:
- Use Single Page Application (SPA) frameworks (React, Vue, etc.)
- Have JavaScript-rendered content
- May have anti-bot protection

## Supported Sources

| Source | Description |
|--------|-------------|
| **GeekHunter** | Brazilian tech job board (SPA with React) |
| **Vagas.com.br** | Major Brazilian job site |

## Quick Start

```bash
# Build the Docker image
docker-compose build

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f job-scraper

# Stop the service
docker-compose down
```

## API Endpoints

### Health Check
```bash
curl http://localhost:8000/health
```

### List Available Sources
```bash
curl http://localhost:8000/sources
```

### Search All Sources
```bash
curl "http://localhost:8000/search?keyword=desenvolvedor&limit=50"
```

### Search Specific Source
```bash
curl "http://localhost:8000/search/geekhunter?keyword=python&limit=20"
curl "http://localhost:8000/search/vagascombr?keyword=react&limit=20"
```

## Configuration

Environment variables (set in `docker-compose.yml`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_TIMEOUT` | 30 | Request timeout in seconds |
| `CACHE_TTL` | 300 | Cache time-to-live in seconds |
| `LOG_LEVEL` | INFO | Logging level |
| `REDIS_URL` | redis://localhost:6379/1 | Redis URL for caching |

## Integration with Next.js

The service integrates with the portfolio's Next.js app automatically when `PYTHON_SCRAPER_URL` is set.

Add to your `.env`:
```
PYTHON_SCRAPER_URL=http://localhost:8000
```

The aggregator will:
1. Check if Python scraper is available on startup
2. Use Python scraper for GeekHunter and Vagas.com.br if available
3. Fall back to JavaScript-based scrapers if service is down

## Development

### Project Structure

```
job-scraper/
├── docker-compose.yml     # Docker orchestration
├── Dockerfile             # Container build config
├── requirements.txt       # Python dependencies
├── app/
│   ├── main.py           # FastAPI entry point
│   ├── config.py         # Configuration
│   ├── models.py         # Pydantic models
│   ├── scrapers/
│   │   ├── base.py       # Base scraper class
│   │   ├── geekhunter.py # GeekHunter scraper
│   │   └── vagas.py      # Vagas.com.br scraper
│   ├── utils/
│   │   ├── browser.py    # Playwright setup
│   │   ├── parser.py     # HTML parsing helpers
│   │   └── cache.py      # Caching utilities
│   └── tests/
│       └── test_scrapers.py
└── README.md
```

### Running Tests

```bash
# Inside container
docker-compose exec job-scraper pytest tests/

# Or locally with Python
cd app && pytest tests/
```

### Adding a New Scraper

1. Create `app/scrapers/newsite.py`:
```python
from scrapers.base import BaseScraper
from models import JobListing, JobSource

class NewSiteScraper(BaseScraper):
    name = "newsite"
    base_url = "https://newsite.com"

    async def search(self, keyword: str, country: str, limit: int) -> list[JobListing]:
        # Implementation here
        pass
```

2. Register in `app/main.py`:
```python
from scrapers.newsite import NewSiteScraper

scrapers = {
    # ... existing scrapers
    "newsite": NewSiteScraper(),
}
```

3. Update `app/models.py`:
```python
class JobSource(str, Enum):
    # ... existing sources
    NEWSITE = "newsite"
```

## Troubleshooting

### Container won't start
- Check if port 8000 is available: `lsof -i :8000`
- Verify Docker is running: `docker info`

### No jobs returned
- Check logs: `docker-compose logs job-scraper`
- Verify the target site hasn't changed its HTML structure
- Try increasing timeout: `SCRAPER_TIMEOUT=60`

### Playwright browser errors
- Ensure the container has enough memory (at least 1GB)
- Chromium requires certain system dependencies (handled by Dockerfile)
