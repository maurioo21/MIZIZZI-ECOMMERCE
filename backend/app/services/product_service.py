"""
Product Service - Production Grade
Handles efficient product queries with SQLAlchemy eager loading.
Prevents N+1 queries and optimizes database performance.
"""
import logging
from typing import Optional, List
from sqlalchemy.orm import joinedload, selectinload
from app.models.models import Product, db

logger = logging.getLogger(__name__)


class ProductService:
    """Service for efficient product data retrieval"""

    @staticmethod
    def get_product_by_id_optimized(product_id: int) -> Optional[Product]:
        """
        Get product by ID with all relationships eagerly loaded.
        Uses joinedload and selectinload to prevent N+1 queries.
        
        Loads:
        - Brand
        - Category  
        - Images (sorted by primary + order)
        - Variants
        - Reviews
        
        Note: Fetches both active and inactive products. 
        Frontend/API layer decides visibility based on permissions.
        """
        try:
            product = Product.query.options(
                # One-to-one relationships
                joinedload(Product.brand),
                joinedload(Product.category),
                
                # One-to-many relationships with eager loading
                selectinload(Product.images),
                selectinload(Product.variants),
                selectinload(Product.reviews),
            ).filter(
                Product.id == product_id
            ).first()
            
            return product
            
        except Exception as e:
            logger.error(f"Error fetching product {product_id}: {e}")
            return None

    @staticmethod
    def get_product_by_slug_optimized(slug: str) -> Optional[Product]:
        """
        Get product by slug with all relationships eagerly loaded.
        Uses joinedload and selectinload to prevent N+1 queries.
        
        Loads:
        - Brand
        - Category  
        - Images (sorted by primary + order)
        - Variants
        - Reviews
        
        Note: Fetches both active and inactive products. 
        Frontend/API layer decides visibility based on permissions.
        """
        try:
            product = Product.query.options(
                # One-to-one relationships
                joinedload(Product.brand),
                joinedload(Product.category),
                
                # One-to-many relationships with eager loading
                selectinload(Product.images),
                selectinload(Product.variants),
                selectinload(Product.reviews),
            ).filter(
                Product.slug == slug
            ).first()
            
            return product
            
        except Exception as e:
            logger.error(f"Error fetching product by slug {slug}: {e}")
            return None

    @staticmethod
    def get_related_products_by_category(
        product_id: int, 
        category_id: Optional[int] = None,
        limit: int = 6
    ) -> List[Product]:
        """
        Get related products with intelligent fallback strategy.
        1. Same category + same brand
        2. Same category
        3. Same brand
        4. Popular products (by rating)
        5. Any other products
        Excludes the current product. Always tries to return products.
        """
        try:
            product = Product.query.filter_by(id=product_id).first()
            if not product:
                return []
            
            if not category_id:
                category_id = product.category_id
            
            related = []
            
            # Strategy 1: Same category AND same brand (highest relevance)
            if category_id and product.brand_id:
                related = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.category_id == category_id,
                    Product.brand_id == product.brand_id
                ).limit(limit).all()
            
            # Strategy 2: Same category only
            if len(related) < limit and category_id:
                additional = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.id.notin_([p.id for p in related]),
                    Product.category_id == category_id
                ).limit(limit - len(related)).all()
                related.extend(additional)
            
            # Strategy 3: Same brand only
            if len(related) < limit and product.brand_id:
                additional = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.id.notin_([p.id for p in related]),
                    Product.brand_id == product.brand_id
                ).limit(limit - len(related)).all()
                related.extend(additional)
            
            # Strategy 4: Popular products (ordered by rating)
            if len(related) < limit:
                additional = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.id.notin_([p.id for p in related])
                ).order_by(Product.rating.desc(), Product.id.desc()).limit(limit - len(related)).all()
                related.extend(additional)
            
            # Strategy 5: Any other products (last resort - ensures we always have something)
            if len(related) < limit:
                additional = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.id.notin_([p.id for p in related])
                ).order_by(Product.id.desc()).limit(limit - len(related)).all()
                related.extend(additional)
            
            return related[:limit]
            
        except Exception as e:
            logger.error(f"Error fetching related products: {e}", exc_info=True)
            # Return at least some products even if there's an error
            try:
                fallback = Product.query.filter(
                    Product.id != product_id
                ).options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).limit(limit).all()
                return fallback
            except:
                return []

    @staticmethod
    def get_products_by_brand(
        brand_id: int,
        limit: int = 12,
        offset: int = 0
    ) -> List[Product]:
        """Get products by brand with optimization"""
        try:
            products = Product.query.options(
                joinedload(Product.brand),
                joinedload(Product.category),
                selectinload(Product.images),
            ).filter(
                Product.brand_id == brand_id
            ).offset(offset).limit(limit).all()
            
            return products
            
        except Exception as e:
            logger.error(f"Error fetching products by brand: {e}")
            return []

    @staticmethod
    def search_products(
        query: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[Product]:
        """Search products by name or SKU with optimization"""
        try:
            search_term = f"%{query}%"
            
            products = Product.query.options(
                joinedload(Product.brand),
                joinedload(Product.category),
                selectinload(Product.images),
            ).filter(
                (Product.name.ilike(search_term) | 
                 Product.sku.ilike(search_term) |
                 Product.description.ilike(search_term))
            ).offset(offset).limit(limit).all()
            
            return products
            
        except Exception as e:
            logger.error(f"Error searching products: {e}")
            return []
