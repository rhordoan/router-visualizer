import logging
from typing import Optional

from db.models import User
from fastapi import APIRouter, Depends
from middleware.auth_middleware import get_current_active_user
from schemas.schemas import CoTStepWithMetadata, MessageCoTSnapshot
from services.cot_cache_service import cot_cache

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/realtime/latest", response_model=Optional[MessageCoTSnapshot])
def get_latest_cot_message():
    """
    Get the most recent Chain-of-Thought message from real-time cache
    Optimized for very frequent polling (every second)
    
    NOTE: This endpoint is intentionally unprotected for Blueprint Visualizer demo.
    It returns the latest message from ANY user for visualization purposes.
    """
    try:
        # Get the most recent cached data from any user (for demo purposes)
        cached_data = cot_cache.get_latest_data()
        
        if not cached_data:
            logger.info("[/latest] No cached data available")
            return None
        
        # Convert cache data to CoTStepWithMetadata objects
        cot_steps = [
            CoTStepWithMetadata(**step) for step in cached_data.get("cot_steps", [])
        ]
        
        assistant_response = cached_data.get("assistant_response", "")
        response_length = len(assistant_response) if assistant_response else 0
        
        logger.info(f"[/latest POLL] Response: {response_length} chars, Steps: {len(cot_steps)}, Message ID: {cached_data['message_id']}")
        
        # Build MessageCoTSnapshot from cached data
        return MessageCoTSnapshot(
            message_id=cached_data["message_id"],
            conversation_id=cached_data["conversation_id"],
            session_id=cached_data["session_id"],
            user_query=cached_data["user_query"],
            assistant_response=cached_data.get("assistant_response"),
            cot_steps=cot_steps,
            sources_count=cached_data.get("sources_count", 0),
            suggestions_count=cached_data.get("suggestions_count", 0),
            total_steps=cached_data.get("total_steps", 0),
            completed_steps=cached_data.get("completed_steps", 0),
            active_step=cached_data.get("active_step"),
            created_at=cached_data["created_at"],
            last_updated=cached_data.get("last_updated", cached_data["created_at"]),
            processing_time_ms=cached_data.get("processing_time_ms"),
        )

    except Exception as e:
        logger.error(f"Error getting latest CoT from cache: {str(e)}", exc_info=True)
        return None


@router.get("/realtime/cache-stats")
def get_cache_stats(
    current_user: User = Depends(get_current_active_user),
):
    """Get cache statistics for monitoring"""
    stats = cot_cache.get_stats()
    return {
        "cache_stats": stats,
        "description": "Real-time CoT cache statistics",
    }




