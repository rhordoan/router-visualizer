import logging
from typing import List, Dict, Any, Optional
from duckduckgo_search import AsyncDDGS
from core.config import settings

logger = logging.getLogger(__name__)


class WebSearchService:
    """
    Service for performing web searches using DuckDuckGo.
    Includes basic caching to avoid redundant searches.
    """

    def __init__(self):
        self.cache: Dict[str, List[Dict[str, Any]]] = {}
        self.max_results = settings.WEB_SEARCH_MAX_RESULTS
        self.region = settings.WEB_SEARCH_REGION
        logger.info(
            f"WebSearchService initialized with max_results={self.max_results}, region={self.region}"
        )

    async def search(
        self, query: str, num_results: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Performs a web search using DuckDuckGo.

        Args:
            query: The search query string.
            num_results: Optional number of results to return. Defaults to settings.WEB_SEARCH_MAX_RESULTS.

        Returns:
            A list of dictionaries, each representing a search result with 'title', 'href', and 'body'.
        """
        if not settings.ENABLE_WEB_SEARCH:
            logger.info("Web search is disabled by configuration.")
            return []

        effective_num_results = (
            num_results if num_results is not None else self.max_results
        )

        if query in self.cache:
            logger.debug(f"Returning cached search results for query: {query}")
            return self.cache[query][:effective_num_results]

        logger.info(
            f"Performing web search for query: '{query}' with {effective_num_results} results"
        )
        try:
            results = []
            async with AsyncDDGS() as ddgs:
                ddgs_results = ddgs.text(
                    keywords=query,
                    region=self.region,
                    max_results=effective_num_results,
                )
                async for r in ddgs_results:
                    results.append(
                        {
                            "title": r.get("title"),
                            "href": r.get("href"),
                            "body": r.get("body"),
                        }
                    )

            self.cache[query] = results  # Cache all retrieved results
            logger.info(f"Found {len(results)} web search results for '{query}'")
            return results
        except Exception as e:
            logger.error(
                f"Error during web search for '{query}': {str(e)}", exc_info=True
            )
            return []

    def clear_cache(self):
        """Clears the search cache."""
        self.cache = {}
        logger.info("Web search cache cleared.")


web_search_service = WebSearchService()
