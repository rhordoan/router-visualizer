import json
import logging
import uuid
from datetime import datetime
from typing import List, Optional

from db.models import Conversation, Message
from schemas.schemas import (
    ChatMessage,
    ConversationDetail,
    ConversationSummary,
    MessageResponse,
    SourceDocument,
)
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ConversationService:
    """
    Service for managing conversations and message history
    """

    def __init__(self):
        pass

    def create_or_get_conversation(
        self, db: Session, user_id: int, session_id: Optional[str] = None
    ) -> Conversation:
        """
        Create a new conversation or get existing one for a user

        Args:
            db: Database session
            user_id: User ID
            session_id: Optional existing session ID

        Returns:
            Conversation object
        """
        try:
            if session_id:
                # Try to get existing conversation for this user
                conversation = (
                    db.query(Conversation)
                    .filter(
                        Conversation.session_id == session_id,
                        Conversation.user_id == user_id,
                    )
                    .first()
                )

                if conversation:
                    logger.debug(f"Found existing conversation: {session_id}")
                    return conversation

            # Create new conversation
            new_session_id = session_id or str(uuid.uuid4())
            conversation = Conversation(session_id=new_session_id, user_id=user_id)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

            logger.info(
                f"Created new conversation: {new_session_id} for user {user_id}"
            )
            return conversation

        except Exception as e:
            db.rollback()
            logger.error(f"Error creating conversation: {str(e)}", exc_info=True)
            raise

    def add_message(
        self,
        db: Session,
        conversation_id: int,
        role: str,
        content: str,
        sources: Optional[List[SourceDocument]] = None,
        chain_of_thought_steps: Optional[List] = None,
        suggestions: Optional[List[str]] = None,
        relevance_score: Optional[float] = None,
    ) -> Message:
        """
        Add a message to a conversation

        Args:
            db: Database session
            conversation_id: Conversation ID
            role: Message role (user, assistant, system)
            content: Message content
            sources: Optional source documents
            chain_of_thought_steps: Optional Chain of Thought steps
            suggestions: Optional follow-up suggestions
            relevance_score: Optional relevance score

        Returns:
            Created message object
        """
        try:
            # Serialize sources if provided
            sources_json = None
            if sources:
                sources_json = json.dumps([s.model_dump() for s in sources])

            # Serialize CoT steps if provided
            cot_json = None
            if chain_of_thought_steps:
                cot_json = json.dumps(chain_of_thought_steps)

            # Serialize suggestions if provided
            suggestions_json = None
            if suggestions:
                suggestions_json = json.dumps(suggestions)

            message = Message(
                conversation_id=conversation_id,
                role=role,
                content=content,
                sources=sources_json,
                chain_of_thought_steps=cot_json,
                suggestions=suggestions_json,
                relevance_score=relevance_score,
            )

            db.add(message)
            db.commit()
            db.refresh(message)

            # Update conversation timestamp
            conversation = (
                db.query(Conversation)
                .filter(Conversation.id == conversation_id)
                .first()
            )
            if conversation:
                conversation.updated_at = datetime.utcnow()

                # Generate title from first user message if not set or if it's "New Chat"
                if role == "user" and (
                    not conversation.title or conversation.title == "New Chat"
                ):
                    conversation.title = content[:100] + (
                        "..." if len(content) > 100 else ""
                    )

                db.commit()

            logger.debug(f"Added {role} message to conversation {conversation_id}")
            return message

        except Exception as e:
            db.rollback()
            logger.error(f"Error adding message: {str(e)}", exc_info=True)
            raise

    def get_conversation_history(
        self, db: Session, conversation_id: int, limit: Optional[int] = None
    ) -> List[ChatMessage]:
        """
        Get conversation history as ChatMessage list

        Args:
            db: Database session
            conversation_id: Conversation ID
            limit: Optional limit on number of messages

        Returns:
            List of ChatMessage objects
        """
        try:
            query = (
                db.query(Message)
                .filter(Message.conversation_id == conversation_id)
                .order_by(Message.created_at)
            )

            if limit:
                query = query.limit(limit)

            messages = query.all()

            return [ChatMessage(role=msg.role, content=msg.content) for msg in messages]

        except Exception as e:
            logger.error(f"Error getting conversation history: {str(e)}")
            return []

    def get_conversation_detail(
        self, db: Session, session_id: str, user_id: Optional[int] = None
    ) -> Optional[ConversationDetail]:
        """
        Get detailed conversation with all messages

        Args:
            db: Database session
            session_id: Session ID
            user_id: Optional user ID for access control

        Returns:
            ConversationDetail or None
        """
        try:
            query = db.query(Conversation).filter(Conversation.session_id == session_id)

            if user_id:
                query = query.filter(Conversation.user_id == user_id)

            conversation = query.first()

            if not conversation:
                return None

            messages = (
                db.query(Message)
                .filter(Message.conversation_id == conversation.id)
                .order_by(Message.created_at)
                .all()
            )

            message_responses = []
            for msg in messages:
                sources = None
                if msg.sources:
                    try:
                        sources_data = json.loads(msg.sources)
                        sources = [SourceDocument(**s) for s in sources_data]
                    except Exception as e:
                        logger.error(f"Error parsing message sources: {str(e)}")

                chain_of_thought_steps = None
                if msg.chain_of_thought_steps:
                    try:
                        chain_of_thought_steps = json.loads(msg.chain_of_thought_steps)
                    except Exception as e:
                        logger.error(f"Error parsing CoT steps: {str(e)}")

                suggestions = None
                if msg.suggestions:
                    try:
                        suggestions = json.loads(msg.suggestions)
                    except Exception as e:
                        logger.error(f"Error parsing suggestions: {str(e)}")

                message_responses.append(
                    MessageResponse(
                        id=msg.id,
                        role=msg.role,
                        content=msg.content,
                        sources=sources,
                        chain_of_thought_steps=chain_of_thought_steps,
                        suggestions=suggestions,
                        relevance_score=msg.relevance_score,
                        created_at=msg.created_at,
                    )
                )

            return ConversationDetail(
                id=conversation.id,
                user_id=conversation.user_id,
                session_id=conversation.session_id,
                title=conversation.title,
                messages=message_responses,
                created_at=conversation.created_at,
                updated_at=conversation.updated_at,
            )

        except Exception as e:
            logger.error(f"Error getting conversation detail: {str(e)}")
            return None

    def list_conversations(
        self, db: Session, user_id: int, skip: int = 0, limit: int = 50
    ) -> List[ConversationSummary]:
        """
        List all conversations for a specific user

        Args:
            db: Database session
            user_id: User ID
            skip: Number to skip
            limit: Maximum number to return

        Returns:
            List of conversation summaries
        """
        try:
            conversations = (
                db.query(Conversation)
                .filter(Conversation.user_id == user_id)
                .order_by(Conversation.updated_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )

            summaries = []
            for conv in conversations:
                # Count only user messages (prompts)
                message_count = (
                    db.query(Message)
                    .filter(Message.conversation_id == conv.id, Message.role == "user")
                    .count()
                )

                # Count documents in this conversation
                from db.models import Document

                document_count = (
                    db.query(Document)
                    .filter(Document.conversation_id == conv.id)
                    .count()
                )

                summaries.append(
                    ConversationSummary(
                        id=conv.id,
                        user_id=conv.user_id,
                        session_id=conv.session_id,
                        title=conv.title,
                        message_count=message_count,
                        document_count=document_count,
                        created_at=conv.created_at,
                        updated_at=conv.updated_at,
                    )
                )

            return summaries

        except Exception as e:
            logger.error(f"Error listing conversations: {str(e)}")
            return []

    async def delete_conversation(
        self, db: Session, session_id: str, user_id: Optional[int] = None
    ) -> bool:
        """
        Delete a conversation, all its messages, and associated documents from both MySQL and vector store

        Args:
            db: Database session
            session_id: Session ID to delete
            user_id: Optional user ID for access control

        Returns:
            Success status
        """
        try:
            query = db.query(Conversation).filter(Conversation.session_id == session_id)

            if user_id:
                query = query.filter(Conversation.user_id == user_id)

            conversation = query.first()

            if not conversation:
                logger.warning(f"Conversation {session_id} not found")
                return False

            # Get all documents associated with this conversation
            from db.models import DocumentChunk

            documents = conversation.documents

            # Collect all vector_ids from document chunks to delete from vector store
            vector_ids_to_delete = []
            for document in documents:
                chunks = (
                    db.query(DocumentChunk)
                    .filter(DocumentChunk.document_id == document.id)
                    .all()
                )
                vector_ids_to_delete.extend(
                    [chunk.vector_id for chunk in chunks if chunk.vector_id]
                )

            # Delete from vector store if there are any vectors
            if vector_ids_to_delete:
                try:
                    from services.vector_store import vector_store

                    await vector_store.delete_documents(vector_ids_to_delete)
                    logger.info(
                        f"Deleted {len(vector_ids_to_delete)} vectors from vector store for conversation {session_id}"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to delete vectors from vector store: {str(e)}"
                    )
                    # Continue with database deletion even if vector store deletion fails

            # Delete from database (cascade will handle messages, documents, and chunks)
            db.delete(conversation)
            db.commit()

            logger.info(
                f"Deleted conversation {session_id} with {len(documents)} documents"
            )
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting conversation: {str(e)}", exc_info=True)
            return False

    def create_conversation(
        self, db: Session, user_id: int, title: Optional[str] = None
    ) -> Conversation:
        """
        Create a new conversation for a user

        Args:
            db: Database session
            user_id: User ID
            title: Optional conversation title

        Returns:
            Created conversation
        """
        try:
            session_id = str(uuid.uuid4())
            conversation = Conversation(
                session_id=session_id, user_id=user_id, title=title
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

            logger.info(f"Created conversation {session_id} for user {user_id}")
            return conversation

        except Exception as e:
            db.rollback()
            logger.error(f"Error creating conversation: {str(e)}", exc_info=True)
            raise

    def update_conversation(
        self, db: Session, session_id: str, user_id: int, title: Optional[str] = None
    ) -> Optional[Conversation]:
        """
        Update a conversation's details

        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID for access control
            title: New title

        Returns:
            Updated conversation or None
        """
        try:
            conversation = (
                db.query(Conversation)
                .filter(
                    Conversation.session_id == session_id,
                    Conversation.user_id == user_id,
                )
                .first()
            )

            if not conversation:
                logger.warning(
                    f"Conversation {session_id} not found for user {user_id}"
                )
                return None

            if title is not None:
                conversation.title = title

            conversation.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(conversation)

            logger.info(f"Updated conversation {session_id}")
            return conversation

        except Exception as e:
            db.rollback()
            logger.error(f"Error updating conversation: {str(e)}", exc_info=True)
            return None


# Global conversation service instance
conversation_service = ConversationService()
