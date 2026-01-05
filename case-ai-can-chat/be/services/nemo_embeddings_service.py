import logging
from typing import List, Union

import httpx
from core.config import settings

logger = logging.getLogger(__name__)


class NeMoEmbeddingsService:
    """
    Service for NVIDIA NIM embedding generation
    Uses external NIM API endpoint for embeddings
    """

    def __init__(self):
        self.api_url = settings.EMBEDDING_API_URL
        self.model_name = settings.EMBEDDING_MODEL
        self.client = httpx.AsyncClient(timeout=60.0)
        self.test_client = httpx.AsyncClient(timeout=3.0)  # Shorter timeout for testing
        self.initialized = False  # Allows app to start
        self.is_healthy = False  # Reflects actual connection status

    async def initialize(self):
        """
        Initialize and test connection to NIM embedding endpoint
        Uses quick connectivity test with short timeout to avoid blocking startup
        """
        try:
            logger.info("Initializing NVIDIA NIM embeddings service")
            logger.info(f"API URL: {self.api_url}")
            logger.info(f"Model: {self.model_name}")

            # Quick connectivity test with short timeout (3 seconds)
            try:
                logger.info("Testing NIM endpoint connectivity (3s timeout)...")
                test_result = await self.test_client.post(
                    self.api_url,
                    json={
                        "input": "test",
                        "model": self.model_name,
                        "input_type": "passage",
                        "modality": "text",
                    },
                    headers={
                        "accept": "application/json",
                        "Content-Type": "application/json",
                    },
                )

                if test_result.status_code == 200:
                    logger.info("NIM embeddings service is available and responding")
                    self.initialized = True
                    self.is_healthy = True  # Connection successful
                else:
                    logger.warning(
                        f"NIM endpoint responded with status {test_result.status_code}"
                    )
                    logger.warning(
                        "Service will be marked as initialized, but is not healthy"
                    )
                    self.initialized = True
                    self.is_healthy = False  # Connection failed

            except httpx.TimeoutException:
                logger.warning(
                    "NIM endpoint timeout after 3s - service may not be available locally"
                )
                logger.info(
                    "Continuing with initialization - will attempt connection when needed"
                )
                self.initialized = True  # Allow startup
                self.is_healthy = False  # Connection failed

            except httpx.ConnectError as e:
                logger.warning(f"Cannot connect to NIM endpoint: {e}")
                logger.info("This is normal if running locally without cluster access")
                logger.info(
                    "Continuing with initialization - will attempt connection when needed"
                )
                self.initialized = True  # Allow startup
                self.is_healthy = False  # Connection failed

        except Exception as e:
            logger.error(
                f"Unexpected error during NIM embeddings initialization: {str(e)}",
                exc_info=True,
            )
            logger.warning("Continuing anyway - embedding service may not work")
            self.initialized = True  # Allow startup
            self.is_healthy = False  # Connection failed

    async def _call_api(
        self, text: Union[str, List[str]], input_type: str = "passage"
    ) -> List[List[float]]:
        """
        Call the NIM embedding API

        Args:
            text: Single text string or list of texts
            input_type: Type of input - "query" for search queries, "passage" for documents

        Returns:
            List of embedding vectors
        """
        try:
            # Prepare request payload
            payload = {
                "input": text,
                "model": self.model_name,
                "input_type": input_type,
                "modality": "text",
            }

            # Call API
            response = await self.client.post(
                self.api_url,
                json=payload,
                headers={
                    "accept": "application/json",
                    "Content-Type": "application/json",
                },
            )

            if response.status_code != 200:
                error_msg = f"NIM API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            # Parse response
            result = response.json()

            # Extract embeddings from response
            # NIM API returns: {"data": [{"embedding": [...]}, ...]}
            embeddings = [item["embedding"] for item in result.get("data", [])]

            return embeddings

        except Exception as e:
            logger.error(f"Error calling NIM embedding API: {str(e)}", exc_info=True)
            raise

    def encode(self, text: str) -> List[float]:
        """
        Generate embedding for a single text
        Note: This is a sync wrapper that should be called with await in async context

        Args:
            text: Input text

        Returns:
            Embedding vector as list of floats
        """
        # This method signature matches the old interface for compatibility
        # In practice, use encode_async
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(self.encode_async(text))

    async def encode_async(self, text: str, input_type: str = "passage") -> List[float]:
        """
        Generate embedding for a single text (async version)

        Args:
            text: Input text
            input_type: Type of input - "query" for search queries, "passage" for documents

        Returns:
            Embedding vector as list of floats
        """
        if not self.initialized:
            raise RuntimeError("Embeddings service not initialized")

        try:
            embeddings = await self._call_api(text, input_type=input_type)
            return embeddings[0] if embeddings else []

        except Exception as e:
            logger.error(f"Error encoding text: {str(e)}")
            raise

    def encode_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        Note: This is a sync wrapper

        Args:
            texts: List of input texts

        Returns:
            List of embedding vectors
        """
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(self.encode_batch_async(texts))

    async def encode_batch_async(
        self, texts: List[str], input_type: str = "passage"
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts (async version)

        Args:
            texts: List of input texts
            input_type: Type of input - "query" for search queries, "passage" for documents

        Returns:
            List of embedding vectors
        """
        if not self.initialized:
            raise RuntimeError("Embeddings service not initialized")

        try:
            logger.info(f"Encoding batch of {len(texts)} texts via NIM API")
            embeddings = await self._call_api(texts, input_type=input_type)
            return embeddings

        except Exception as e:
            logger.error(f"Error encoding batch: {str(e)}", exc_info=True)
            raise

    def get_embedding_dimension(self) -> int:
        """
        Get the dimensionality of embeddings

        Returns:
            Embedding dimension from config
        """
        return settings.EMBEDDING_DIMENSION

    async def check_health(self) -> bool:
        """
        Perform a live health check of the embedding service

        Returns:
            True if service is currently accessible
        """
        try:
            test_result = await self.test_client.post(
                self.api_url,
                json={
                    "input": "health_check",
                    "model": self.model_name,
                    "input_type": "passage",
                    "modality": "text",
                },
                headers={
                    "accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            is_healthy = test_result.status_code == 200
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

    async def close(self):
        """
        Close HTTP client
        """
        await self.client.aclose()


# Global NeMo embeddings service instance
nemo_embeddings_service = NeMoEmbeddingsService()
