import asyncio
import json
import logging
from datetime import datetime
from typing import List

from db.models import User
from db.session import SessionLocal, get_db
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from middleware.auth_middleware import get_current_active_user
from schemas.schemas import (
    ChainOfThoughtStep,
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    ConversationUpdate,
)
from services.agent_service import agent_service
from services.conversation_service import conversation_service
from services.suggestions_service import suggestions_service
from services.cot_cache_service import cot_cache
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


def save_assistant_message_bg(
    conversation_id: int,
    response_text: str,
    sources: List,
    cot_steps: List,
    suggestions: List,
):
    """
    Background task to save assistant message to database
    Runs independently of the streaming response
    """
    try:
        logger.info(
            f"Background task: Saving assistant message to conversation {conversation_id}"
        )
        db = SessionLocal()
        try:
            conversation_service.add_message(
                db,
                conversation_id,
                role="assistant",
                content=response_text,
                sources=sources,
                chain_of_thought_steps=cot_steps,
                suggestions=suggestions,
            )
            db.commit()
            logger.info(
                f"Background task: Successfully saved assistant message with {len(cot_steps)} CoT steps and {len(suggestions)} suggestions"
            )
        finally:
            db.close()
    except Exception as e:
        logger.error(
            f"Background task: Error saving assistant message: {str(e)}", exc_info=True
        )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Main chat endpoint with agent-based processing
    Handles user queries with web search, document retrieval, and response generation
    Requires authentication
    """
    try:
        logger.info(
            f"Processing chat request from user {current_user.id}: '{request.message[:50]}...'"
        )

        # Create or get conversation
        conversation = conversation_service.create_or_get_conversation(
            db, current_user.id, request.session_id
        )

        # Get conversation history
        conversation_history = []
        if request.conversation_history:
            conversation_history = request.conversation_history
        else:
            conversation_history = conversation_service.get_conversation_history(
                db, conversation.id
            )

        # Add user message
        conversation_service.add_message(
            db, conversation.id, role="user", content=request.message
        )

        # Process query through agent service
        result = await agent_service.process_query(
            query=request.message,
            conversation_history=conversation_history,
            user_id=current_user.id,
            conversation_id=conversation.id,
        )

        # Add assistant message with sources
        conversation_service.add_message(
            db,
            conversation.id,
            role="assistant",
            content=result["response"],
            sources=result.get("sources", []),
        )

        return ChatResponse(
            response=result["response"],
            session_id=conversation.session_id,
            sources=result.get("sources", []),
            metadata=result.get("metadata", {}),
        )

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


async def generate_stream(
    query: str,
    conversation_history,
    use_rag: bool,
    user_id: int,
    conversation_id: int,
    session_id: str,
    save_data: dict,
):
    """
    Generator for streaming chat responses with Chain of Thought steps in real-time
    Populates save_data dict with response info for background saving
    Also updates real-time cache for /latest endpoint
    """
    
    # Initialize cache data structure
    cache_data = {
        "message_id": int(datetime.utcnow().timestamp() * 1000000),  # Temporary ID
        "conversation_id": conversation_id,
        "session_id": session_id,
        "user_query": query,
        "assistant_response": "",
        "cot_steps": [],
        "sources_count": 0,
        "suggestions_count": 0,
        "total_steps": 0,
        "completed_steps": 0,
        "active_step": None,
        "created_at": datetime.utcnow(),
        "last_updated": datetime.utcnow(),
        "processing_time_ms": None,
    }
    
    # Update cache immediately
    cot_cache.update_user_data(user_id, cache_data)

    # Emit first chunk immediately to start the stream
    yield f"data: {json.dumps({'type': 'status', 'data': 'starting'})}\n\n"

    # Use asyncio.Queue for real-time step emission
    step_queue = asyncio.Queue()
    processing_complete = asyncio.Event()
    result_container = {"result": None, "error": None}

    # Track step messages for cumulative updates
    step_messages = {}  # {step_id: [list of description parts]}
    step_counters = {}  # {step_type: counter} for repeating steps

    try:
        # Define callback function to emit CoT steps in real-time
        async def emit_cot_step(
            step_type: str,
            label: str,
            description: str = None,
            status: str = "pending",
            step_id: str = None,
        ):
            """Emit Chain of Thought step immediately to queue and save to list"""
            nonlocal cache_data  # Access parent scope variable
            
            # Generate unique ID for repeating steps (like analyzing_document)
            # or use step_type for unique steps
            if step_id is None:
                if step_type == "analyzing_document":
                    # For repeating steps, use a counter
                    step_counters[step_type] = step_counters.get(step_type, 0) + 1
                    step_id = f"{step_type}_{step_counters[step_type]}"
                else:
                    # For unique steps that update, use step_type as ID
                    step_id = step_type

            # Track messages cumulatively for updateable steps
            if step_type != "analyzing_document":  # Don't cumulate for repeating steps
                if status == "active":
                    # Start a new step, initialize message tracking
                    step_messages[step_id] = [description] if description else []
                elif status == "complete" and step_id in step_messages:
                    # Add completion message to existing messages
                    if description:
                        step_messages[step_id].append(description)
                    # Combine all messages with double newline
                    description = "\n\n".join(step_messages[step_id])
                elif status == "error" and step_id in step_messages:
                    # Add error message
                    if description:
                        step_messages[step_id].append(description)
                    description = "\n\n".join(step_messages[step_id])

            step = ChainOfThoughtStep(
                id=step_id,
                step_type=step_type,
                label=label,
                description=description,
                status=status,
                timestamp=datetime.utcnow(),
            )
            # Save for background task with serializable timestamp
            step_dict = step.model_dump()
            step_dict["timestamp"] = (
                step.timestamp.isoformat()
            )  # Convert datetime to string

            # For saving, update existing step if same id, otherwise append
            existing_step_idx = next(
                (
                    i
                    for i, s in enumerate(save_data["cot_steps"])
                    if s.get("id") == step_id
                ),
                None,
            )
            if existing_step_idx is not None:
                save_data["cot_steps"][existing_step_idx] = step_dict
            else:
                save_data["cot_steps"].append(step_dict)

            # Update cache with new step
            cache_step = {
                "id": step_id,
                "step_type": step_type,
                "label": label,
                "description": description,
                "status": status,
                "timestamp": datetime.utcnow(),
                "duration_ms": None,
                "metadata": {},
            }
            
            # Update or append step in cache
            cache_step_idx = next(
                (i for i, s in enumerate(cache_data["cot_steps"]) if s.get("id") == step_id),
                None,
            )
            if cache_step_idx is not None:
                cache_data["cot_steps"][cache_step_idx] = cache_step
            else:
                cache_data["cot_steps"].append(cache_step)
            
            # Update cache metadata
            cache_data["total_steps"] = len(cache_data["cot_steps"])
            cache_data["completed_steps"] = sum(1 for s in cache_data["cot_steps"] if s["status"] == "complete")
            cache_data["active_step"] = label if status == "active" else None
            cache_data["last_updated"] = datetime.utcnow()
            
            # Push update to cache
            cot_cache.update_user_data(user_id, cache_data)

            await step_queue.put(step)

        # Background task to process query
        async def process_in_background():
            try:
                result = await agent_service.process_query(
                    query=query,
                    conversation_history=conversation_history,
                    user_id=user_id,
                    conversation_id=conversation_id,
                    emit_callback=emit_cot_step,
                )
                result_container["result"] = result
            except Exception as e:
                result_container["error"] = str(e)
                logger.error(f"Error in background processing: {str(e)}", exc_info=True)
            finally:
                processing_complete.set()

        # Start background processing
        background_task = asyncio.create_task(process_in_background())

        # Stream CoT steps as they arrive
        step_count = 0
        while not processing_complete.is_set() or not step_queue.empty():
            try:
                # Wait for next step with timeout
                step = await asyncio.wait_for(step_queue.get(), timeout=0.1)
                step_count += 1
                chunk = {"type": "cot_step", "data": step.model_dump()}
                yield f"data: {json.dumps(chunk, default=str)}\n\n"
            except asyncio.TimeoutError:
                # No step available, continue waiting
                continue

        # Ensure background task is complete
        await background_task

        # Check for errors
        if result_container["error"]:
            error_chunk = {"type": "error", "data": result_container["error"]}
            yield f"data: {json.dumps(error_chunk)}\n\n"
            return

        result = result_container["result"]
        response_text = result["response"]

        # Populate save_data for background task
        save_data["response_text"] = response_text
        save_data["sources"] = result.get("sources", [])
        # Initialize suggestions list (will be populated later)
        save_data["suggestions"] = []

        # Stream response content (character by character to preserve markdown formatting)
        # Stream in small chunks (5 chars at a time) for smooth typing effect while preserving newlines
        chunk_size = 5
        total_chunks = (len(response_text) + chunk_size - 1) // chunk_size
        logger.info(f"[STREAMING] Starting to stream response of {len(response_text)} characters in {total_chunks} chunks")
        
        chunk_count = 0
        for i in range(0, len(response_text), chunk_size):
            text_chunk = response_text[i : i + chunk_size]
            chunk = {"type": "content", "data": text_chunk}
            yield f"data: {json.dumps(chunk)}\n\n"
            
            # Update cache with response chunk
            cache_data["assistant_response"] += text_chunk
            cache_data["last_updated"] = datetime.utcnow()
            cot_cache.update_user_data(user_id, cache_data)
            
            chunk_count += 1
            # Log every 100 chunks to see progress
            if chunk_count % 100 == 0 or chunk_count == total_chunks:
                logger.info(f"[STREAMING] Progress: {chunk_count}/{total_chunks} chunks, cache has {len(cache_data['assistant_response'])} characters")
            
            await asyncio.sleep(0.01)  # Faster sleep since chunks are smaller
        
        logger.info(f"[STREAMING] Finished streaming response, cache now has {len(cache_data['assistant_response'])} characters")

        # Send sources
        if result.get("sources"):
            sources_chunk = {
                "type": "sources",
                "data": [s.model_dump() for s in result["sources"]],
            }
            yield f"data: {json.dumps(sources_chunk)}\n\n"
            
            # Update cache with sources
            cache_data["sources_count"] = len(result["sources"])
            cache_data["last_updated"] = datetime.utcnow()
            cot_cache.update_user_data(user_id, cache_data)

        # Generate suggestions
        try:
            logger.info(
                f"Starting suggestions generation for conversation {conversation_id}"
            )
            suggestions = await suggestions_service.generate_suggestions(
                conversation_history=conversation_history
                + [
                    {"role": "user", "content": query},
                    {"role": "assistant", "content": response_text},
                ],
                emit_callback=emit_cot_step,
            )

            # Emit any remaining CoT steps from suggestions
            while not step_queue.empty():
                step = await step_queue.get()
                chunk = {"type": "cot_step", "data": step.model_dump()}
                yield f"data: {json.dumps(chunk, default=str)}\n\n"

            if suggestions:
                # Save suggestions for background task
                save_data["suggestions"] = suggestions
                suggestions_chunk = {"type": "suggestions", "data": suggestions}
                yield f"data: {json.dumps(suggestions_chunk)}\n\n"
                
                # Update cache with suggestions
                cache_data["suggestions_count"] = len(suggestions)
                cache_data["last_updated"] = datetime.utcnow()
                cot_cache.update_user_data(user_id, cache_data)
                
                logger.info(f"Sent {len(suggestions)} suggestions")
        except Exception as e:
            logger.error(f"Error generating suggestions: {str(e)}", exc_info=True)

        # Calculate final processing time
        if cache_data["cot_steps"]:
            first_step = cache_data["cot_steps"][0]
            last_step = cache_data["cot_steps"][-1]
            cache_data["processing_time_ms"] = (
                (last_step["timestamp"] - first_step["timestamp"]).total_seconds() * 1000
            )
            cot_cache.update_user_data(user_id, cache_data)

        # Send done signal
        done_chunk = {"type": "done", "data": None}
        yield f"data: {json.dumps(done_chunk)}\n\n"

    except Exception as e:
        logger.error(f"Error in generate_stream: {str(e)}", exc_info=True)
        error_chunk = {"type": "error", "data": str(e)}
        yield f"data: {json.dumps(error_chunk)}\n\n"


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Streaming chat endpoint
    Requires authentication
    Uses BackgroundTasks to save message after streaming completes
    """
    try:
        logger.info(
            f"Stream request from user {current_user.id}: {request.message[:50]}..."
        )

        # Create or get conversation
        conversation = conversation_service.create_or_get_conversation(
            db, current_user.id, request.session_id
        )
        logger.info(
            f"Using conversation {conversation.id}, session {conversation.session_id}"
        )

        # Get conversation history
        conversation_history = []
        if request.conversation_history:
            conversation_history = request.conversation_history
        else:
            conversation_history = conversation_service.get_conversation_history(
                db, conversation.id
            )

        # Add user message
        conversation_service.add_message(
            db, conversation.id, role="user", content=request.message
        )

        # Extract values BEFORE creating generator (to avoid detached instances)
        user_id = current_user.id
        conversation_db_id = conversation.id
        session_id = conversation.session_id

        # Container to collect data for background save
        save_data = {
            "response_text": None,
            "sources": [],
            "cot_steps": [],
            "suggestions": [],
        }

        async def generate_with_save():
            """Wrapper generator that collects data and schedules background save"""
            try:
                async for chunk in generate_stream(
                    request.message,
                    conversation_history,
                    request.use_rag,
                    user_id,
                    conversation_db_id,
                    session_id,
                    save_data,
                ):
                    yield chunk
            except Exception as e:
                logger.error(f"Error in generate_with_save: {str(e)}", exc_info=True)
                raise

            # Schedule background save after generator completes
            if save_data["response_text"]:
                background_tasks.add_task(
                    save_assistant_message_bg,
                    conversation_db_id,
                    save_data["response_text"],
                    save_data["sources"],
                    save_data["cot_steps"],
                    save_data["suggestions"],
                )
                logger.info(
                    f"Scheduled background save for conversation {conversation_db_id}"
                )

        response = StreamingResponse(
            generate_with_save(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",  # Critical for Nginx Ingress streaming
            },
        )
        return response

    except Exception as e:
        logger.error(f"Error in streaming chat: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Streaming chat failed: {str(e)}")


@router.get("/conversations", response_model=List[ConversationSummary])
def list_conversations(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List all conversations for the current user
    Requires authentication
    """
    try:
        conversations = conversation_service.list_conversations(
            db, current_user.id, skip, limit
        )
        return conversations
    except Exception as e:
        logger.error(f"Error listing conversations: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to list conversations: {str(e)}"
        )


@router.post("/conversations", response_model=ConversationSummary)
def create_new_conversation(
    request: ConversationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create a new conversation for the current user
    Requires authentication
    """
    try:
        conversation = conversation_service.create_conversation(
            db, current_user.id, request.title
        )

        # Return as summary
        return ConversationSummary(
            id=conversation.id,
            user_id=conversation.user_id,
            session_id=conversation.session_id,
            title=conversation.title,
            message_count=0,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )
    except Exception as e:
        logger.error(f"Error creating conversation: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create conversation: {str(e)}"
        )


@router.get("/conversations/{session_id}", response_model=ConversationDetail)
def get_conversation(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific conversation with all messages
    Requires authentication and ownership
    """
    try:
        conversation = conversation_service.get_conversation_detail(
            db, session_id, current_user.id
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get conversation: {str(e)}"
        )


@router.put("/conversations/{session_id}", response_model=ConversationSummary)
def update_conversation(
    session_id: str,
    request: ConversationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update a conversation (e.g., change title)
    Requires authentication and ownership
    """
    try:
        conversation = conversation_service.update_conversation(
            db, session_id, current_user.id, request.title
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Get message count
        from db.models import Message

        message_count = (
            db.query(Message).filter(Message.conversation_id == conversation.id).count()
        )

        return ConversationSummary(
            id=conversation.id,
            user_id=conversation.user_id,
            session_id=conversation.session_id,
            title=conversation.title,
            message_count=message_count,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating conversation: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update conversation: {str(e)}"
        )


@router.delete("/conversations/{session_id}")
async def delete_conversation(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete a conversation, all its messages, and associated documents
    This also removes embeddings from the vector store
    Requires authentication and ownership
    """
    try:
        success = await conversation_service.delete_conversation(
            db, session_id, current_user.id
        )
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {
            "message": "Conversation deleted successfully",
            "session_id": session_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete conversation: {str(e)}"
        )
