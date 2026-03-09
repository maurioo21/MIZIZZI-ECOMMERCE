"""
Cache Invalidation Service
Handles all cache invalidation operations with safety checks and rate limiting
"""

import logging
import redis
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from functools import wraps
from flask import request, g
from app.config.cache_groups import (
    CACHE_GROUPS,
    ALLOWED_PATTERNS,
    RATE_LIMIT_CONFIG,
    INVALIDATION_TIMEOUT,
    REDIS_SCAN_CONFIG,
    get_cache_group_patterns,
    validate_pattern,
)

logger = logging.getLogger(__name__)


class RateLimitError(Exception):
    """Raised when rate limit is exceeded"""
    pass


class InvalidPatternError(Exception):
    """Raised when an invalid pattern is provided"""
    pass


def rate_limit_cache_operations(f):
    """
    Decorator to rate limit cache invalidation operations
    Max 10 requests per minute per admin user
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not RATE_LIMIT_CONFIG["enabled"]:
            return f(*args, **kwargs)

        # Get admin user ID from JWT token (if available)
        from flask_jwt_extended import get_jwt_identity
        admin_id = get_jwt_identity()
        
        if not admin_id:
            return f(*args, **kwargs)

        # Try to get Redis connection for rate limiting
        try:
            import redis
            import os
            
            # Get Redis URL from environment
            redis_url = os.environ.get('REDIS_URL') or os.environ.get('UPSTASH_REDIS_REST_URL')
            
            redis_conn = None
            if redis_url and redis_url.startswith(('redis://', 'rediss://')):
                redis_conn = redis.from_url(redis_url, decode_responses=True)
            else:
                # Try local Redis for development
                try:
                    redis_conn = redis.StrictRedis(host='localhost', port=6379, db=0, decode_responses=True)
                    redis_conn.ping()  # Test connection
                except:
                    redis_conn = None
            
            if redis_conn is None:
                logger.warning("Redis not available for rate limiting - operation proceeding without rate limit check")
                return f(*args, **kwargs)

            # Create rate limit key
            window_start = datetime.utcnow() - timedelta(seconds=RATE_LIMIT_CONFIG["window_seconds"])
            rate_limit_key = f"cache_invalidation_rate_limit:{admin_id}"

            # Increment counter
            current_count = redis_conn.incr(rate_limit_key)
            
            # Set expiration on first increment
            if current_count == 1:
                redis_conn.expire(rate_limit_key, RATE_LIMIT_CONFIG["window_seconds"])

            # Check if limit exceeded
            if current_count > RATE_LIMIT_CONFIG["max_requests"]:
                raise RateLimitError(
                    f"Rate limit exceeded. Max {RATE_LIMIT_CONFIG['max_requests']} "
                    f"requests per {RATE_LIMIT_CONFIG['window_seconds']} seconds"
                )

            return f(*args, **kwargs)

        except RateLimitError:
            raise  # Re-raise rate limit errors
        except Exception as e:
            logger.error(f"Rate limit check failed: {str(e)}")
            # If rate limiting fails, allow the operation to proceed
            return f(*args, **kwargs)

    return decorated_function


class CacheInvalidationService:
    """Service for managing cache invalidation operations"""

    def __init__(self, redis_connection: Optional[redis.Redis] = None):
        self.redis = redis_connection
        self.timeout = INVALIDATION_TIMEOUT

    @staticmethod
    def log_invalidation(
        admin_id: Optional[int],
        admin_name: Optional[str],
        action: str,
        cache_groups: List[str],
        redis_patterns: List[str],
        keys_deleted: int,
        status: str,
        error_message: Optional[str] = None,
    ) -> Dict:
        """
        Log cache invalidation operation to database
        This is called after successful DB commit
        """
        try:
            from app.models.cache_invalidation_log import CacheInvalidationLog
            from app.configuration.extensions import db

            # Get IP address
            ip_address = request.remote_addr if request else None
            user_agent = request.headers.get("User-Agent") if request else None

            log_entry = CacheInvalidationLog(
                admin_id=admin_id,
                admin_name=admin_name,
                action=action,
                cache_groups=cache_groups,
                redis_patterns=redis_patterns,
                keys_deleted=keys_deleted,
                status=status,
                error_message=error_message,
                ip_address=ip_address,
                user_agent=user_agent,
            )

            db.session.add(log_entry)
            db.session.commit()

            logger.info(
                f"Cache invalidation logged: action={action}, groups={cache_groups}, "
                f"status={status}, keys_deleted={keys_deleted}"
            )

            return log_entry.to_dict()

        except Exception as e:
            logger.error(f"Failed to log cache invalidation: {str(e)}")
            return {
                "error": "Failed to log operation",
                "message": str(e),
            }

    def scan_delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern using Redis SCAN
        Returns number of keys deleted
        """
        if not self.redis:
            logger.warning("Redis connection not available")
            return 0

        if not validate_pattern(pattern):
            raise InvalidPatternError(f"Pattern {pattern} is not whitelisted")

        deleted_count = 0
        cursor = 0
        batch_size = REDIS_SCAN_CONFIG["batch_size"]

        try:
            while True:
                # Use SCAN to iterate over keys matching pattern
                cursor, keys = self.redis.scan(
                    cursor=cursor,
                    match=pattern,
                    count=batch_size,
                    _type=None
                )

                if keys:
                    # Delete keys in a pipeline
                    pipe = self.redis.pipeline()
                    for key in keys:
                        pipe.delete(key)
                    pipe.execute()
                    deleted_count += len(keys)

                # Exit loop when cursor returns to 0
                if cursor == 0:
                    break

            logger.info(f"Deleted {deleted_count} keys matching pattern: {pattern}")
            return deleted_count

        except Exception as e:
            logger.error(f"Error deleting pattern {pattern}: {str(e)}")
            raise

    def invalidate_single_pattern(self, pattern: str) -> Tuple[bool, int, str]:
        """
        Invalidate a single cache pattern
        Returns (success, deleted_count, message)
        """
        try:
            if not validate_pattern(pattern):
                return False, 0, f"Invalid pattern: {pattern}"

            deleted_count = self.scan_delete_pattern(pattern)
            return True, deleted_count, f"Deleted {deleted_count} keys for pattern: {pattern}"

        except InvalidPatternError as e:
            return False, 0, str(e)
        except Exception as e:
            logger.error(f"Error invalidating pattern {pattern}: {str(e)}")
            return False, 0, str(e)

    def invalidate_group(self, group_type: str) -> Tuple[bool, Dict]:
        """
        Invalidate all caches in a group
        Returns (success, result_dict)
        """
        try:
            patterns = get_cache_group_patterns(group_type)
            total_deleted = 0
            failed_patterns = []

            for pattern in patterns:
                try:
                    deleted = self.scan_delete_pattern(pattern)
                    total_deleted += deleted
                except Exception as e:
                    logger.error(f"Failed to delete pattern {pattern}: {str(e)}")
                    failed_patterns.append(pattern)

            status = "success" if not failed_patterns else "partial"
            message = f"Invalidated group '{group_type}' - deleted {total_deleted} keys"
            if failed_patterns:
                message += f" ({len(failed_patterns)} patterns failed)"

            return True, {
                "group": group_type,
                "patterns": patterns,
                "deleted_count": total_deleted,
                "failed_patterns": failed_patterns,
                "status": status,
                "message": message,
            }

        except ValueError as e:
            return False, {"error": str(e), "message": f"Invalid group: {group_type}"}
        except Exception as e:
            logger.error(f"Error invalidating group {group_type}: {str(e)}")
            return False, {"error": str(e), "message": "Failed to invalidate group"}

    def invalidate_all(self) -> Tuple[bool, Dict]:
        """
        Invalidate all caches
        Returns (success, result_dict)
        """
        try:
            total_deleted = 0

            # Invalidate all groups
            for group_type in CACHE_GROUPS.keys():
                success, result = self.invalidate_group(group_type)
                if success:
                    total_deleted += result.get("deleted_count", 0)

            return True, {
                "total_deleted": total_deleted,
                "message": f"Invalidated all caches - deleted {total_deleted} keys",
            }

        except Exception as e:
            logger.error(f"Error invalidating all caches: {str(e)}")
            return False, {"error": str(e), "message": "Failed to invalidate all caches"}

    def rebuild_caches(self) -> Tuple[bool, Dict]:
        """
        Rebuild cache data from database
        This is where you call homepage service methods to warm up cache
        Returns (success, result_dict)
        """
        try:
            # First clear existing caches
            self.invalidate_all()

            # Import homepage services and rebuild
            from app.services.homepage import (
                get_homepage_feature_cards,
                get_homepage_carousel,
                get_homepage_categories,
            )

            rebuilt_services = []

            try:
                get_homepage_feature_cards()
                rebuilt_services.append("feature_cards")
            except Exception as e:
                logger.error(f"Failed to rebuild feature_cards: {str(e)}")

            try:
                get_homepage_carousel()
                rebuilt_services.append("carousel")
            except Exception as e:
                logger.error(f"Failed to rebuild carousel: {str(e)}")

            try:
                get_homepage_categories()
                rebuilt_services.append("categories")
            except Exception as e:
                logger.error(f"Failed to rebuild categories: {str(e)}")

            message = f"Rebuilt caches for: {', '.join(rebuilt_services)}"
            return True, {
                "rebuilt_services": rebuilt_services,
                "message": message,
            }

        except Exception as e:
            logger.error(f"Error rebuilding caches: {str(e)}")
            return False, {"error": str(e), "message": "Failed to rebuild caches"}

    def get_status(self) -> Dict:
        """
        Get current Redis connection status and cache metrics
        """
        try:
            if not self.redis:
                return {
                    "connected": False,
                    "error": "Redis connection not available",
                }

            # Test connection
            self.redis.ping()

            # Get memory info
            info = self.redis.info("memory")
            memory_usage = info.get("used_memory", 0)

            # Count keys in database
            keys_count = self.redis.dbsize()

            return {
                "connected": True,
                "memory_usage": memory_usage,
                "keys_count": keys_count,
                "last_updated": datetime.utcnow().isoformat(),
                "cache_groups": [
                    {
                        "group": group_type,
                        "patterns": patterns,
                        "count": len(patterns),
                    }
                    for group_type, group_info in CACHE_GROUPS.items()
                    for patterns in [group_info["patterns"]]
                ],
            }

        except Exception as e:
            logger.error(f"Error getting cache status: {str(e)}")
            return {
                "connected": False,
                "error": str(e),
            }
