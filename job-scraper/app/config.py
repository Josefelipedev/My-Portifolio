import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuração da aplicação."""

    # ── Scraper ──────────────────────────────────────────────────────────────
    SCRAPER_TIMEOUT: int = int(os.getenv("SCRAPER_TIMEOUT", "30"))
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", "300"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "3"))
    RETRY_DELAY: float = float(os.getenv("RETRY_DELAY", "2.0"))

    # ── Next.js API (tracking) ───────────────────────────────────────────────
    NEXTJS_URL: str = os.getenv("NEXTJS_URL", "http://localhost:3000")

    # ── Redis ────────────────────────────────────────────────────────────────
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/1")

    # ── Browser (Playwright) ─────────────────────────────────────────────────
    BROWSER_HEADLESS: bool = True
    BROWSER_TIMEOUT: int = 30000  # ms

    # ── Proxy DataImpulse ────────────────────────────────────────────────────
    PROXY_HOST: str = os.getenv("DATAIMPULSE_PROXY_HOST", "")
    PROXY_PORT: str = os.getenv("DATAIMPULSE_PROXY_PORT", "")
    PROXY_USERNAME: str = os.getenv("DATAIMPULSE_USERNAME", "")
    PROXY_PASSWORD: str = os.getenv("DATAIMPULSE_PASSWORD", "")

    @property
    def PROXY_CONFIGURED(self) -> bool:
        return all([
            self.PROXY_HOST,
            self.PROXY_PORT,
            self.PROXY_USERNAME,
            self.PROXY_PASSWORD,
        ])

    @property
    def proxy_url(self) -> str:
        return (
            f"http://{self.PROXY_USERNAME}:{self.PROXY_PASSWORD}"
            f"@{self.PROXY_HOST}:{self.PROXY_PORT}"
        )

    # ── Busca padrão ─────────────────────────────────────────────────────────
    DEFAULT_KEYWORD: str = "desenvolvedor"
    DEFAULT_COUNTRY: str = "br"
    DEFAULT_LIMIT: int = 50
    MAX_LIMIT: int = 100

    # ── Debug ────────────────────────────────────────────────────────────────
    DEBUG_MODE: bool = os.getenv("DEBUG_MODE", "true").lower() == "true"
    DEBUG_DIR: str = os.getenv("DEBUG_DIR", "/app/debug")


config = Config()

if config.DEBUG_MODE:
    os.makedirs(config.DEBUG_DIR, exist_ok=True)
