"""Agent-based scraping architecture"""

from agents.base_agent import BaseAgent, AgentContext, AgentResult
from agents.page_agent import PageAgent
from agents.search_agent import SearchAgent
from agents.analyzer_agent import AnalyzerAgent
from agents.extractor_agent import ExtractorAgent
from agents.orchestrator import AgentOrchestrator

__all__ = [
    "BaseAgent",
    "AgentContext",
    "AgentResult",
    "PageAgent",
    "SearchAgent",
    "AnalyzerAgent",
    "ExtractorAgent",
    "AgentOrchestrator",
]
