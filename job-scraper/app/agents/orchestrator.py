"""Agent Orchestrator - Coordinates the agent pipeline"""

import logging
from typing import List, Optional
from datetime import datetime

import httpx

from agents.base_agent import AgentContext, AgentResult, AgentStatus
from agents.search_agent import SearchAgent
from agents.page_agent import PageAgent
from agents.analyzer_agent import AnalyzerAgent
from agents.extractor_agent import ExtractorAgent
from models import JobListing
from config import config


logger = logging.getLogger(__name__)


async def report_execution(result: dict, trigger: str = "manual") -> bool:
    """
    Send execution data to Next.js for tracking.

    Args:
        result: The result from search_with_details()
        trigger: How the execution was triggered (manual, scheduled, alert)

    Returns:
        True if report was sent successfully, False otherwise
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{config.NEXTJS_URL}/api/admin/agent-tracking",
                json={
                    "source": result.get("context", {}).get("source", "unknown"),
                    "keyword": result.get("context", {}).get("keyword", "unknown"),
                    "trigger": trigger,
                    "pipeline": result.get("pipeline", []),
                    "totalDuration": result.get("duration_seconds", 0),
                    "jobsFound": result.get("total", 0),
                }
            )
            if response.status_code == 200:
                logger.info("Execution reported to tracking API")
                return True
            else:
                logger.warning(f"Tracking API returned {response.status_code}: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to report execution: {e}")
        return False


class AgentOrchestrator:
    """
    Orchestrates the agent pipeline for job scraping.

    Pipeline:
    1. SearchAgent - Build search URL
    2. PageAgent - Navigate and fetch HTML
    3. AnalyzerAgent - Detect page structure
    4. ExtractorAgent - Extract job listings
    """

    def __init__(self):
        self.search_agent = SearchAgent()
        self.page_agent = PageAgent()
        self.analyzer_agent = AnalyzerAgent()
        self.extractor_agent = ExtractorAgent()

    async def search(
        self,
        keyword: str,
        source: str,
        country: str = "br",
        limit: int = 50,
        metadata: Optional[dict] = None,
    ) -> tuple[List[JobListing], List[str]]:
        """
        Execute the full scraping pipeline.

        Args:
            keyword: Search keyword
            source: Job source (geekhunter, vagascombr)
            country: Country code
            limit: Maximum number of jobs to return
            metadata: Optional metadata (filters, etc.)

        Returns:
            Tuple of (jobs list, errors list)
        """
        start_time = datetime.now()

        # Initialize context
        context = AgentContext(
            keyword=keyword,
            source=source,
            country=country,
            limit=limit,
            metadata=metadata or {},
        )

        logger.info(f"Starting agent pipeline for '{keyword}' on {source}")

        # Define pipeline
        pipeline = [
            ("search", self.search_agent),
            ("page", self.page_agent),
            ("analyzer", self.analyzer_agent),
            ("extractor", self.extractor_agent),
        ]

        # Execute pipeline
        for name, agent in pipeline:
            logger.info(f"Executing {name} agent...")

            result = await agent.run(context)

            if result.status == AgentStatus.FAILED:
                logger.error(f"Pipeline failed at {name}: {result.error}")
                # Continue to return partial results if possible
                if name in ("search", "page"):
                    # Critical failure - can't continue
                    break

        # Calculate duration
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Pipeline completed in {duration:.2f}s - Found {len(context.jobs)} jobs")

        return context.jobs, context.errors

    async def search_with_details(
        self,
        keyword: str,
        source: str,
        country: str = "br",
        limit: int = 50,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Execute pipeline and return detailed results including debug info.

        Returns:
            Dictionary with jobs, errors, and pipeline details
        """
        start_time = datetime.now()

        context = AgentContext(
            keyword=keyword,
            source=source,
            country=country,
            limit=limit,
            metadata=metadata or {},
        )

        logger.info(f"Starting detailed agent pipeline for '{keyword}' on {source}")

        # Track pipeline stages
        pipeline_results = []

        pipeline = [
            ("search", self.search_agent),
            ("page", self.page_agent),
            ("analyzer", self.analyzer_agent),
            ("extractor", self.extractor_agent),
        ]

        for name, agent in pipeline:
            stage_start = datetime.now()

            result = await agent.run(context)

            stage_duration = (datetime.now() - stage_start).total_seconds()

            pipeline_results.append({
                "agent": name,
                "status": result.status.value,
                "message": result.message,
                "error": result.error,
                "data": result.data,
                "duration_seconds": stage_duration,
            })

            if result.status == AgentStatus.FAILED and name in ("search", "page"):
                break

        total_duration = (datetime.now() - start_time).total_seconds()

        return {
            "jobs": [job.model_dump() for job in context.jobs],
            "total": len(context.jobs),
            "errors": context.errors,
            "pipeline": pipeline_results,
            "context": {
                "keyword": context.keyword,
                "source": context.source,
                "search_url": context.search_url,
                "page_title": context.page_title,
                "detected_selectors": context.detected_selectors,
                "page_structure": context.page_structure,
            },
            "duration_seconds": total_duration,
        }
