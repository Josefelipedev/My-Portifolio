"""Page Agent - Responsible for navigating and fetching HTML content"""

import os
from datetime import datetime
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser

from agents.base_agent import BaseAgent, AgentContext, AgentResult
from config import config


class PageAgent(BaseAgent):
    """
    Agent responsible for page navigation and HTML retrieval.

    Responsibilities:
    - Navigate to the search URL
    - Wait for JavaScript rendering
    - Capture HTML content
    - Optionally save screenshots for debugging
    """

    name = "page"

    def __init__(self):
        super().__init__()
        self.browser: Optional[Browser] = None

    def validate_context(self, context: AgentContext) -> Optional[str]:
        """Validate that search_url is present"""
        if not context.search_url:
            return "search_url is required for PageAgent"
        return None

    async def execute(self, context: AgentContext) -> AgentResult:
        """Navigate to URL and fetch HTML content"""
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                    ],
                )

                browser_context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    viewport={"width": 1920, "height": 1080},
                    locale="pt-BR",
                )

                page = await browser_context.new_page()

                self.logger.info(f"Navigating to: {context.search_url}")

                # Navigate and wait for content
                await page.goto(
                    context.search_url,
                    wait_until="networkidle",
                    timeout=30000
                )

                # Wait for common job card selectors
                await self._wait_for_content(page, context.source)

                # Get page title
                context.page_title = await page.title()

                # Get rendered HTML
                context.html_content = await page.content()

                self.logger.info(f"Page loaded: {context.page_title}")
                self.logger.info(f"HTML content length: {len(context.html_content)} bytes")

                # Save debug if enabled
                if config.DEBUG_MODE:
                    await self._save_debug(page, context)

                await browser.close()

                return AgentResult.success(
                    message=f"Page loaded successfully ({len(context.html_content)} bytes)",
                    data={
                        "title": context.page_title,
                        "content_length": len(context.html_content),
                    }
                )

        except Exception as e:
            return AgentResult.failed(str(e), "Failed to load page")

    async def _wait_for_content(self, page: Page, source: str):
        """Wait for job content to load based on source"""
        # Source-specific selectors
        selectors_by_source = {
            "geekhunter": [
                '[data-testid="job-card"]',
                '.job-card',
                '.vaga-card',
                'a[href*="/vagas/"]',
            ],
            "vagascombr": [
                '.vaga',
                '.job-listing',
                'a[href*="/vaga/"]',
            ],
        }

        selectors = selectors_by_source.get(source, [])

        for selector in selectors:
            try:
                await page.wait_for_selector(selector, timeout=5000)
                self.logger.info(f"Found content with selector: {selector}")
                return
            except Exception:
                continue

        self.logger.warning("No job cards found with standard selectors")

    async def _save_debug(self, page: Page, context: AgentContext):
        """Save screenshot and HTML for debugging"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"{context.source}_{context.keyword}_{timestamp}"

        try:
            os.makedirs(config.DEBUG_DIR, exist_ok=True)

            # Save screenshot
            screenshot_path = os.path.join(config.DEBUG_DIR, f"{base_name}.png")
            await page.screenshot(path=screenshot_path, full_page=True)
            context.screenshot_path = screenshot_path
            self.logger.info(f"Debug screenshot saved: {screenshot_path}")

            # Save HTML
            html_path = os.path.join(config.DEBUG_DIR, f"{base_name}.html")
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(context.html_content or "")
            self.logger.info(f"Debug HTML saved: {html_path}")

        except Exception as e:
            self.logger.error(f"Failed to save debug files: {e}")
