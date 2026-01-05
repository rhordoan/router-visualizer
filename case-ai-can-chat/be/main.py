# Import warning suppression first, before any other imports
import logging
from contextlib import asynccontextmanager

import suppress_warnings  # noqa: F401
from api.routes import auth, chat, cot_realtime, documents, health
from core.config import settings
from core.logging_config import setup_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from services.vector_store import vector_store

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    Initializes database, runs migrations, and sets up NVIDIA NeMo stack
    """
    logger.info("Starting HealthChat RAG Backend with NVIDIA NeMo...")

    try:
        # Initialize database and run migrations
        # This runs synchronously but quickly due to optimizations in init_db.py
        logger.info("Initializing database...")
        from db.init_db import initialize_database

        try:
            initialize_database()
        except Exception as db_error:
            logger.error(f"Failed to initialize database: {str(db_error)}")
            raise

        # Initialize vector store with NeMo embeddings (MUST be before seeding)
        logger.info("Initializing vector store with NeMo embeddings...")
        await vector_store.initialize()

        # Seed initial documents if database is empty (AFTER vector store initialization)
        logger.info("Checking for initial data...")
        try:
            from scripts.seed_documents import seed_documents

            result = await seed_documents()
            if isinstance(result, int) and result > 0:
                logger.info(f"Seeded {result} initial documents successfully")
            else:
                logger.info("Database already contains documents, skipping seed")
        except Exception as seed_error:
            logger.warning(f"Warning: Could not seed initial data: {str(seed_error)}")
            logger.warning("Database is functional but may not have sample documents")

        # Initialize NeMo LLM service
        if settings.NEMO_ENABLED:
            logger.info("Initializing NVIDIA Nemotron LLM service...")
            from services.nemo_llm_service import nemo_llm_service

            await nemo_llm_service.initialize()

            # Initialize NeMo Guardrails
            if settings.NEMO_GUARDRAILS_ENABLED:
                logger.info("Initializing NeMo Guardrails...")
                from services.nemo_guardrails_service import nemo_guardrails_service

                await nemo_guardrails_service.initialize()

        logger.info("=" * 60)
        logger.info("Startup complete. Backend ready with NVIDIA NeMo stack!")
        logger.info(f"NeMo Enabled: {settings.NEMO_ENABLED}")
        logger.info(f"Guardrails Enabled: {settings.NEMO_GUARDRAILS_ENABLED}")
        logger.info(f"LLM Model: {settings.LLM_MODEL}")
        logger.info(f"Web Search: {settings.ENABLE_WEB_SEARCH}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Error during startup: {str(e)}", exc_info=True)
        raise

    yield

    logger.info("Shutting down HealthChat RAG Backend...")

    # Cleanup NeMo services
    if settings.NEMO_ENABLED:
        from services.nemo_llm_service import nemo_llm_service

        await nemo_llm_service.close()


# Initialize FastAPI app
app = FastAPI(
    title="HealthChat RAG API",
    description="Retrieval-Augmented Generation API for Healthcare Documentation",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global exception handler to catch and log all unhandled exceptions
    """
    logger.error(
        f"Unhandled exception: {str(exc)}",
        exc_info=True,
        extra={"path": request.url.path},
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred. Please try again later.",
            "error_type": type(exc).__name__,
        },
    )


# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(documents.router, prefix="/api/v1", tags=["Documents"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(cot_realtime.router, prefix="/api/v1/cot", tags=["Chain-of-Thought"])


@app.get("/")
async def root():
    """
    Root endpoint - API information
    """
    return {
        "name": "HealthChat RAG API",
        "version": "1.0.0",
        "description": "RAG-powered virtual assistant for healthcare documentation",
        "docs_url": "/docs",
        "health_check": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG, log_level="info"
    )
