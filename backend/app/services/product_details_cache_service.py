"""
Product Details Cache Invalidation Service
Handles Redis cache invalidation for product details, images, and related products.
Integrates with Upstash Redis for efficient cache management.
"""
from typing import List, Optional, Dict, Any
from flask import current_app
import json

from app.utils.redis_cache import product_cache, safe_cache_get, safe_cache_set


class ProductDetailsCacheService:
    """Service for managing product details cache lifecycle."""
    
    # Cache key patterns
    DETAIL_KEY_PATTERN = "product:detail:{}"
    IMAGES_KEY_PATTERN = "product:images:{}"
    RELATED_KEY_PATTERN = "product:related:{}:{}"
    
    # TTL values (in seconds)
    DETAIL_TTL = 15 * 60  # 15 minutes
    IMAGES_TTL = 30 * 60  # 30 minutes
    RELATED_TTL = 10 * 60  # 10 minutes
    
    @staticmethod
    def get_detail_key(product_id: int) -> str:
        """Get cache key for product details."""
        return ProductDetailsCacheService.DETAIL_KEY_PATTERN.format(product_id)
    
    @staticmethod
    def get_images_key(product_id: int) -> str:
        """Get cache key for product images."""
        return ProductDetailsCacheService.IMAGES_KEY_PATTERN.format(product_id)
    
    @staticmethod
    def get_related_key(product_id: int, category_id: Optional[int] = None) -> str:
        """Get cache key for related products."""
        return ProductDetailsCacheService.RELATED_KEY_PATTERN.format(
            product_id,
            category_id or 'all'
        )
    
    @staticmethod
    def invalidate_product_detail(product_id: int) -> Dict[str, Any]:
        """
        Invalidate all caches related to a specific product.
        
        Args:
            product_id: The product ID to invalidate
            
        Returns:
            Dict with invalidation results
        """
        try:
            keys_to_invalidate = [
                ProductDetailsCacheService.get_detail_key(product_id),
                ProductDetailsCacheService.get_images_key(product_id),
                ProductDetailsCacheService.get_related_key(product_id, None),
            ]
            
            invalidated_count = 0
            for key in keys_to_invalidate:
                try:
                    # Try to delete the key
                    result = product_cache.delete(key) if hasattr(product_cache, 'delete') else False
                    if result or result is None:  # None means key was deleted or doesn't exist
                        invalidated_count += 1
                        current_app.logger.info(f"[v0] Cache invalidated: {key}")
                except Exception as e:
                    current_app.logger.warning(f"[v0] Failed to invalidate cache {key}: {str(e)}")
            
            # Also invalidate related products for this product in other categories
            # by invalidating the pattern
            try:
                if hasattr(product_cache, 'delete_pattern'):
                    product_cache.delete_pattern(f"product:related:{product_id}:*")
                    current_app.logger.info(f"[v0] Invalidated related products cache for product {product_id}")
            except Exception as e:
                current_app.logger.warning(f"[v0] Failed to invalidate related products pattern: {str(e)}")
            
            return {
                'success': True,
                'product_id': product_id,
                'keys_invalidated': invalidated_count,
                'message': f'Successfully invalidated {invalidated_count} cache entries for product {product_id}'
            }
        
        except Exception as e:
            current_app.logger.error(f"[v0] Error invalidating product detail cache: {str(e)}")
            return {
                'success': False,
                'product_id': product_id,
                'error': str(e),
                'message': f'Failed to invalidate cache for product {product_id}'
            }
    
    @staticmethod
    def invalidate_category_products(category_id: int) -> Dict[str, Any]:
        """
        Invalidate related products cache for all products in a category.
        Called when category is updated.
        
        Args:
            category_id: The category ID
            
        Returns:
            Dict with invalidation results
        """
        try:
            # This invalidates the related products cache for this category
            # You would need to implement delete_pattern in your Redis cache
            if hasattr(product_cache, 'delete_pattern'):
                result = product_cache.delete_pattern(f"product:related:*:{category_id}")
                message = f'Invalidated {result} cache entries for category {category_id}'
            else:
                message = 'Pattern deletion not supported in cache implementation'
            
            current_app.logger.info(f"[v0] {message}")
            
            return {
                'success': True,
                'category_id': category_id,
                'message': message
            }
        
        except Exception as e:
            current_app.logger.error(f"[v0] Error invalidating category cache: {str(e)}")
            return {
                'success': False,
                'category_id': category_id,
                'error': str(e)
            }
    
    @staticmethod
    def invalidate_images(product_id: int) -> Dict[str, Any]:
        """
        Invalidate image cache for a product.
        Called when product images are updated.
        
        Args:
            product_id: The product ID
            
        Returns:
            Dict with invalidation results
        """
        try:
            key = ProductDetailsCacheService.get_images_key(product_id)
            result = product_cache.delete(key) if hasattr(product_cache, 'delete') else False
            
            if result or result is None:
                current_app.logger.info(f"[v0] Image cache invalidated for product {product_id}")
                return {
                    'success': True,
                    'product_id': product_id,
                    'key': key,
                    'message': f'Image cache invalidated for product {product_id}'
                }
            else:
                return {
                    'success': False,
                    'product_id': product_id,
                    'key': key,
                    'message': 'Cache key not found'
                }
        
        except Exception as e:
            current_app.logger.error(f"[v0] Error invalidating image cache: {str(e)}")
            return {
                'success': False,
                'product_id': product_id,
                'error': str(e)
            }
    
    @staticmethod
    def invalidate_inventory(product_id: int) -> Dict[str, Any]:
        """
        Inventory is never cached, always fetched fresh.
        This method exists for API consistency.
        
        Args:
            product_id: The product ID
            
        Returns:
            Dict noting inventory is not cached
        """
        return {
            'success': True,
            'product_id': product_id,
            'message': 'Inventory is always fetched fresh (not cached)',
            'cached': False
        }
    
    @staticmethod
    def get_cache_status(product_id: int) -> Dict[str, Any]:
        """
        Get cache status for a specific product.
        
        Args:
            product_id: The product ID
            
        Returns:
            Dict with cache status information
        """
        detail_key = ProductDetailsCacheService.get_detail_key(product_id)
        images_key = ProductDetailsCacheService.get_images_key(product_id)
        
        detail_cached = safe_cache_get(detail_key) is not None
        images_cached = safe_cache_get(images_key) is not None
        
        return {
            'product_id': product_id,
            'detail_cached': detail_cached,
            'images_cached': images_cached,
            'detail_key': detail_key,
            'images_key': images_key,
            'detail_ttl': ProductDetailsCacheService.DETAIL_TTL,
            'images_ttl': ProductDetailsCacheService.IMAGES_TTL
        }
    
    @staticmethod
    def cache_product_detail(product_id: int, data: Dict[str, Any]) -> bool:
        """
        Manually cache product detail data.
        
        Args:
            product_id: The product ID
            data: The product data to cache
            
        Returns:
            True if caching was successful
        """
        try:
            key = ProductDetailsCacheService.get_detail_key(product_id)
            safe_cache_set(key, json.dumps(data), ProductDetailsCacheService.DETAIL_TTL)
            current_app.logger.info(f"[v0] Cached product detail {product_id}")
            return True
        except Exception as e:
            current_app.logger.error(f"[v0] Error caching product detail: {str(e)}")
            return False
    
    @staticmethod
    def cache_product_images(product_id: int, images: List[Dict[str, Any]]) -> bool:
        """
        Manually cache product images.
        
        Args:
            product_id: The product ID
            images: List of image data
            
        Returns:
            True if caching was successful
        """
        try:
            key = ProductDetailsCacheService.get_images_key(product_id)
            safe_cache_set(key, json.dumps(images), ProductDetailsCacheService.IMAGES_TTL)
            current_app.logger.info(f"[v0] Cached images for product {product_id}")
            return True
        except Exception as e:
            current_app.logger.error(f"[v0] Error caching product images: {str(e)}")
            return False


# Webhook handlers for admin operations

def on_product_updated(product_id: int, changes: Optional[Dict[str, Any]] = None):
    """Called when a product is updated in admin panel."""
    result = ProductDetailsCacheService.invalidate_product_detail(product_id)
    current_app.logger.info(f"[v0] Product updated webhook: {result}")
    return result


def on_product_images_updated(product_id: int):
    """Called when product images are updated."""
    result = ProductDetailsCacheService.invalidate_images(product_id)
    current_app.logger.info(f"[v0] Product images updated webhook: {result}")
    return result


def on_product_inventory_updated(product_id: int):
    """Called when product inventory is updated."""
    # Invalidate product detail cache (includes stock info)
    result = ProductDetailsCacheService.invalidate_product_detail(product_id)
    current_app.logger.info(f"[v0] Product inventory updated webhook: {result}")
    return result


def on_category_updated(category_id: int):
    """Called when a category is updated."""
    result = ProductDetailsCacheService.invalidate_category_products(category_id)
    current_app.logger.info(f"[v0] Category updated webhook: {result}")
    return result
