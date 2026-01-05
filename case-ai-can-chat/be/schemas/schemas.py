import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# Document Schemas
class DocumentBase(BaseModel):
    """Base schema for document data"""

    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    source: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, max_length=200)
    metadata: Optional[Dict[str, Any]] = None


class DocumentCreate(DocumentBase):
    """Schema for creating a new document"""

    pass


class DocumentResponse(DocumentBase):
    """Schema for document responses"""

    id: int
    user_id: Optional[int] = None
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_model(cls, db_obj):
        """Create DocumentResponse from ORM model with proper metadata handling"""
        import json

        metadata_dict = None
        if hasattr(db_obj, "metadata_json") and db_obj.metadata_json:
            try:
                metadata_dict = json.loads(db_obj.metadata_json)
            except Exception:
                metadata_dict = {}

        return cls(
            id=db_obj.id,
            user_id=db_obj.user_id,
            title=db_obj.title,
            content=db_obj.content,
            source=db_obj.source,
            category=db_obj.category,
            metadata=metadata_dict,
            chunk_count=db_obj.chunk_count,
            created_at=db_obj.created_at,
            updated_at=db_obj.updated_at,
        )

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_model(cls, db_obj) -> "DocumentResponse":  # noqa: F811
        """Create DocumentResponse from ORM model with proper metadata handling"""
        metadata_dict = None
        if hasattr(db_obj, "metadata_json") and db_obj.metadata_json:
            try:
                metadata_dict = json.loads(db_obj.metadata_json)
            except (json.JSONDecodeError, TypeError):
                metadata_dict = {}

        return cls(
            id=db_obj.id,
            user_id=db_obj.user_id,
            title=db_obj.title,
            content=db_obj.content,
            source=db_obj.source,
            category=db_obj.category,
            metadata=metadata_dict,
            chunk_count=db_obj.chunk_count,
            created_at=db_obj.created_at,
            updated_at=db_obj.updated_at,
        )


# Chat Schemas
class ChatMessage(BaseModel):
    """Schema for a chat message"""

    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    """Schema for chat requests"""

    message: str = Field(..., min_length=1, max_length=5000)
    session_id: Optional[str] = None
    conversation_history: Optional[List[ChatMessage]] = Field(default_factory=list)
    use_rag: bool = Field(default=True, description="Whether to use RAG for context")
    stream: bool = Field(default=False, description="Enable streaming responses")


class SourceDocument(BaseModel):
    """Schema for source document information"""

    document_id: int
    title: str
    content_snippet: str
    relevance_score: float
    source: Optional[str] = None
    category: Optional[str] = None


class ChainOfThoughtStep(BaseModel):
    """Schema for Chain of Thought step"""

    id: str = Field(..., description="Unique identifier for this step")
    step_type: str = Field(
        ..., description="Type of step: analyzing, searching, checking, etc."
    )
    label: str = Field(..., description="Display label for the step")
    description: Optional[str] = Field(None, description="Additional description")
    status: str = Field(default="pending", pattern="^(pending|active|complete|error)$")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StreamChunk(BaseModel):
    """Schema for streaming response chunks"""

    type: str = Field(
        ..., pattern="^(cot_step|content|sources|suggestions|done|error)$"
    )
    data: Optional[Any] = None


class ChatResponse(BaseModel):
    """Schema for chat responses"""

    response: str
    session_id: str
    sources: List[SourceDocument] = Field(default_factory=list)
    suggestions: List[str] = Field(
        default_factory=list, description="Follow-up suggestions"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Health Check Schema
class HealthResponse(BaseModel):
    """Schema for health check responses"""

    status: str
    version: str
    timestamp: datetime
    services: Dict[str, str]


# Query Schemas
class QueryRequest(BaseModel):
    """Schema for direct query requests (without conversation context)"""

    query: str = Field(..., min_length=1, max_length=5000)
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    score_threshold: Optional[float] = Field(default=0.3, ge=0.0, le=1.0)


class QueryResponse(BaseModel):
    """Schema for query responses"""

    query: str
    results: List[SourceDocument]
    total_found: int
    execution_time_ms: float


# Conversation Schemas
class ConversationSummary(BaseModel):
    """Schema for conversation summary"""

    id: int
    user_id: int
    session_id: str
    title: Optional[str]
    message_count: int
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Schema for message responses"""

    id: int
    role: str
    content: str
    sources: Optional[List[SourceDocument]] = None
    chain_of_thought_steps: Optional[List[Dict[str, Any]]] = None
    suggestions: Optional[List[str]] = None
    relevance_score: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    """Schema for creating a new conversation"""

    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    """Schema for updating a conversation"""

    title: Optional[str] = None


class ConversationDetail(BaseModel):
    """Schema for detailed conversation response"""

    id: int
    user_id: int
    session_id: str
    title: Optional[str]
    messages: List[MessageResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Batch Operations
class BulkDocumentUpload(BaseModel):
    """Schema for bulk document uploads"""

    documents: List[DocumentCreate]


class BulkUploadResponse(BaseModel):
    """Schema for bulk upload response"""

    success_count: int
    failed_count: int
    total: int
    errors: List[str] = Field(default_factory=list)


# Authentication Schemas
class UserResponse(BaseModel):
    """Schema for user responses"""

    id: int
    email: str
    name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    """Schema for login requests"""

    email: str = Field(..., pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


class Token(BaseModel):
    """Schema for JWT token response"""

    access_token: str
    token_type: str
    user: UserResponse


# Chain of Thought Real-Time Schemas
class CoTStepWithMetadata(BaseModel):
    """Extended CoT step with additional metadata for visualization"""

    id: str
    step_type: str
    label: str
    description: Optional[str] = None
    status: str
    timestamp: datetime
    duration_ms: Optional[float] = Field(None, description="Step duration in milliseconds")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MessageCoTSnapshot(BaseModel):
    """Snapshot of a message's Chain-of-Thought for real-time monitoring"""

    message_id: int
    conversation_id: int
    session_id: str
    user_query: str
    assistant_response: Optional[str] = None
    cot_steps: List[CoTStepWithMetadata] = Field(default_factory=list)
    sources_count: int = 0
    suggestions_count: int = 0
    total_steps: int = 0
    completed_steps: int = 0
    active_step: Optional[str] = None
    created_at: datetime
    last_updated: datetime
    processing_time_ms: Optional[float] = None


class RealtimeCoTFeed(BaseModel):
    """Real-time feed of active Chain-of-Thought processes"""

    active_conversations: int
    recent_messages: List[MessageCoTSnapshot]
    total_steps_in_progress: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CoTMetrics(BaseModel):
    """Aggregated metrics for Chain-of-Thought monitoring"""

    total_messages_today: int
    total_steps_today: int
    avg_steps_per_message: float
    avg_processing_time_ms: float
    step_type_breakdown: Dict[str, int]
    active_conversations: int
    last_activity: Optional[datetime] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
