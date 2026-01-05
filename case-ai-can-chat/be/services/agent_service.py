import logging
from typing import Any, Dict, List

from core.config import settings
from schemas.schemas import ChatMessage, SourceDocument
from services.rag_service import rag_service
from services.web_search_service import web_search_service

logger = logging.getLogger(__name__)


class AgentService:
    """
    Orchestrates different tools (RAG, Web Search) to answer user queries.
    Acts as a conversational agent.
    """

    def __init__(self):
        pass

    async def _decide_tools(
        self, query: str, conversation_history: List[ChatMessage], emit_callback=None
    ) -> List[str]:
        """
        Decides which tools to use based on the query and conversation history.
        For now, a simple heuristic: if query contains "search internet" or "latest news", use web search.
        Otherwise, prioritize RAG.
        """
        # Emit CoT step
        if emit_callback:
            await emit_callback(
                step_type="analyzing",
                label="Analyzing your request",
                description=f"Analyzing query: '{query[:100]}{'...' if len(query) > 100 else ''}'\nEvaluating: • Conversation context • Web search needs • Document retrieval requirements",
                status="active",
            )

        query_lower = query.lower()
        tools = []

        # Heuristic for web search
        web_search_keywords = [
            "search internet",
            "latest news",
            "what's new",
            "current events",
            "real-time",
            "search web",
            "google",
            "online",
        ]

        web_search_triggered = False
        matched_keywords = []

        if settings.ENABLE_WEB_SEARCH:
            for keyword in web_search_keywords:
                if keyword in query_lower:
                    matched_keywords.append(keyword)
                    web_search_triggered = True

            if web_search_triggered:
                tools.append("web_search")

        # Always consider RAG for document-based questions
        tools.append("rag")

        logger.debug(f"Decided to use tools: {tools} for query: '{query}'")

        # Emit completion
        if emit_callback:
            tool_details = []
            if "web_search" in tools:
                keywords_str = ", ".join(matched_keywords[:3])
                tool_details.append(f"Web Search (triggered by: {keywords_str})")
            tool_details.append("Document Retrieval")

            tools_desc = " • ".join(tool_details)
            await emit_callback(
                step_type="analyzing",
                label="Analyzing your request",
                description=f"✓ Selected tools: • {tools_desc}",
                status="complete",
            )

        return tools

    async def _execute_web_search(self, query: str, emit_callback=None) -> str:
        """
        Executes a web search and formats the results as context.
        """
        # Emit CoT step
        if emit_callback:
            await emit_callback(
                step_type="web_search",
                label="Searching the web",
                description=f"🌐 Search query: '{query[:80]}{'...' if len(query) > 80 else ''}', ⚙️ Querying search engine for real-time information...",
                status="active",
            )

        search_results = await web_search_service.search(query)

        if not search_results:
            if emit_callback:
                await emit_callback(
                    step_type="web_search",
                    label="Searching the web",
                    description="⚠️ No web results found. The search returned 0 results. Continuing with document retrieval only.",
                    status="complete",
                )
            return "No relevant web search results found."

        context_parts = ["--- Web Search Results ---"]
        result_summaries = []

        for i, result in enumerate(search_results, 1):
            title = result.get("title", "N/A")
            url = result.get("href", "N/A")

            context_parts.append(f"[{i}] Title: {title}")
            context_parts.append(f"URL: {url}")
            context_parts.append(f"Snippet: {result.get('body', 'N/A')}")
            context_parts.append("-" * 20)

            # For CoT display
            if i <= 3:
                result_summaries.append(f"{i}. {title[:50]}")

        # Emit completion with results
        if emit_callback:
            results_desc = " | ".join(result_summaries)
            more_text = (
                f" + {len(search_results) - 3} more" if len(search_results) > 3 else ""
            )

            await emit_callback(
                step_type="web_search",
                label="Searching the web",
                description=f"✅ Found {len(search_results)} web result(s): {results_desc}{more_text}",
                status="complete",
            )

        return "\n".join(context_parts)

    async def process_query(
        self,
        query: str,
        conversation_history: List[ChatMessage],
        user_id: int,
        conversation_id: int = None,
        emit_callback=None,
    ) -> Dict[str, Any]:
        """
        Main entry point for the agent to process a user query.
        """
        logger.info(f"Agent processing query for user {user_id}: '{query[:100]}...'")

        tools_to_use = await self._decide_tools(
            query, conversation_history, emit_callback=emit_callback
        )

        combined_context = []
        all_sources: List[SourceDocument] = []
        metadata: Dict[str, Any] = {"used_rag": False, "used_web_search": False}

        if "web_search" in tools_to_use:
            web_context = await self._execute_web_search(
                query, emit_callback=emit_callback
            )
            combined_context.append(web_context)
            metadata["used_web_search"] = True

        if "rag" in tools_to_use:
            # RAG service will handle document retrieval and context building
            # Pass conversation_id to RAG service for filtering conversation-specific documents
            rag_result = await rag_service.process_query(
                query=query,
                conversation_history=conversation_history,
                user_id=user_id,
                conversation_id=conversation_id,
                emit_callback=emit_callback,
            )
            combined_context.append(
                rag_result["context"]
            )  # Assuming rag_service returns context
            all_sources.extend(rag_result["sources"])
            metadata["used_rag"] = True
            metadata.update(rag_result["metadata"])  # Merge RAG metadata

        final_context = "\n\n".join(combined_context)
        if not final_context.strip():
            final_context = (
                "No relevant information found from internal documents or web search."
            )

        # Generate final response using the combined context
        response = await rag_service.generate_response(
            query=query,
            context=final_context,
            conversation_history=conversation_history,
            emit_callback=emit_callback,
        )

        return {"response": response, "sources": all_sources, "metadata": metadata}


agent_service = AgentService()
