"""Search Agent - Responsible for building search URLs and handling pagination"""

from typing import Optional
from urllib.parse import urlencode, quote_plus

from agents.base_agent import BaseAgent, AgentContext, AgentResult


class SearchAgent(BaseAgent):
    """
    Agent responsible for building search URLs and handling pagination.

    Responsibilities:
    - Build search URLs based on source and parameters
    - Handle source-specific URL patterns
    - Manage pagination information
    """

    name = "search"

    # Source configurations
    SOURCE_CONFIGS = {
        "geekhunter": {
            "base_url": "https://www.geekhunter.com.br",
            "search_path": "/vagas",
            "search_param": "search",
            "supports_filters": True,
        },
        "vagascombr": {
            "base_url": "https://www.vagas.com.br",
            "search_path": "/vagas-de-{keyword}",
            "search_param": None,  # Uses path-based search
            "supports_filters": False,
        },
    }

    def validate_context(self, context: AgentContext) -> Optional[str]:
        """Validate that required parameters are present"""
        if not context.keyword:
            return "keyword is required for SearchAgent"
        if not context.source:
            return "source is required for SearchAgent"
        if context.source not in self.SOURCE_CONFIGS:
            return f"Unknown source: {context.source}. Available: {list(self.SOURCE_CONFIGS.keys())}"
        return None

    async def execute(self, context: AgentContext) -> AgentResult:
        """Build search URL based on source and parameters"""
        source_config = self.SOURCE_CONFIGS[context.source]

        # Build URL based on source
        if context.source == "geekhunter":
            url = self._build_geekhunter_url(context, source_config)
        elif context.source == "vagascombr":
            url = self._build_vagascombr_url(context, source_config)
        else:
            url = self._build_generic_url(context, source_config)

        context.search_url = url

        # Set pagination info
        context.pagination_info = {
            "current_page": 1,
            "has_more": False,  # Will be determined by AnalyzerAgent
            "per_page": context.limit,
        }

        self.logger.info(f"Built search URL: {url}")

        return AgentResult.success(
            message=f"Search URL built for {context.source}",
            data={
                "url": url,
                "source": context.source,
                "keyword": context.keyword,
            }
        )

    def _build_geekhunter_url(self, context: AgentContext, config: dict) -> str:
        """Build GeekHunter search URL"""
        base = config["base_url"] + config["search_path"]

        params = {
            config["search_param"]: context.keyword,
        }

        # Add optional filters from metadata
        if context.metadata.get("remote_only"):
            params["remote"] = "true"

        if context.metadata.get("experience_level"):
            params["experience"] = context.metadata["experience_level"]

        return f"{base}?{urlencode(params)}"

    def _build_vagascombr_url(self, context: AgentContext, config: dict) -> str:
        """Build Vagas.com.br search URL (path-based)"""
        # Vagas.com.br uses path-based search: /vagas-de-python
        keyword_slug = quote_plus(context.keyword.lower().replace(" ", "-"))
        path = config["search_path"].format(keyword=keyword_slug)
        return config["base_url"] + path

    def _build_generic_url(self, context: AgentContext, config: dict) -> str:
        """Build generic search URL"""
        base = config["base_url"] + config["search_path"]
        param = config.get("search_param", "q")
        return f"{base}?{param}={quote_plus(context.keyword)}"
