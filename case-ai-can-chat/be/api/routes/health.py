import logging
from datetime import datetime

from core.config import settings
from db.session import get_db
from fastapi import APIRouter, Depends
from schemas.schemas import HealthResponse
from services.vector_store import vector_store
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    Returns the status of all system components
    """
    logger.info("Health check endpoint called")
    services = {}

    # Check database
    try:
        logger.info("Checking database connection...")
        db.execute(text("SELECT 1"))
        services["database"] = "healthy"
        logger.info("Database check: healthy")
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}", exc_info=True)
        services["database"] = "unhealthy"

    # Check vector store
    try:
        logger.info("Checking vector store...")
        logger.info(f"Vector store initialized: {vector_store.initialized}")
        logger.info(f"Vector store collection: {vector_store.collection}")

        if not vector_store.initialized:
            services["vector_store"] = "not initialized"
            logger.warning("Vector store not initialized")
        elif vector_store.collection is None:
            services["vector_store"] = "unhealthy - collection missing"
            logger.error("Vector store initialized but collection is None")
        else:
            # Try to get actual stats to verify it's working
            try:
                logger.info("Attempting to get vector store stats...")
                stats = await vector_store.get_collection_stats()
                services["vector_store"] = (
                    f"healthy ({stats['total_documents']} chunks total)"
                )
                logger.info(
                    f"Vector store check: healthy with {stats['total_documents']} chunks total"
                )
            except Exception as stats_error:
                services["vector_store"] = "unhealthy - cannot get stats"
                logger.error(
                    f"Vector store stats failed: {type(stats_error).__name__}: {str(stats_error)}",
                    exc_info=True,
                )
    except Exception as e:
        logger.error(f"Vector store health check failed: {str(e)}", exc_info=True)
        services["vector_store"] = "unhealthy"

    # Check LLM service
    try:
        logger.info("Checking LLM service...")

        # Check based on configuration settings
        if settings.NEMO_ENABLED:
            # Check if the LLM service is actually healthy
            from services.nemo_llm_service import nemo_llm_service

            # Perform live health check
            is_healthy = await nemo_llm_service.check_health()
            if is_healthy:
                services["llm"] = "connected (NVIDIA NeMo)"
                logger.info("LLM service check: NVIDIA NeMo healthy")
            else:
                services["llm"] = "unavailable (NVIDIA NeMo)"
                logger.warning("LLM service configured but not healthy")
        elif hasattr(settings, "OPENAI_API_KEY") and settings.OPENAI_API_KEY:
            services["llm"] = "connected (OpenAI)"
            logger.info("LLM service check: OpenAI configured")
        else:
            services["llm"] = "not configured"
            logger.warning("LLM service not configured - no provider enabled")
    except Exception as e:
        logger.error(f"LLM service health check failed: {str(e)}", exc_info=True)
        services["llm"] = "error"

    # Check Embedding service
    try:
        logger.info("Checking Embedding service...")

        # Check if embeddings are configured
        if settings.NEMO_ENABLED:
            # Check if the embedding service is actually healthy
            from services.nemo_embeddings_service import nemo_embeddings_service

            # Perform live health check
            is_healthy = await nemo_embeddings_service.check_health()
            if is_healthy:
                services["embeddings"] = "connected (NVIDIA NIM)"
                logger.info("Embedding service check: NVIDIA NIM healthy")
            else:
                services["embeddings"] = "unavailable (NVIDIA NIM)"
                logger.warning("Embedding service configured but not healthy")
        else:
            services["embeddings"] = "not configured"
            logger.info("Embedding service not configured")
    except Exception as e:
        logger.error(f"Embedding service health check failed: {str(e)}", exc_info=True)
        services["embeddings"] = "error"

    # Overall status
    try:
        logger.info(f"Services status: {services}")
        # Check critical services (database, vector_store, llm, embeddings)
        all_healthy = all(
            "healthy" in status.lower() or "connected" in status.lower()
            for key, status in services.items()
            if key in ["database", "vector_store", "llm", "embeddings"]
        )

        overall_status = "healthy" if all_healthy else "degraded"
        logger.info(f"Overall health status: {overall_status}")

        response = HealthResponse(
            status=overall_status,
            version=settings.VERSION,
            timestamp=datetime.utcnow(),
            services=services,
        )
        logger.info(f"Returning health response: {response}")
        return response
    except Exception as e:
        logger.error(f"Failed to create health response: {str(e)}", exc_info=True)
        raise
