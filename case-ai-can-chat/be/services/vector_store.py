import logging
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from core.config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """
    Service for managing vector embeddings and similarity search
    Implements hybrid search with semantic and keyword matching
    Uses NVIDIA NIM embedding endpoint exclusively
    """

    def __init__(self):
        self.client = None
        self.collection = None
        self.embedding_service = None
        self.initialized = False
        self.use_nemo = settings.NEMO_ENABLED  # Track if using NVIDIA NeMo embeddings

    async def initialize(self):
        """
        Initialize the vector store and embedding service
        """
        if self.initialized:
            logger.info("Vector store already initialized")
            return

        try:
            # Try to connect to ChromaDB - first HTTP (Docker), then local (development)
            chroma_host = settings.CHROMADB_HOST
            chroma_port = settings.CHROMADB_PORT

            # Try HTTP client first (for Docker/production) with retry logic
            try:
                logger.info(
                    f"Attempting to connect to ChromaDB at {chroma_host}:{chroma_port}"
                )
                import asyncio

                import httpx

                # Retry logic: wait for ChromaDB to be ready
                max_retries = 10
                retry_delay = 2
                connected = False

                for attempt in range(1, max_retries + 1):
                    try:
                        response = httpx.get(
                            f"http://{chroma_host}:{chroma_port}/api/v2/heartbeat",
                            timeout=2.0,
                        )
                        if response.status_code == 200:
                            logger.info(
                                f"ChromaDB HTTP service detected (attempt {attempt}/{max_retries}), using HttpClient"
                            )
                            connected = True
                            break
                    except Exception as e:
                        if attempt < max_retries:
                            logger.info(
                                f"ChromaDB not ready yet (attempt {attempt}/{max_retries}), retrying in {retry_delay}s..."
                            )
                            await asyncio.sleep(retry_delay)
                        else:
                            raise e

                if connected:
                    self.client = chromadb.HttpClient(
                        host=chroma_host,
                        port=chroma_port,
                        settings=ChromaSettings(
                            anonymized_telemetry=False, allow_reset=False
                        ),
                    )
                else:
                    raise Exception("ChromaDB not responding after retries")
            except Exception as http_error:
                # Fallback to embedded/persistent client for local development
                logger.warning(
                    f"Cannot connect to ChromaDB HTTP service after {max_retries} attempts: {http_error}"
                )
                logger.info("Falling back to PersistentClient (local embedded mode)")

                import os

                persist_directory = "./data/vector_db"
                os.makedirs(persist_directory, exist_ok=True)

                self.client = chromadb.PersistentClient(
                    path=persist_directory,
                    settings=ChromaSettings(
                        anonymized_telemetry=False, allow_reset=False
                    ),
                )
                logger.info(f"Using local ChromaDB at {persist_directory}")

            # Get or create collection (idempotent operation)
            # Note: ChromaDB 0.4+ uses cosine similarity by default
            self.collection = self.client.get_or_create_collection(
                name=settings.VECTOR_COLLECTION_NAME
            )
            logger.info(f"Using collection: {settings.VECTOR_COLLECTION_NAME}")

            # Load embedding service - ONLY NIM, no fallback
            logger.info("Initializing NVIDIA NeMo embeddings service (NIM endpoint)")
            from services.nemo_embeddings_service import nemo_embeddings_service

            self.embedding_service = nemo_embeddings_service
            await self.embedding_service.initialize()

            self.initialized = True
            logger.info("Vector store initialization complete")

        except Exception as e:
            logger.error(f"Failed to initialize vector store: {str(e)}", exc_info=True)
            raise

    async def embed_text(self, text: str, input_type: str = "passage") -> List[float]:
        """
        Generate embeddings for text using NIM endpoint

        Args:
            text: Input text to embed
            input_type: Type of input - "query" for search queries, "passage" for documents

        Returns:
            List of embedding values
        """
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")

        try:
            # Use NIM embeddings service only (async version)
            embedding = await self.embedding_service.encode_async(
                text, input_type=input_type
            )
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding via NIM: {str(e)}", exc_info=True)
            raise

    async def embed_batch(
        self, texts: List[str], input_type: str = "passage"
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts using NIM endpoint

        Args:
            texts: List of input texts
            input_type: Type of input - "query" for search queries, "passage" for documents

        Returns:
            List of embedding vectors
        """
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")

        try:
            # Use NIM embeddings service only (async version)
            embeddings = await self.embedding_service.encode_batch_async(
                texts, input_type=input_type
            )
            return embeddings
        except Exception as e:
            logger.error(
                f"Error generating batch embeddings via NIM: {str(e)}", exc_info=True
            )
            raise

    async def add_documents(
        self, texts: List[str], metadatas: List[Dict[str, Any]], ids: List[str]
    ) -> bool:
        """
        Add documents to the vector store

        Args:
            texts: List of document texts
            metadatas: List of metadata dictionaries
            ids: List of unique document IDs

        Returns:
            Success status
        """
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")

        try:
            logger.info(f"Adding {len(texts)} documents to vector store")

            # Generate embeddings
            embeddings = await self.embed_batch(texts)

            # Add to collection
            self.collection.add(
                embeddings=embeddings, documents=texts, metadatas=metadatas, ids=ids
            )

            logger.info(f"Successfully added {len(texts)} documents")
            return True

        except Exception as e:
            logger.error(f"Error adding documents: {str(e)}", exc_info=True)
            raise

    async def search(
        self,
        query: str,
        top_k: int = None,
        score_threshold: float = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
        emit_callback=None,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents using semantic search

        Args:
            query: Search query
            top_k: Number of results to return
            score_threshold: Minimum similarity score
            filter_metadata: Optional metadata filters
            emit_callback: Optional callback to emit CoT steps

        Returns:
            List of search results with scores
        """
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")

        top_k = top_k or settings.RETRIEVAL_TOP_K
        score_threshold = score_threshold or settings.RETRIEVAL_SCORE_THRESHOLD

        try:
            # Emit CoT step
            filter_lines = []
            if filter_metadata:
                filter_items = [f"  • {k} = {v}" for k, v in filter_metadata.items()]
                filter_lines = ["\n\n🔎 Filters applied:"] + filter_items

            if emit_callback:
                filter_text = (
                    ", ".join(
                        [item.strip().replace("  • ", "") for item in filter_lines[1:]]
                    )
                    if filter_lines
                    else ""
                )
                filter_display = f", Filters: {filter_text}" if filter_text else ""
                await emit_callback(
                    step_type="searching",
                    label="Searching vector database",
                    description=f"Query: '{query[:80]}{'...' if len(query) > 80 else ''}'\nGenerating NeMo embedding • Searching ChromaDB{filter_display}, Top results: {top_k}, Min score: {score_threshold:.2f}",
                    status="active",
                )

            logger.debug(f"Searching with query: '{query[:100]}...'")

            # Generate query embedding (use "passage" - same as documents, since "query" gives poor results)
            query_embedding = await self.embed_text(query, input_type="passage")
            embedding_dim = len(query_embedding)

            # Perform search
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=filter_metadata,
                include=["documents", "metadatas", "distances"],
            )

            # Process results
            processed_results = []
            total_found = 0
            if results and results["documents"] and len(results["documents"]) > 0:
                total_found = len(results["documents"][0])
                for i in range(total_found):
                    # Convert distance to similarity score (cosine similarity)
                    distance = results["distances"][0][i]
                    similarity_score = 1 - distance

                    # Filter by score threshold
                    if similarity_score >= score_threshold:
                        processed_results.append(
                            {
                                "text": results["documents"][0][i],
                                "metadata": results["metadatas"][0][i],
                                "score": float(similarity_score),
                                "title": results["metadatas"][0][i].get(
                                    "title", "Untitled"
                                ),
                                "id": (
                                    results["ids"][0][i] if "ids" in results else None
                                ),
                            }
                        )

            logger.info(f"Found {len(processed_results)} relevant documents")

            # Emit completion
            if emit_callback:
                filtered_out = total_found - len(processed_results)
                filter_text = (
                    f" • Filtered: {filtered_out} (below threshold)"
                    if filtered_out > 0
                    else ""
                )

                await emit_callback(
                    step_type="searching",
                    label="Searching vector database",
                    description=f"✓ Search complete, Results: • Embedding dimension: {embedding_dim} • Scanned: {total_found} results{filter_text} • Matched: {len(processed_results)} document(s)",
                    status="complete",
                )

            return processed_results

        except Exception as e:
            logger.error(f"Error during search: {str(e)}", exc_info=True)
            if emit_callback:
                await emit_callback(
                    step_type="searching",
                    label="Searching vector database",
                    status="error",
                )
            raise

    async def delete_documents(self, ids: List[str]) -> bool:
        """
        Delete documents from the vector store

        Args:
            ids: List of document IDs to delete

        Returns:
            Success status
        """
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")

        try:
            logger.info(f"Deleting {len(ids)} documents from vector store")
            self.collection.delete(ids=ids)
            logger.info(f"Successfully deleted {len(ids)} documents")
            return True
        except Exception as e:
            logger.error(f"Error deleting documents: {str(e)}", exc_info=True)
            raise

    async def get_collection_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the vector collection

        Returns:
            Dictionary with collection statistics
        """
        if not self.initialized:
            raise RuntimeError("Vector store not initialized")

        try:
            count = self.collection.count()

            # Use static settings for embedding dimension (no external calls)
            # This ensures health checks are fast and don't depend on external services
            embedding_dim = settings.EMBEDDING_DIMENSION

            return {
                "total_documents": count,
                "collection_name": settings.VECTOR_COLLECTION_NAME,
                "embedding_dimension": embedding_dim,
                "using_nemo": self.use_nemo,
            }
        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}", exc_info=True)
            raise


# Global vector store instance
vector_store = VectorStoreService()
