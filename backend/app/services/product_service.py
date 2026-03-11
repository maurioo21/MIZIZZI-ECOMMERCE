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
        Get related products from same category.
        Falls back to products from same brand or popular products if category is empty.
        Excludes the current product.
        Optimized with eager loading.
        """
        try:
            product = Product.query.filter_by(id=product_id).first()
            if not product:
                return []
            
            if not category_id:
                category_id = product.category_id
            
            # Try to get related products from same category
            related = []
            if category_id:
                related = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.category_id == category_id
                ).limit(limit).all()
            
            # If not enough from category, try same brand
            if len(related) < limit and product.brand_id:
                brand_products = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.brand_id == product.brand_id,
                    Product.id.notin_([p.id for p in related])  # Exclude already fetched
                ).limit(limit - len(related)).all()
                related.extend(brand_products)
            
            # If still not enough, fetch popular products (ordered by rating)
            if len(related) < limit:
                popular_products = Product.query.options(
                    joinedload(Product.brand),
                    joinedload(Product.category),
                    selectinload(Product.images),
                ).filter(
                    Product.id != product_id,
                    Product.id.notin_([p.id for p in related])  # Exclude already fetched
                ).order_by(Product.rating.desc()).limit(limit - len(related)).all()
                related.extend(popular_products)
            
            return related[:limit]
            
        except Exception as e:
            logger.error(f"Error fetching related products: {e}")
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
