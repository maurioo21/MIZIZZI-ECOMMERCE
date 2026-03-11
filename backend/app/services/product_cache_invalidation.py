"""
Product Cache Invalidation Service
Handles centralized cache invalidation for products across the application.
Integrates with admin routes and image management.
"""
import logging
from typing import Optional, Set
from app.cache.cache import cache_manager

logger = logging.getLogger(__name__)


class ProductCacheInvalidationService:
    """Service for managing product cache invalidation."""
    
    @staticmethod
    def invalidate_product(product_id: int) -> None:
        """
        Invalidate all cache entries for a single product.
        Called when product details are updated.
        """
        try:
            patterns = [
                f"product:detail:{product_id}",
                f"product:images:{product_id}",
                f"product:related:{product_id}:*",
                f"product:related:*:{product_id}",
            ]
            
            for pattern in patterns:
                cache_manager.delete_pattern(pattern)
                logger.info(f"Invalidated cache pattern: {pattern}")
        
        except Exception as e:
            logger.error(f"Error invalidating product {product_id}: {e}")
    
    @staticmethod
    def invalidate_products_by_category(category_id: int) -> None:
        """
        Invalidate all related products cache for a category.
        Called when category is updated.
        """
        try:
            pattern = f"product:related:*:{category_id}"
            cache_manager.delete_pattern(pattern)
            logger.info(f"Invalidated category {category_id} related products cache")
        except Exception as e:
            logger.error(f"Error invalidating category cache: {e}")
    
    @staticmethod
    def invalidate_products_by_brand(brand_id: int) -> None:
        """
        Invalidate products by brand (future use for brand detail pages).
        """
        try:
            pattern = f"product:brand:{brand_id}:*"
            cache_manager.delete_pattern(pattern)
            logger.info(f"Invalidated brand {brand_id} cache")
        except Exception as e:
            logger.error(f"Error invalidating brand cache: {e}")
    
    @staticmethod
    def invalidate_product_images(product_id: int) -> None:
        """
        Invalidate product images cache specifically.
        Called when product images are added/modified/deleted.
        """
        try:
            key = f"product:images:{product_id}"
            cache_manager.delete(key)
            
            # Also invalidate main product cache since images changed
            ProductCacheInvalidationService.invalidate_product(product_id)
            
            logger.info(f"Invalidated product images cache for product {product_id}")
        except Exception as e:
            logger.error(f"Error invalidating product images: {e}")
    
    @staticmethod
    def invalidate_product_inventory(product_id: int) -> None:
        """
        Invalidate product inventory cache.
        Note: Inventory endpoint is not cached by design (real-time),
        but related products may include stock info.
        """
        try:
            # Invalidate related products if they include stock data
            ProductCacheInvalidationService.invalidate_product(product_id)
            logger.info(f"Invalidated product inventory cache for product {product_id}")
        except Exception as e:
            logger.error(f"Error invalidating product inventory: {e}")
    
    @staticmethod
    def invalidate_product_reviews(product_id: int) -> None:
        """
        Invalidate product cache when reviews change.
        Product rating summary is included in product detail response.
        """
        try:
            ProductCacheInvalidationService.invalidate_product(product_id)
            logger.info(f"Invalidated product cache due to review change for product {product_id}")
        except Exception as e:
            logger.error(f"Error invalidating product reviews cache: {e}")
    
    @staticmethod
    def invalidate_all_products() -> None:
        """
        Invalidate ALL product caches.
        Use sparingly - typically called during app restart or major updates.
        """
        try:
            cache_manager.delete_pattern("product:*")
            logger.warning("Invalidated ALL product caches")
        except Exception as e:
            logger.error(f"Error invalidating all product caches: {e}")


# Global instance
product_cache_service = ProductCacheInvalidationService()
