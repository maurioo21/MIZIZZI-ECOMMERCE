"""
Redis Cache Management Module - Production-Ready
Handles all caching operations for product data with TTL management
"""

import json
import time
from typing import Optional, Dict, Any, List
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class CacheConfig:
    """Cache configuration with dynamic TTL based on product type"""
    
    # Cache TTL constants (in seconds)
    PRODUCT_DETAIL_FRESH = 600          # 10 minutes
    PRODUCT_DETAIL_SALE = 120           # 2 minutes
    PRODUCT_DETAIL_FLASH = 60           # 1 minute
    PRODUCT_DETAIL_FEATURED = 1800      # 30 minutes
    RELATED_PRODUCTS = 3600             # 1 hour
    INVENTORY_STATUS = 30               # 30 seconds
    REVIEW_SUMMARY = 300                # 5 minutes
    CATEGORY_DATA = 3600                # 1 hour
    BRAND_DATA = 3600                   # 1 hour
    
    # Cache key prefixes
    PRODUCT_DETAIL_PREFIX = "pd:"
    INVENTORY_PREFIX = "inv:"
    RELATED_PREFIX = "rel:"
    REVIEW_PREFIX = "rev:"
    CATEGORY_PREFIX = "cat:"
    
    @staticmethod
    def get_product_ttl(product_data: Dict) -> int:
        """Determine TTL based on product characteristics"""
        if product_data.get('is_flash_sale'):
            return CacheConfig.PRODUCT_DETAIL_FLASH
        elif product_data.get('is_sale'):
            return CacheConfig.PRODUCT_DETAIL_SALE
        elif product_data.get('is_featured'):
            return CacheConfig.PRODUCT_DETAIL_FEATURED
        return CacheConfig.PRODUCT_DETAIL_FRESH


class RedisProductCache:
    """Redis cache manager for product operations"""
    
    def __init__(self, redis_client):
        """
        Initialize cache manager
        
        Args:
            redis_client: Redis client instance from Upstash or local Redis
        """
        self.redis = redis_client
        self.prefix = CacheConfig.PRODUCT_DETAIL_PREFIX
        self.hits = 0
        self.misses = 0
    
    def _build_key(self, product_id: int, key_type: str = "detail", 
                   variant_id: Optional[int] = None, extra: Optional[str] = None) -> str:
        """Build consistent cache key"""
        if variant_id and extra:
            return f"{self.prefix}{key_type}:{product_id}:{variant_id}:{extra}"
        elif variant_id:
            return f"{self.prefix}{key_type}:{product_id}:{variant_id}"
        elif extra:
            return f"{self.prefix}{key_type}:{product_id}:{extra}"
        return f"{self.prefix}{key_type}:{product_id}"
    
    def get(self, product_id: int, key_type: str = "detail", 
            variant_id: Optional[int] = None) -> Optional[Dict]:
        """
        Get cached product data
        
        Returns:
            Cached data dict or None if not found/expired
        """
        key = self._build_key(product_id, key_type, variant_id)
        try:
            data = self.redis.get(key)
            if data:
                self.hits += 1
                return json.loads(data) if isinstance(data, str) else json.loads(data.decode())
            self.misses += 1
            return None
        except Exception as e:
            logger.warning(f"Cache GET error for {key}: {e}")
            self.misses += 1
            return None
    
    def set(self, product_id: int, data: Dict, ttl: int, 
            key_type: str = "detail", variant_id: Optional[int] = None) -> bool:
        """
        Cache product data with TTL
        
        Args:
            product_id: Product ID
            data: Data to cache
            ttl: Time to live in seconds
            key_type: Type of cache key (detail, inventory, etc.)
            variant_id: Optional variant ID for variant-specific caching
        
        Returns:
            True if successful
        """
        key = self._build_key(product_id, key_type, variant_id)
        try:
            self.redis.setex(key, ttl, json.dumps(data))
            return True
        except Exception as e:
            logger.error(f"Cache SET error for {key}: {e}")
            return False
    
    def get_with_fallback(self, product_id: int, fetch_fn, ttl: int,
                         key_type: str = "detail") -> Optional[Dict]:
        """
        Get from cache or fetch from function if not cached
        
        Args:
            product_id: Product ID
            fetch_fn: Function to call if cache miss
            ttl: TTL for caching result
            key_type: Cache key type
        
        Returns:
            Cached or freshly fetched data
        """
        # Try cache
        cached = self.get(product_id, key_type)
        if cached:
            cached['_cache_hit'] = True
            return cached
        
        # Cache miss - fetch fresh data
        result = fetch_fn(product_id)
        if result:
            self.set(product_id, result, ttl, key_type)
            result['_cache_hit'] = False
        
        return result
    
    def invalidate(self, product_id: int, pattern: str = "detail:*") -> int:
        """
        Invalidate cache for a product
        
        Args:
            product_id: Product ID to invalidate
            pattern: Pattern of keys to invalidate
        
        Returns:
            Number of keys deleted
        """
        try:
            keys = self.redis.keys(f"{self.prefix}{pattern}:{product_id}*")
            if keys:
                count = self.redis.delete(*keys)
                logger.info(f"Invalidated {count} cache keys for product {product_id}")
                return count
            return 0
        except Exception as e:
            logger.error(f"Cache INVALIDATE error: {e}")
            return 0
    
    def invalidate_related(self, category_id: int) -> int:
        """Invalidate all related products for a category"""
        try:
            keys = self.redis.keys(f"{self.prefix}related:*:{category_id}")
            if keys:
                return self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache INVALIDATE_RELATED error: {e}")
            return 0
    
    def get_ttl_remaining(self, product_id: int, key_type: str = "detail") -> int:
        """
        Get remaining TTL for a cache entry
        
        Returns:
            TTL in seconds, -1 if no expiry, -2 if doesn't exist
        """
        key = self._build_key(product_id, key_type)
        try:
            return self.redis.ttl(key)
        except Exception as e:
            logger.warning(f"Cache TTL check error: {e}")
            return -2
    
    def clear_all(self) -> int:
        """Clear all product cache (dangerous - use cautiously)"""
        try:
            keys = self.redis.keys(f"{self.prefix}*")
            if keys:
                return self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache CLEAR_ALL error: {e}")
            return 0
    
    def get_stats(self) -> Dict:
        """Get cache statistics"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        
        return {
            'hits': self.hits,
            'misses': self.misses,
            'total_requests': total,
            'hit_rate': hit_rate,
            'efficiency': f"{hit_rate:.1f}%"
        }


class CacheInvalidationManager:
    """Manage cache invalidation for all product operations"""
    
    def __init__(self, cache: RedisProductCache, logger=None):
        self.cache = cache
        self.logger = logger or logging.getLogger(__name__)
    
    def on_product_update(self, product_id: int):
        """Called when product is updated"""
        self.cache.invalidate(product_id)
        self.logger.info(f"Cache invalidated for product {product_id}")
    
    def on_product_delete(self, product_id: int):
        """Called when product is deleted"""
        self.cache.invalidate(product_id, pattern="*")
        self.logger.info(f"Cache cleared for deleted product {product_id}")
    
    def on_inventory_change(self, product_id: int):
        """Called when inventory changes - invalidate inventory cache only"""
        key = f"{CacheConfig.INVENTORY_PREFIX}{product_id}"
        self.cache.redis.delete(key)
        self.logger.info(f"Inventory cache invalidated for product {product_id}")
    
    def on_price_change(self, product_id: int):
        """Called when price changes - invalidate product detail cache"""
        self.cache.invalidate(product_id, pattern="detail")
        self.logger.info(f"Detail cache invalidated for product {product_id} (price change)")
    
    def on_review_added(self, product_id: int):
        """Called when new review is added"""
        self.cache.redis.delete(f"{CacheConfig.REVIEW_PREFIX}{product_id}")
        self.cache.invalidate(product_id, pattern="detail")
        self.logger.info(f"Review cache invalidated for product {product_id}")
    
    def on_variant_change(self, product_id: int, variant_id: int):
        """Called when product variant changes"""
        self.cache.invalidate(product_id, pattern="detail")
        self.logger.info(f"Variant cache invalidated for product {product_id}")
    
    def on_category_update(self, category_id: int):
        """Called when category is updated"""
        self.cache.invalidate_related(category_id)
        self.logger.info(f"Related products cache invalidated for category {category_id}")
    
    def schedule_bulk_invalidation(self, product_ids: List[int]):
        """Schedule invalidation for multiple products"""
        for product_id in product_ids:
            self.cache.invalidate(product_id)
        self.logger.info(f"Bulk invalidated {len(product_ids)} product caches")


def cache_product_data(ttl_func=None):
    """
    Decorator for automatic cache management on functions
    
    Usage:
        @cache_product_data(ttl_func=lambda p: CacheConfig.get_product_ttl(p))
        def get_product_details(product_id):
            return fetch_from_db(product_id)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(product_id, *args, **kwargs):
            cache_client = kwargs.get('cache_client')
            
            if not cache_client:
                return func(product_id, *args, **kwargs)
            
            # Try cache first
            cached = cache_client.get(product_id)
            if cached:
                cached['_cache_hit'] = True
                return cached
            
            # Execute function
            result = func(product_id, *args, **kwargs)
            
            # Cache result
            if result and result.get('success'):
                ttl = ttl_func(result['data']) if ttl_func else CacheConfig.PRODUCT_DETAIL_FRESH
                cache_client.set(product_id, result, ttl)
                result['_cache_hit'] = False
            
            return result
        
        return wrapper
    return decorator
