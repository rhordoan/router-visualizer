from typing import List, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    """

    # Application
    APP_NAME: str = "HealthChat RAG API"
    DEBUG: bool = False
    VERSION: str = "1.0.0"

    # API
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=[
            "http://localhost:3000",
            "http://frontend:3000",
            "http://10.130.200.141:30036",
        ],
        description="Allowed CORS origins",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # Database
    DATABASE_URL: str = Field(
        default="mysql+pymysql://healthchat:healthchat123@mysql:3306/healthchat_db",
        description="MySQL database connection URL",
    )

    # Vector Database (ChromaDB)
    CHROMADB_HOST: str = Field(
        default="chromadb", description="ChromaDB host (container name or IP)"
    )
    CHROMADB_PORT: int = Field(default=8000, description="ChromaDB port")
    VECTOR_COLLECTION_NAME: str = "healthchat_documents"

    # JWT Authentication
    JWT_SECRET_KEY: str = Field(
        default="1234567890",
        description="Secret key for JWT token generation",
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    JWT_EXPIRATION_HOURS: int = Field(
        default=168, description="JWT token expiration time in hours (default: 7 days)"
    )
    ALLOWED_EMAIL_DOMAIN: str = Field(
        default="computacenter.com", description="Allowed email domain for login"
    )

    # LLM Configuration - External Ollama
    LLM_BASE_URL: str = Field(
        default="https://ollama.cc-demos.com",
        description="External Ollama API base URL",
    )
    LLM_MODEL: str = Field(
        default="nemotron:70b", description="LLM model name in Ollama"
    )
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 2048

    # Embedding Configuration - NIM Endpoint
    EMBEDDING_API_URL: str = Field(
        default="http://10.130.200.141:30020/v1/embeddings",
        description="NVIDIA NIM embedding API endpoint",
    )
    EMBEDDING_MODEL: str = Field(
        default="nvidia/llama-3.2-nv-embedqa-1b-v2",
        description="Embedding model name for NIM",
    )
    EMBEDDING_DIMENSION: int = (
        2048  # llama-3.2-nv-embedqa-1b-v2 returns 2048-dimensional vectors
    )

    # Web Search Configuration (disabled by default - Nemotron 70B doesn't support function calling)
    ENABLE_WEB_SEARCH: bool = Field(
        default=False, description="Enable web search capability"
    )
    WEB_SEARCH_MAX_RESULTS: int = Field(
        default=5, description="Maximum number of web search results to retrieve"
    )
    WEB_SEARCH_REGION: str = Field(
        default="ca-en", description="DuckDuckGo search region (ca-en for Canada)"
    )

    # Healthcare Knowledge Base URLs
    HEALTHCARE_KNOWLEDGE_URLS: Union[List[str], str] = Field(
        default="",
        description="Comma-separated list of healthcare official URLs to scrape",
    )

    @field_validator("HEALTHCARE_KNOWLEDGE_URLS", mode="before")
    @classmethod
    def parse_healthcare_urls(cls, v):
        if isinstance(v, str):
            if not v:
                return []
            return [url.strip() for url in v.split(",") if url.strip()]
        return v

    # RAG Configuration
    RETRIEVAL_TOP_K: int = Field(
        default=10,
        description="Number of documents to retrieve (increased for better recall)",
    )
    RETRIEVAL_SCORE_THRESHOLD: float = Field(
        default=0.05,
        description="Minimum similarity score for retrieval (very low due to poor embedding model)",
    )
    RERANK_TOP_N: int = Field(
        default=5, description="Number of documents to keep after reranking"
    )

    # Document Processing
    CHUNK_SIZE: int = Field(
        default=512, description="Size of document chunks in characters"
    )
    CHUNK_OVERLAP: int = Field(default=50, description="Overlap between chunks")
    MAX_FILE_SIZE_MB: int = Field(
        default=10, description="Maximum file upload size in MB"
    )

    # NeMo Configuration
    NEMO_ENABLED: bool = Field(default=True, description="Enable NVIDIA NeMo stack")
    NEMO_GUARDRAILS_ENABLED: bool = Field(
        default=True, description="Enable NeMo Guardrails for safety"
    )

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "./logs/healthchat.log"

    # Conversation
    MAX_CONVERSATION_HISTORY: int = Field(
        default=10,
        description="Maximum number of messages to keep in conversation history",
    )

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
