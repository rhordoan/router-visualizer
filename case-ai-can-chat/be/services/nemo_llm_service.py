import json
import logging
from typing import AsyncGenerator, Dict, List

import httpx
from core.config import settings

logger = logging.getLogger(__name__)


class NeMoLLMService:
    """
    Service for NVIDIA Nemotron LLM via Ollama
    Provides local, private LLM inference
    """

    def __init__(self):
        self.base_url = settings.LLM_BASE_URL
        self.model = settings.LLM_MODEL
        self.client = httpx.AsyncClient(timeout=120.0)
        self.test_client = httpx.AsyncClient(timeout=5.0)  # Shorter timeout for testing
        self.initialized = False  # Allows app to start
        self.is_healthy = False  # Reflects actual connection status

    async def initialize(self):
        """
        Check if Ollama service is available
        Uses quick connectivity test with short timeout to avoid blocking startup
        """
        try:
            logger.info(f"Checking Ollama service at {self.base_url} (5s timeout)...")

            try:
                response = await self.test_client.get(f"{self.base_url}/api/tags")

                if response.status_code == 200:
                    models = response.json()
                    available_models = [m["name"] for m in models.get("models", [])]
                    logger.info("Ollama service is available")
                    logger.info(f"Available models: {available_models}")

                    if self.model in available_models or any(
                        self.model in m for m in available_models
                    ):
                        logger.info(f"Model {self.model} is ready")
                        self.initialized = True
                        self.is_healthy = True  # Connection and model available
                    else:
                        logger.warning(
                            f"Model {self.model} not found. Available: {available_models}"
                        )
                        logger.info(
                            "Marking as initialized - will attempt to use model anyway"
                        )
                        self.initialized = True  # Allow startup
                        self.is_healthy = False  # Model not found
                else:
                    logger.warning(
                        f"Ollama service returned status {response.status_code}"
                    )
                    logger.info(
                        "Marking as initialized - will attempt connection when needed"
                    )
                    self.initialized = True  # Allow startup
                    self.is_healthy = False  # Connection failed

            except httpx.TimeoutException:
                logger.warning("Ollama endpoint timeout after 5s")
                logger.info("This is normal if Ollama is external and slow to respond")
                logger.info(
                    "Continuing with initialization - will attempt connection when needed"
                )
                self.initialized = True  # Allow startup
                self.is_healthy = False  # Connection failed

            except httpx.ConnectError as e:
                logger.warning(f"Cannot connect to Ollama endpoint: {e}")
                logger.info("This is normal if Ollama is not running locally")
                logger.info(
                    "Continuing with initialization - will attempt connection when needed"
                )
                self.initialized = True  # Allow startup
                self.is_healthy = False  # Connection failed

        except Exception as e:
            logger.error(f"Unexpected error checking Ollama: {str(e)}", exc_info=True)
            logger.warning("Continuing anyway - LLM service may not work")
            self.initialized = True  # Allow startup
            self.is_healthy = False  # Connection failed

    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = None,
        max_tokens: int = None,
        stream: bool = False,
    ) -> str:
        """
        Generate completion using Ollama

        Args:
            messages: List of message dictionaries with 'role' and 'content'
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            stream: Enable streaming response

        Returns:
            Generated text response
        """
        if not self.initialized:
            logger.warning("Ollama not initialized, attempting connection...")
            await self.initialize()

            if not self.initialized:
                raise RuntimeError("Ollama service not available")

        try:
            # Convert messages to Ollama format
            prompt = self._format_messages(messages)

            # Prepare request
            request_data = {
                "model": self.model,
                "prompt": prompt,
                "stream": stream,
                "options": {
                    "temperature": temperature or settings.LLM_TEMPERATURE,
                    "num_predict": max_tokens or settings.LLM_MAX_TOKENS,
                },
            }

            logger.debug(f"Sending request to Ollama: {self.model}")

            # Send request
            response = await self.client.post(
                f"{self.base_url}/api/generate", json=request_data, timeout=120.0
            )

            if response.status_code != 200:
                error_msg = (
                    f"Ollama API error: {response.status_code} - {response.text}"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            # Parse response
            if stream:
                return await self._handle_stream_response(response)
            else:
                result = response.json()
                generated_text = result.get("response", "")
                logger.info(f"Generated {len(generated_text)} characters")
                return generated_text

        except Exception as e:
            logger.error(f"Error generating with Ollama: {str(e)}", exc_info=True)
            raise

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = None,
        max_tokens: int = None,
    ) -> AsyncGenerator[str, None]:
        """
        Generate streaming completion

        Args:
            messages: List of message dictionaries
            temperature: Sampling temperature
            max_tokens: Maximum tokens

        Yields:
            Text chunks as they are generated
        """
        if not self.initialized:
            await self.initialize()
            if not self.initialized:
                raise RuntimeError("Ollama service not available")

        try:
            prompt = self._format_messages(messages)

            request_data = {
                "model": self.model,
                "prompt": prompt,
                "stream": True,
                "options": {
                    "temperature": temperature or settings.LLM_TEMPERATURE,
                    "num_predict": max_tokens or settings.LLM_MAX_TOKENS,
                },
            }

            async with self.client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json=request_data,
                timeout=120.0,
            ) as response:
                if response.status_code != 200:
                    raise RuntimeError(f"Ollama API error: {response.status_code}")

                async for line in response.aiter_lines():
                    if line:
                        try:
                            chunk = json.loads(line)
                            if "response" in chunk:
                                yield chunk["response"]
                        except json.JSONDecodeError:
                            continue

        except Exception as e:
            logger.error(f"Error in streaming generation: {str(e)}", exc_info=True)
            raise

    def _format_messages(self, messages: List[Dict[str, str]]) -> str:
        """
        Convert chat messages to a single prompt for Ollama

        Args:
            messages: List of message dictionaries

        Returns:
            Formatted prompt string
        """
        formatted = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                formatted.append(f"System: {content}")
            elif role == "user":
                formatted.append(f"User: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")

        # Add final prompt for assistant
        formatted.append("Assistant:")

        return "\n\n".join(formatted)

    async def _handle_stream_response(self, response: httpx.Response) -> str:
        """
        Handle streaming response and collect full text

        Args:
            response: httpx Response object

        Returns:
            Full generated text
        """
        full_text = []

        async for line in response.aiter_lines():
            if line:
                try:
                    chunk = json.loads(line)
                    if "response" in chunk:
                        full_text.append(chunk["response"])
                except json.JSONDecodeError:
                    continue

        return "".join(full_text)

    async def close(self):
        """
        Close HTTP client
        """
        await self.client.aclose()

    async def check_health(self) -> bool:
        """
        Perform a live health check of the LLM service

        Returns:
            True if service is currently accessible
        """
        try:
            response = await self.test_client.get(f"{self.base_url}/api/tags")
            is_healthy = response.status_code == 200
            self.is_healthy = is_healthy  # Update cached status
            return is_healthy
        except Exception:
            self.is_healthy = False
            return False

    def is_available(self) -> bool:
        """
        Check if service is available and healthy
        Uses cached health status from initialization or last health check

        Returns:
            True if service is healthy and can be used
        """
        return self.is_healthy


# Global NeMo LLM service instance
nemo_llm_service = NeMoLLMService()
