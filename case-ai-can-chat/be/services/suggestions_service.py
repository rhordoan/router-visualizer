import logging
from typing import Callable, List, Optional

from schemas.schemas import ChatMessage

logger = logging.getLogger(__name__)


class SuggestionsService:
    """
    Service for generating follow-up suggestions based on conversation history
    """

    def __init__(self):
        self.llm_service = None
        self._initialize_llm()

    def _initialize_llm(self):
        """Initialize LLM service for suggestions generation"""
        try:
            from services.nemo_llm_service import nemo_llm_service

            self.llm_service = nemo_llm_service
            logger.info("Suggestions service initialized with Nemotron LLM")
        except Exception as e:
            logger.error(f"Failed to initialize LLM for suggestions: {str(e)}")

    async def generate_suggestions(
        self,
        conversation_history: List[ChatMessage],
        emit_callback: Optional[Callable] = None,
    ) -> List[str]:
        """
        Generate follow-up suggestions based on conversation history

        Args:
            conversation_history: Recent conversation messages
            emit_callback: Optional callback to emit CoT steps

        Returns:
            List of suggestion strings (3-6 suggestions)
        """
        try:
            # Emit CoT step
            if emit_callback:
                await emit_callback(
                    step_type="suggestions",
                    label="Generating follow-up suggestions",
                    description="Analyzing conversation to suggest relevant questions",
                    status="active",
                )

            if not self.llm_service:
                logger.warning("LLM service not available for suggestions")
                if emit_callback:
                    await emit_callback(
                        step_type="suggestions",
                        label="Generating follow-up suggestions",
                        status="complete",
                    )
                return self._get_default_suggestions()

            # Take last 5-10 messages for context
            recent_messages = (
                conversation_history[-10:]
                if len(conversation_history) > 10
                else conversation_history
            )

            # Build conversation context
            context_parts = []
            for msg in recent_messages:
                # Handle both ChatMessage objects and dicts
                if isinstance(msg, dict):
                    role = msg.get("role", "user").capitalize()
                    content = msg.get("content", "")[:200]
                else:
                    role = msg.role.capitalize()
                    content = msg.content[:200]  # Truncate long messages
                context_parts.append(f"{role}: {content}")

            conversation_context = "\n".join(context_parts)

            # Create prompt for suggestions generation
            prompt = f"""Based on this conversation about healthcare services:

{conversation_context}

Generate 4 relevant follow-up questions that the user might want to ask next. The questions should:
- Be directly related to the current conversation topic
- Help the user explore related healthcare services or get more details
- Be concise and clear
- Be natural conversation continuations

Return ONLY the questions, one per line, without numbering or bullet points."""

            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful assistant that generates relevant follow-up questions.",
                },
                {"role": "user", "content": prompt},
            ]

            # Generate suggestions
            logger.info("Generating suggestions with Nemotron")
            response = await self.llm_service.generate(
                messages, temperature=0.8, max_tokens=300
            )

            # Parse response into list of suggestions
            suggestions = self._parse_suggestions(response)

            if emit_callback:
                await emit_callback(
                    step_type="suggestions",
                    label="Generating follow-up suggestions",
                    description=f"✓ Generated {len(suggestions)} suggestions",
                    status="complete",
                )

            logger.info(f"Generated {len(suggestions)} suggestions")
            return suggestions

        except Exception as e:
            logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)
            if emit_callback:
                await emit_callback(
                    step_type="suggestions",
                    label="Generating follow-up suggestions",
                    status="error",
                )
            return self._get_default_suggestions()

    def _parse_suggestions(self, response: str) -> List[str]:
        """
        Parse LLM response into list of suggestions

        Args:
            response: Raw LLM response

        Returns:
            List of suggestion strings
        """
        # Split by newlines and clean up
        lines = response.strip().split("\n")
        suggestions = []

        for line in lines:
            # Clean up line
            line = line.strip()

            # Remove numbering if present (1. 2. etc)
            if line and line[0].isdigit() and "." in line[:3]:
                line = line.split(".", 1)[1].strip()

            # Remove bullet points
            if line.startswith(("- ", "• ", "* ")):
                line = line[2:].strip()

            # Add if valid
            if line and len(line) > 10:  # Minimum length check
                suggestions.append(line)

        # Return 3-6 suggestions
        if len(suggestions) > 6:
            suggestions = suggestions[:6]
        elif len(suggestions) < 3:
            # Pad with defaults if needed
            defaults = self._get_default_suggestions()
            suggestions.extend(defaults[: 3 - len(suggestions)])

        return suggestions

    def _get_default_suggestions(self) -> List[str]:
        """
        Get default suggestions when generation fails or no history available

        Returns:
            List of default suggestion strings
        """
        return [
            "What healthcare services are available?",
            "How can I access my medical records?",
            "Tell me about preventive care programs",
            "What telehealth options exist?",
        ]


# Global suggestions service instance
suggestions_service = SuggestionsService()
