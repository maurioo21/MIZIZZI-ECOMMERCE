"""
redis_client.py - Initializes Upstash Redis client using REST API.

This module provides a singleton Redis client that connects to Upstash Redis
using HTTP REST API calls. It works without requiring the upstash-redis SDK.

Environment Variables Required:
    - UPSTASH_REDIS_REST_URL: The Upstash Redis REST API URL
    - UPSTASH_REDIS_REST_TOKEN: The Upstash Redis REST API token

Alternative env vars (Vercel integration):
    - KV_REST_API_URL
    - KV_REST_API_TOKEN

Usage:
    from app.cache.redis_client import get_redis_client, redis_client
    
    # Get the singleton client
    client = get_redis_client()
    
    # Or use the pre-initialized instance
    from app.cache.redis_client import redis_client
"""
import os
import logging
import requests
import json
from typing import Optional, Any, List

logger = logging.getLogger(__name__)

# Track connection state globally
_redis_client = None
_is_connected = False


def get_upstash_credentials() -> tuple[Optional[str], Optional[str]]:
    """
    Retrieve Upstash Redis credentials from environment variables.
    Prioritizes Upstash/Vercel KV over standard Redis URL.
    
    Order of precedence:
    1. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash native)
    2. KV_REST_API_URL + KV_REST_API_TOKEN (Vercel integration)
    3. Returns None if only REDIS_URL is present (that's TCP Redis, not REST API)
    
    Returns:
        tuple: (url, token) or (None, None) if not configured for REST API
    """
    # Check Upstash REST API first (this is what we need)
    url = (
        os.environ.get('UPSTASH_REDIS_REST_URL') or 
        os.environ.get('KV_REST_API_URL')
    )
    token = (
        os.environ.get('UPSTASH_REDIS_REST_TOKEN') or 
        os.environ.get('KV_REST_API_TOKEN')
    )
    
    # If we have REST API credentials, use them
    if url and token:
        logger.info(f"Using Upstash REST API: {url[:50]}...")
        return url, token
    
    # REDIS_URL is for traditional Redis (TCP protocol), not REST API
    # Our module only supports REST API, so we ignore REDIS_URL
    redis_url = os.environ.get('REDIS_URL')
    if redis_url:
        logger.info(
            "REDIS_URL detected but this module requires Upstash REST API. "
            "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for REST API mode."
        )
    
    return None, None


class UpstashRedisClient:
    """
    HTTP-based Upstash Redis client using REST API.
    
    Connects to Upstash Redis without requiring the upstash-redis SDK.
    All commands are sent as HTTP POST requests with proper formatting.
    
    TIMEOUT STRATEGY (DIFFERENTIATED BY OPERATION):
    - GET operations: 500ms timeout (fail-fast for cache misses)
    - SET operations: 2000ms timeout (allow time for large JSON serialization)
    
    This prevents slow cache READS from blocking requests while ensuring
    cache WRITES have enough time to complete.
    """
    
    # Different timeouts for reads vs writes
    # REST API is slower than local Redis, so we use more generous timeouts
    REDIS_TIMEOUT_READ = 3.0   # 3 seconds - REST API requires more time than TCP
    REDIS_TIMEOUT_WRITE = 5.0  # 5 seconds - allow time for large JSON serialization over HTTP
    
    def __init__(self, url: str, token: str):
        """
        Initialize the Upstash Redis client.
        
        Args:
            url: The Upstash Redis REST API URL
            token: The authentication token
        """
        # Ensure URL ends with a slash for consistency
        self.url = url.rstrip('/') + '/'
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def _execute_command(self, *args, **kwargs) -> Any:
        """
        Execute a Redis command via HTTP REST API with appropriate timeout.
        
        Args:
            *args: Redis command and its arguments
            **kwargs: Optional parameters like 'ex' for expiration
        
        Returns:
            The command result on success, None on timeout or error
            
        NOTE: This method NEVER throws - all exceptions are caught and logged.
              None return means "cache miss" or "operation failed" - caller should
              handle gracefully by falling back to database.
        """
        try:
            # Build the command payload
            command = list(args)
            
            # Handle expiration parameter for SET commands
            if kwargs.get('ex') and len(args) >= 2 and args[0].upper() == 'SET':
                # Append EX and TTL to the command: SET key value EX ttl
                command.extend(['EX', str(kwargs['ex'])])
            
            # Determine timeout based on command type
            is_write = len(args) > 0 and args[0].upper() in ('SET', 'DEL', 'INCR', 'APPEND', 'LPUSH', 'HSET')
            timeout = self.REDIS_TIMEOUT_WRITE if is_write else self.REDIS_TIMEOUT_READ
            
            # Send to Upstash REST API with operation-appropriate timeout
            response = requests.post(
                self.url,
                headers=self.headers,
                json=command,
                timeout=timeout
            )
            
            # Check for errors
            if response.status_code != 200:
                logger.warning(
                    f"Redis command failed: {response.status_code} - {response.text[:100]}"
                )
                return None
            
            result = response.json()
            
            # Upstash returns {'result': value}
            if isinstance(result, dict) and 'result' in result:
                return result['result']
            
            return result
            
        except requests.exceptions.Timeout:
            # Log timeout but don't crash - caller will do database fallback
            operation = "write" if (len(args) > 0 and args[0].upper() in ('SET', 'DEL')) else "read"
            timeout_val = self.REDIS_TIMEOUT_WRITE if operation == "write" else self.REDIS_TIMEOUT_READ
            logger.warning(
                f"Redis {operation} timeout ({timeout_val}s) - falling back to database. "
                f"Consider increasing REDIS_TIMEOUT_{operation.upper()} if this persists."
            )
            return None
        except requests.exceptions.RequestException as e:
            # Network errors, connection refused, etc.
            logger.warning(f"Redis HTTP request failed: {type(e).__name__} - falling back")
            return None
        except Exception as e:
            # Catch-all for any other errors
            logger.warning(f"Redis command error: {e} - falling back to database")
            return None
    
    def ping(self) -> bool:
        """Test the connection with PING command."""
        result = self._execute_command('PING')
        return result == 'PONG'
    
    def get(self, key: str) -> Optional[str]:
        """Get a value from Redis."""
        return self._execute_command('GET', key)
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set a value in Redis with optional expiration."""
        result = self._execute_command('SET', key, value, ex=ex)
        return result == 'OK'
    
    def delete(self, key: str) -> int:
        """Delete a key from Redis."""
        result = self._execute_command('DEL', key)
        return result if isinstance(result, int) else 0
    
    def keys(self, pattern: str) -> List[str]:
        """Get all keys matching a pattern."""
        result = self._execute_command('KEYS', pattern)
        return result if isinstance(result, list) else []
    
    def lpush(self, key: str, *values) -> int:
        """Push values to a list."""
        command = ['LPUSH', key] + list(values)
        result = self._execute_command(*command)
        return result if isinstance(result, int) else 0
    
    def lrange(self, key: str, start: int, stop: int) -> List[str]:
        """Get a range of values from a list."""
        result = self._execute_command('LRANGE', key, str(start), str(stop))
        return result if isinstance(result, list) else []
    
    def hset(self, key: str, field: str, value: str) -> int:
        """Set a hash field."""
        result = self._execute_command('HSET', key, field, value)
        return result if isinstance(result, int) else 0
    
    def hgetall(self, key: str) -> dict:
        """Get all fields from a hash."""
        result = self._execute_command('HGETALL', key)
        return result if isinstance(result, dict) else {}
    
    def incr(self, key: str) -> int:
        """Increment a counter."""
        result = self._execute_command('INCR', key)
        return result if isinstance(result, int) else 0


class InMemoryCacheClient:
    """
    Fallback in-memory cache client when Upstash Redis is not configured.
    Provides same interface as UpstashRedisClient for compatibility.
    """
    def __init__(self):
        self.store = {}
        self.ttl_store = {}
        import time
        self.time_func = time.time
        logger.info("In-memory cache client initialized (no Upstash configured)")
    
    def set(self, key: str, value: Any, ex: int = None) -> bool:
        """Set a key with optional TTL"""
        self.store[key] = value
        if ex:
            self.ttl_store[key] = self.time_func() + ex
        return True
    
    def get(self, key: str) -> Optional[Any]:
        """Get a value by key"""
        if key in self.ttl_store and self.time_func() > self.ttl_store[key]:
            del self.store[key]
            del self.ttl_store[key]
            return None
        return self.store.get(key)
    
    def delete(self, *keys: str) -> int:
        """Delete one or more keys"""
        count = 0
        for key in keys:
            if key in self.store:
                del self.store[key]
                if key in self.ttl_store:
                    del self.ttl_store[key]
                count += 1
        return count
    
    def ping(self) -> bool:
        """Check if cache is available"""
        return True
    
    def keys(self, pattern: str = None) -> List[str]:
        """Get all keys, optionally matching a pattern"""
        if not pattern or pattern == "*":
            return list(self.store.keys())
        
        # Simple pattern matching
        import fnmatch
        return [k for k in self.store.keys() if fnmatch.fnmatch(k, pattern)]
    
    def dbsize(self) -> int:
        """Get number of keys in store"""
        return len(self.store)
    
    def flushdb(self) -> bool:
        """Clear all keys"""
        self.store.clear()
        self.ttl_store.clear()
        return True
    
    def info(self) -> dict:
        """Get cache info"""
        return {
            "type": "in-memory",
            "keys": len(self.store),
            "memory_usage": "N/A"
        }


def create_upstash_client():
    """
    Create and return an Upstash Redis client instance.
    Falls back to in-memory cache if Upstash is not configured.
    
    This function attempts to create a connection to Upstash Redis
    and validates it with a ping command. If Upstash credentials are
    not available, returns an in-memory cache client for fallback.
    
    Returns:
        UpstashRedisClient instance, InMemoryCacheClient, or None if connection fails
    """
    global _redis_client, _is_connected
    
    # Return existing client if already connected
    if _redis_client is not None and _is_connected:
        return _redis_client
    
    url, token = get_upstash_credentials()
    
    if not url or not token:
        logger.warning(
            "Upstash Redis credentials not found. "
            "Using in-memory cache client as fallback. "
            "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN "
            "environment variables for persistent distributed caching."
        )
        # Use in-memory fallback instead of returning None
        _redis_client = InMemoryCacheClient()
        _is_connected = True  # Mark as "connected" since fallback is working
        return _redis_client
    
    try:
        # Create the HTTP-based client
        client = UpstashRedisClient(url=url, token=token)
        
        # Test connection with ping
        if client.ping():
            logger.info(f"Upstash Redis connected successfully to {url}")
            _redis_client = client
            _is_connected = True
            return client
        else:
            logger.warning("Upstash Redis ping failed, falling back to in-memory cache")
            _redis_client = InMemoryCacheClient()
            _is_connected = True
            return _redis_client
            
    except Exception as e:
        logger.error(f"Failed to create Upstash Redis client: {e}, using in-memory fallback")
        _redis_client = InMemoryCacheClient()
        _is_connected = True
        return _redis_client


def get_redis_client():
    """
    Get the singleton Upstash Redis client instance.
    
    Returns:
        UpstashRedisClient instance or None if not available
    """
    global _redis_client
    
    if _redis_client is None:
        _redis_client = create_upstash_client()
    
    return _redis_client


def is_redis_connected() -> bool:
    """
    Check if Redis is currently connected.
    
    Returns:
        bool: True if connected to Upstash Redis, False otherwise
    """
    return _is_connected


def close_redis_client():
    """
    Close the Redis client connection and reset state.
    Useful for testing and cleanup.
    """
    global _redis_client, _is_connected
    _redis_client = None
    _is_connected = False
    logger.info("Redis client connection closed")


# Pre-initialize the client on module import
redis_client = create_upstash_client()
