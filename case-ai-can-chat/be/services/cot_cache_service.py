"""
Real-time CoT Cache Service
In-memory buffer for streaming Chain-of-Thought data
"""

import logging
from datetime import datetime
from typing import Dict, Optional
from threading import Lock

logger = logging.getLogger(__name__)


class CoTCacheService:
    """
    Thread-safe in-memory cache for real-time CoT streaming data
    Stores latest message per user for instant /latest endpoint access
    """

    def __init__(self):
        self._cache: Dict[int, Dict] = {}  # user_id -> MessageCoTSnapshot dict
        self._lock = Lock()
        logger.info("✅ CoT Cache Service initialized")

    def update_user_data(self, user_id: int, data: Dict) -> None:
        """
        Update cached data for a user
        Data should match MessageCoTSnapshot structure
        """
        with self._lock:
            self._cache[user_id] = {
                **data,
                "last_updated": datetime.utcnow(),
            }
            response_len = len(data.get("assistant_response", ""))
            steps_count = len(data.get("cot_steps", []))
            logger.info(f"[CACHE UPDATE] User {user_id} - Response: {response_len} chars, Steps: {steps_count}")

    def get_user_data(self, user_id: int) -> Optional[Dict]:
        """
        Get cached data for a user
        Returns None if no data exists
        """
        with self._lock:
            return self._cache.get(user_id)

    def get_latest_data(self) -> Optional[Dict]:
        """
        Get the most recent cached data from ANY user
        Useful for demo/visualization purposes
        Returns None if no data exists
        """
        with self._lock:
            if not self._cache:
                return None
            
            # Get the most recently updated entry
            latest_entry = max(
                self._cache.values(),
                key=lambda x: x.get("last_updated", datetime.min),
                default=None
            )
            return latest_entry

    def clear_user_data(self, user_id: int) -> None:
        """Clear cached data for a user"""
        with self._lock:
            if user_id in self._cache:
                del self._cache[user_id]
                logger.debug(f"🗑️ Cleared cache for user {user_id}")

    def get_stats(self) -> Dict:
        """Get cache statistics"""
        with self._lock:
            return {
                "cached_users": len(self._cache),
                "total_entries": len(self._cache),
            }


# Global singleton instance
cot_cache = CoTCacheService()
