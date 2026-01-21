import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration"""

    # Scraper settings
    SCRAPER_TIMEOUT: int = int(os.getenv("SCRAPER_TIMEOUT", "30"))
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", "300"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Redis settings
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/1")

    # Browser settings
    BROWSER_HEADLESS: bool = True
    BROWSER_TIMEOUT: int = 30000  # 30 seconds

    # Default search params
    DEFAULT_KEYWORD: str = "desenvolvedor"
    DEFAULT_COUNTRY: str = "br"
    DEFAULT_LIMIT: int = 50
    MAX_LIMIT: int = 100


config = Config()
