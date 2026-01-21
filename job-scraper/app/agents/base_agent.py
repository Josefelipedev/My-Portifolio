"""Base agent class for the agent-based scraping architecture"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, List
from enum import Enum
import logging


class AgentStatus(str, Enum):
    """Status of agent execution"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class AgentContext:
    """
    Shared context passed between agents in the pipeline.
    Each agent can read from and write to this context.
    """
    # Input parameters
    keyword: str = ""
    source: str = ""
    country: str = "br"
    limit: int = 50

    # Search Agent outputs
    search_url: Optional[str] = None
    pagination_info: Optional[dict] = None

    # Page Agent outputs
    html_content: Optional[str] = None
    screenshot_path: Optional[str] = None
    page_title: Optional[str] = None

    # Analyzer Agent outputs
    detected_selectors: dict = field(default_factory=dict)
    page_structure: dict = field(default_factory=dict)

    # Extractor Agent outputs
    jobs: List[Any] = field(default_factory=list)

    # Error tracking
    errors: List[str] = field(default_factory=list)

    # Metadata
    metadata: dict = field(default_factory=dict)

    def add_error(self, error: str):
        """Add an error to the context"""
        self.errors.append(error)

    def has_errors(self) -> bool:
        """Check if there are any errors"""
        return len(self.errors) > 0


@dataclass
class AgentResult:
    """Result returned by an agent after execution"""
    status: AgentStatus
    message: str = ""
    data: Optional[dict] = None
    error: Optional[str] = None

    @classmethod
    def success(cls, message: str = "", data: Optional[dict] = None) -> "AgentResult":
        """Create a success result"""
        return cls(status=AgentStatus.SUCCESS, message=message, data=data)

    @classmethod
    def failed(cls, error: str, message: str = "") -> "AgentResult":
        """Create a failed result"""
        return cls(status=AgentStatus.FAILED, message=message, error=error)

    @classmethod
    def skipped(cls, message: str = "") -> "AgentResult":
        """Create a skipped result"""
        return cls(status=AgentStatus.SKIPPED, message=message)


class BaseAgent(ABC):
    """
    Base class for all agents in the scraping pipeline.

    Each agent has a specific responsibility and operates on a shared context.
    Agents can be chained together in a pipeline orchestrated by the Orchestrator.
    """

    name: str = "base"

    def __init__(self):
        self.logger = logging.getLogger(f"agent.{self.name}")

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult:
        """
        Execute the agent's task.

        Args:
            context: Shared context containing input data and previous agent outputs

        Returns:
            AgentResult indicating success or failure
        """
        pass

    def validate_context(self, context: AgentContext) -> Optional[str]:
        """
        Validate that the context has required data for this agent.
        Override in subclasses to add specific validation.

        Returns:
            Error message if validation fails, None if valid
        """
        return None

    async def run(self, context: AgentContext) -> AgentResult:
        """
        Run the agent with validation and error handling.
        """
        self.logger.info(f"Starting {self.name} agent")

        # Validate context
        validation_error = self.validate_context(context)
        if validation_error:
            self.logger.error(f"Validation failed: {validation_error}")
            return AgentResult.failed(validation_error, "Context validation failed")

        try:
            result = await self.execute(context)

            if result.status == AgentStatus.SUCCESS:
                self.logger.info(f"{self.name} agent completed successfully: {result.message}")
            elif result.status == AgentStatus.FAILED:
                self.logger.error(f"{self.name} agent failed: {result.error}")
                context.add_error(f"{self.name}: {result.error}")
            else:
                self.logger.info(f"{self.name} agent skipped: {result.message}")

            return result

        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"{self.name} agent error: {error_msg}")
            context.add_error(f"{self.name}: {error_msg}")
            return AgentResult.failed(error_msg, "Unexpected error")
