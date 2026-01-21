from typing import Optional, Any, Callable
from cachetools import TTLCache
from functools import wraps
import hashlib
import logging
import json

from config import config

logger = logging.getLogger(__name__)


class CacheManager:
    """In-memory cache manager with TTL support"""

    def __init__(self, maxsize: int = 1000, ttl: int = None):
        self.ttl = ttl or config.CACHE_TTL
        self._cache = TTLCache(maxsize=maxsize, ttl=self.ttl)

    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache"""
        return self._cache.get(key)

    def set(self, key: str, value: Any) -> None:
        """Set a value in cache"""
        self._cache[key] = value

    def delete(self, key: str) -> None:
        """Delete a value from cache"""
        self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear all cache entries"""
        self._cache.clear()

    @staticmethod
    def make_key(*args, **kwargs) -> str:
        """Generate a cache key from arguments"""
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
        return hashlib.md5(key_data.encode()).hexdigest()


# Global cache instance
cache_manager = CacheManager()


def cached(ttl: Optional[int] = None):
    """Decorator to cache function results"""

    def decorator(func: Callable):
        local_cache = TTLCache(maxsize=100, ttl=ttl or config.CACHE_TTL)

        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = CacheManager.make_key(func.__name__, *args, **kwargs)

            # Check cache
            if key in local_cache:
                logger.debug(f"Cache hit for {func.__name__}")
                return local_cache[key]

            # Execute function
            result = await func(*args, **kwargs)

            # Store in cache
            local_cache[key] = result
            logger.debug(f"Cache miss for {func.__name__}, stored result")

            return result

        return wrapper

    return decorator
