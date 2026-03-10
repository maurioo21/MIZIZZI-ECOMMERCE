"""Homepage Categories Loader - Fetches categories for homepage display."""
import logging
from typing import List, Dict, Any
from app.models.models import Category
from app.configuration.extensions import db
from app.utils.redis_cache import product_cache, fast_json_dumps

logger = logging.getLogger(__name__)

CACHE_KEY = "mizizzi:homepage:categories"
CACHE_TTL = 300  # 5 minutes


def get_homepage_categories(limit: int = 20) -> List[Dict[str, Any]]:
    """
    Fetch categories for homepage with Redis caching.
    OPTIMIZATION: Uses full model to serialize properly with Cloudinary URLs
    """
    try:
        # Try to get from Redis cache
        if product_cache:
            cached = product_cache.get(CACHE_KEY)
            # IMPORTANT: Use `is not None` NOT `if cached:` to handle empty arrays
            if cached is not None:
                logger.debug("[Homepage] Categories loaded from cache")
                return cached
        
        # Query full Category models and use their to_dict() method
        # This ensures proper URL handling (Cloudinary > backend endpoint)
        categories = db.session.query(Category)\
         .filter(Category.is_active == True)\
         .order_by(Category.sort_order.asc(), Category.created_at.desc())\
         .limit(limit)\
         .all()
        
        # Serialize using the model's to_dict() which handles URL priority correctly
        result = [
            {
                "id": cat.id,
                "name": cat.name,
                "slug": cat.slug,
                "image": cat.image_url or "",  # Direct Cloudinary URL from model
                "image_url": cat.image_url or "",  # Cloudinary URL (not backend endpoint)
                "banner_url": cat.banner_url or "",  # Cloudinary URL (not backend endpoint)
                "description": cat.description or "",
                "is_active": True
            }
            for cat in categories
        ]
        
        # Cache result
        if product_cache:
            product_cache.set(CACHE_KEY, result, CACHE_TTL)
        
        logger.debug(f"[Homepage] Loaded {len(result)} categories with Cloudinary URLs")
        return result
        
    except Exception as e:
        logger.error(f"[Homepage] Error loading categories: {e}")
        return []

