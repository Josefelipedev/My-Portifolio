from playwright.async_api import async_playwright, Browser, Page, BrowserContext
from typing import Optional
import logging

from config import config

logger = logging.getLogger(__name__)


class BrowserManager:
    """Manages Playwright browser instances"""

    def __init__(self):
        self._browser: Optional[Browser] = None
        self._playwright = None

    async def get_browser(self) -> Browser:
        """Get or create a browser instance"""
        if self._browser is None or not self._browser.is_connected():
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=config.BROWSER_HEADLESS,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
        return self._browser

    async def create_context(
        self,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        locale: str = "pt-BR",
    ) -> BrowserContext:
        """Create a new browser context"""
        browser = await self.get_browser()
        return await browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1920, "height": 1080},
            locale=locale,
        )

    async def get_page(self, url: str, wait_until: str = "networkidle") -> str:
        """Navigate to a URL and return the rendered HTML"""
        context = await self.create_context()
        page = await context.new_page()

        try:
            await page.goto(url, wait_until=wait_until, timeout=config.BROWSER_TIMEOUT)
            html = await page.content()
            return html
        finally:
            await context.close()

    async def close(self):
        """Close the browser"""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None


# Global browser manager instance
browser_manager = BrowserManager()
