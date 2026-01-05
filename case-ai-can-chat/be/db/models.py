from datetime import datetime

from db.session import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship


class User(Base):
    """
    Model for storing user information
    Email-based authentication for @computacenter.com domain
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    conversations = relationship(
        "Conversation", back_populates="user", cascade="all, delete-orphan"
    )
    documents = relationship(
        "Document", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"


class Document(Base):
    """
    Model for storing document metadata
    Actual content is stored in the vector database
    Documents are now associated with conversations instead of just users
    """

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("conversations.id"), nullable=True, index=True
    )
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(1000), nullable=True)
    category = Column(String(200), nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="documents")
    conversation = relationship("Conversation", back_populates="documents")
    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Document(id={self.id}, title='{self.title[:50]}')>"


class DocumentChunk(Base):
    """
    Model for storing document chunk metadata
    Links to the original document
    """

    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer, ForeignKey("documents.id"), nullable=False, index=True
    )
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    vector_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="chunks")

    __table_args__ = (Index("idx_document_chunk", "document_id", "chunk_index"),)

    def __repr__(self):
        return f"<DocumentChunk(id={self.id}, document_id={self.document_id}, chunk_index={self.chunk_index})>"


class Conversation(Base):
    """
    Model for storing conversation sessions
    """

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )
    documents = relationship(
        "Document", back_populates="conversation", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Conversation(id={self.id}, session_id='{self.session_id}', user_id={self.user_id})>"


class Message(Base):
    """
    Model for storing individual messages in conversations
    """

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("conversations.id"), nullable=False, index=True
    )
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON array of source document IDs
    chain_of_thought_steps = Column(Text, nullable=True)  # JSON array of CoT steps
    suggestions = Column(Text, nullable=True)  # JSON array of follow-up suggestions
    relevance_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_conversation_created", "conversation_id", "created_at"),
    )

    def __repr__(self):
        return f"<Message(id={self.id}, role='{self.role}', conversation_id={self.conversation_id})>"
