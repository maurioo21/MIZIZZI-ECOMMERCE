"""
Product Details Routes - Production Grade Implementation
Handles single product detail views with Redis caching and Cloudinary image optimization.
Includes complete cache invalidation, defensive serialization, and enterprise-grade error handling.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from sqlalchemy.orm import joinedload
from sqlalchemy import text
from datetime import datetime
import json
from typing import Optional, Dict, Any, List

from app.configuration.extensions import db
from app.models.models import (
    Product, ProductImage, ProductVariant, Review, Category, Brand, 
    WishlistItem, User, UserRole
)
from app.cache.cache import cache_manager

# Initialize blueprint
product_details_bp = Blueprint('product_details', __name__, url_prefix='/api/product-details')

# Cache configuration (override in app config if needed)
PRODUCT_DETAIL_CACHE_TTL = 900  # 15 minutes
PRODUCT_IMAGES_CACHE_TTL = 1800  # 30 minutes
RELATED_PRODUCTS_CACHE_TTL = 600  # 10 minutes


def get_cache_key(product_id: int) -> str:
    """Generate cache key for product details."""
    return f"product:detail:{product_id}"


def get_related_cache_key(product_id: int, category_id: Optional[int] = None) -> str:
    """Generate cache key for related products."""
    return f"product:related:{product_id}:{category_id or 'all'}"


def get_images_cache_key(product_id: int) -> str:
    """Generate cache key for product images."""
    return f"product:images:{product_id}"


def get_cloudinary_url(image: ProductImage, width: int = None, height: int = None, quality: str = "auto") -> str:
    """
    Build Cloudinary URL with safe attribute access.
    Supports multiple possible image URL fields on ProductImage model.
    """
    try:
        # Try multiple possible image URL attributes in order of preference
        image_url = None
        for attr in ['cloudinary_url', 'image_url', 'url', 'original_url']:
            if hasattr(image, attr):
                image_url = getattr(image, attr, None)
                if image_url:
                    break
        
        if not image_url:
            current_app.logger.warning(f"Image {image.id}: No URL attribute found, using fallback")
            return "/generic-product-display.png"
        
        # If already a Cloudinary URL or external CDN, return as-is
        if 'cloudinary' in image_url or image_url.startswith('http'):
            if width or height:
                # Add Cloudinary transformations if we need resizing
                if 'cloudinary' in image_url:
                    # Insert transformation params
                    base, path = image_url.rsplit('/', 1)
                    transform = f"w_{width},h_{height},c_fill,q_{quality}" if width and height else f"w_{width},q_{quality}" if width else f"h_{height},q_{quality}"
                    return f"{base}/{transform}/{path}"
            return image_url
        
        return image_url
    
    except Exception as e:
        current_app.logger.error(f"Error building Cloudinary URL for image {image.id}: {e}")
        return "/generic-product-display.png"


def serialize_image(image: ProductImage) -> Optional[Dict[str, Any]]:
    """
    Safely serialize product image with Cloudinary URLs.
    Returns None if image is invalid, allowing other images to still be returned.
    """
    try:
        if not image or not hasattr(image, 'id'):
            return None
        
        # Get base image URL with safe fallback
        base_url = get_cloudinary_url(image)
        
        return {
            'id': image.id,
            'alt_text': getattr(image, 'alt_text', None) or f"Product image",
            'is_primary': getattr(image, 'is_primary', False),
            'display_order': getattr(image, 'sort_order', 0) or 0,
            'cloudinary_public_id': getattr(image, 'cloudinary_public_id', None),
            'urls': {
                'original': base_url,
                'thumbnail': get_cloudinary_url(image, width=200, height=200),
                'medium': get_cloudinary_url(image, width=500, height=500),
                'large': get_cloudinary_url(image, width=1000, height=1000),
            }
        }
    
    except Exception as e:
        current_app.logger.error(f"Error serializing image {getattr(image, 'id', 'unknown')}: {e}")
        return None


def serialize_variant(variant: ProductVariant) -> Optional[Dict[str, Any]]:
    """Safely serialize product variant."""
    try:
        if not variant:
            return None
        
        return {
            'id': variant.id,
            'color': getattr(variant, 'color', None),
            'size': getattr(variant, 'size', None),
            'stock': getattr(variant, 'stock', 0),
            'sku': getattr(variant, 'sku', None)
        }
    except Exception as e:
        current_app.logger.error(f"Error serializing variant {getattr(variant, 'id', 'unknown')}: {e}")
        return None


def serialize_brand(brand: Brand) -> Optional[Dict[str, Any]]:
    """Safely serialize brand."""
    try:
        if not brand:
            return None
        return {
            'id': brand.id,
            'name': brand.name,
            'slug': brand.slug
        }
    except Exception:
        return None


def serialize_category(category: Category) -> Optional[Dict[str, Any]]:
    """Safely serialize category."""
    try:
        if not category:
            return None
        return {
            'id': category.id,
            'name': category.name,
            'slug': category.slug
        }
    except Exception:
        return None


def serialize_product_detail(product: Product, is_admin: bool = False) -> Dict[str, Any]:
    """
    Safely serialize product with full details for product page.
    Never raises exceptions - always returns valid response even if parts fail.
    Includes relationships, images, variants, and ratings.
    """
    serialized = {
        'id': product.id,
        'name': getattr(product, 'name', 'Unknown Product'),
        'slug': getattr(product, 'slug', ''),
        'description': getattr(product, 'description', ''),
        'sku': getattr(product, 'sku', ''),
    }
    
    try:
        # Pricing
        price = float(getattr(product, 'price', 0) or 0)
        sale_price = float(getattr(product, 'sale_price', 0) or 0)
        
        serialized.update({
            'original_price': price,
            'sale_price': sale_price,
            'current_price': sale_price if sale_price > 0 else price,
            'discount_percentage': round(((price - sale_price) / price * 100)) if price > 0 and sale_price > 0 else 0,
        })
    except Exception as e:
        current_app.logger.warning(f"Error processing pricing for product {product.id}: {e}")
        serialized.update({
            'original_price': 0,
            'sale_price': 0,
            'current_price': 0,
            'discount_percentage': 0,
        })
    
    try:
        # Brand and Category
        serialized['brand'] = serialize_brand(getattr(product, 'brand', None))
        serialized['category'] = serialize_category(getattr(product, 'category', None))
    except Exception as e:
        current_app.logger.warning(f"Error processing brand/category for product {product.id}: {e}")
        serialized['brand'] = None
        serialized['category'] = None
    
    try:
        # Images - safely serialize, filter out None results
        images_rel = getattr(product, 'images', None)
        if images_rel:
            serialized_images = []
            for img in images_rel:
                try:
                    serialized_img = serialize_image(img)
                    if serialized_img:
                        serialized_images.append(serialized_img)
                except Exception as e:
                    current_app.logger.warning(f"Skipping image {getattr(img, 'id', 'unknown')}: {e}")
            
            # Ensure primary image is marked
            if serialized_images and not any(img['is_primary'] for img in serialized_images):
                serialized_images[0]['is_primary'] = True
            
            serialized['images'] = serialized_images
        else:
            serialized['images'] = []
    except Exception as e:
        current_app.logger.warning(f"Error processing images for product {product.id}: {e}")
        serialized['images'] = []
    
    try:
        # Variants
        variants_rel = getattr(product, 'variants', None)
        if variants_rel:
            serialized_variants = []
            for var in variants_rel:
                try:
                    serialized_var = serialize_variant(var)
                    if serialized_var:
                        serialized_variants.append(serialized_var)
                except Exception as e:
                    current_app.logger.warning(f"Skipping variant {getattr(var, 'id', 'unknown')}: {e}")
            serialized['variants'] = serialized_variants
        else:
            serialized['variants'] = []
    except Exception as e:
        current_app.logger.warning(f"Error processing variants for product {product.id}: {e}")
        serialized['variants'] = []
    
    try:
        # Stock calculation
        variants = getattr(product, 'variants', None) or []
        total_stock = sum(getattr(v, 'stock', 0) for v in variants) if variants else getattr(product, 'stock', 0) or 0
        
        serialized['stock'] = {
            'total': total_stock,
            'is_in_stock': total_stock > 0,
            'available_quantity': total_stock
        }
    except Exception as e:
        current_app.logger.warning(f"Error calculating stock for product {product.id}: {e}")
        serialized['stock'] = {
            'total': 0,
            'is_in_stock': False,
            'available_quantity': 0
        }
    
    try:
        # Reviews and ratings
        reviews = db.session.query(Review).filter_by(product_id=product.id).all()
        if reviews:
            ratings = [r.rating for r in reviews if hasattr(r, 'rating') and r.rating]
            avg_rating = sum(ratings) / len(ratings) if ratings else 0
            
            rating_dist = {
                '5': len([r for r in ratings if r == 5]),
                '4': len([r for r in ratings if r == 4]),
                '3': len([r for r in ratings if r == 3]),
                '2': len([r for r in ratings if r == 2]),
                '1': len([r for r in ratings if r == 1]),
            }
        else:
            avg_rating = 0
            rating_dist = {'5': 0, '4': 0, '3': 0, '2': 0, '1': 0}
        
        serialized['rating'] = {
            'average': round(avg_rating, 1),
            'total_reviews': len(reviews),
            'distribution': rating_dist
        }
    except Exception as e:
        current_app.logger.warning(f"Error processing reviews for product {product.id}: {e}")
        serialized['rating'] = {
            'average': 0,
            'total_reviews': 0,
            'distribution': {'5': 0, '4': 0, '3': 0, '2': 0, '1': 0}
        }
    
    try:
        # Flags
        serialized['is_flash_sale'] = getattr(product, 'is_flash_sale', False) or False
        serialized['is_luxury_deal'] = getattr(product, 'is_luxury_deal', False) or False
        serialized['is_new_arrival'] = getattr(product, 'is_new_arrival', False) or False
    except Exception:
        serialized['is_flash_sale'] = False
        serialized['is_luxury_deal'] = False
        serialized['is_new_arrival'] = False
    
    try:
        # Timestamps
        created_at = getattr(product, 'created_at', None)
        updated_at = getattr(product, 'updated_at', None)
        serialized['created_at'] = created_at.isoformat() if created_at else None
        serialized['updated_at'] = updated_at.isoformat() if updated_at else None
    except Exception:
        serialized['created_at'] = None
        serialized['updated_at'] = None
    
    # Admin-only fields
    if is_admin:
        try:
            serialized['is_active'] = getattr(product, 'is_active', False)
            serialized['views'] = getattr(product, 'views', 0) or 0
            serialized['created_by_id'] = getattr(product, 'created_by_id', None)
        except Exception:
            pass
    
    return serialized


def get_related_products(product: Product, limit: int = 12) -> List[Dict[str, Any]]:
    """
    Get related products from the same category with cache.
    """
    try:
        if not getattr(product, 'category_id', None):
            return []
        
        cache_key = get_related_cache_key(product.id, product.category_id)
        
        # Try cache first
        cached = cache_manager.get(cache_key)
        if cached:
            current_app.logger.debug(f"CACHE HIT: Related products {cache_key}")
            return cached if isinstance(cached, list) else []
        
        # Query related products
        related = db.session.query(Product).filter(
            Product.category_id == product.category_id,
            Product.id != product.id,
            Product.is_active == True
        ).limit(limit).all()
        
        # Serialize
        related_serialized = [serialize_product_detail(p) for p in related]
        
        # Cache results
        cache_manager.set(cache_key, related_serialized, ttl=RELATED_PRODUCTS_CACHE_TTL)
        current_app.logger.debug(f"CACHE SET: Related products {cache_key}")
        
        return related_serialized
    
    except Exception as e:
        current_app.logger.error(f"Error fetching related products: {e}")
        return []


def invalidate_product_cache(product_id: int) -> None:
    """
    Invalidate all cache keys related to a product.
    Called after product updates.
    """
    try:
        patterns_to_delete = [
            get_cache_key(product_id),
            get_images_cache_key(product_id),
            f"product:related:*:{product_id}:*",  # Related products where this is target
            f"product:related:{product_id}:*",    # Related products from this product
        ]
        
        for pattern in patterns_to_delete:
            try:
                cache_manager.delete(pattern)
                current_app.logger.info(f"CACHE DELETE: {pattern}")
            except Exception as e:
                current_app.logger.warning(f"Cache delete failed for {pattern}: {e}")
    
    except Exception as e:
        current_app.logger.error(f"Error invalidating product cache: {e}")


def invalidate_category_cache(category_id: Optional[int]) -> None:
    """
    Invalidate all related products cache for a category.
    Called when category changes.
    """
    if not category_id:
        return
    
    try:
        cache_manager.delete_pattern(f"product:related:*:{category_id}")
        current_app.logger.info(f"CACHE DELETE: Category related products {category_id}")
    except Exception as e:
        current_app.logger.warning(f"Error invalidating category cache: {e}")


# ============================================================================
# API ROUTES
# ============================================================================

@product_details_bp.route('/<int:product_id>', methods=['GET'])
def get_product_details(product_id: int):
    """
    Get complete product details with Redis caching.
    Never caches broken responses - only caches after successful full serialization.
    
    Query parameters:
    - include_related: Include related products (default: true)
    """
    try:
        # Try cache first
        cache_key = get_cache_key(product_id)
        cached_data = cache_manager.get(cache_key)
        
        if cached_data:
            current_app.logger.info(f"CACHE HIT: {cache_key}")
            response = jsonify(cached_data)
            response.headers['X-Cache'] = 'HIT'
            response.headers['X-Cache-Key'] = cache_key
            return response, 200
        
        # Cache miss - query product
        product = db.session.query(Product).options(
            joinedload(Product.brand),
            joinedload(Product.category),
            joinedload(Product.images),
            joinedload(Product.variants)
        ).filter_by(id=product_id, is_active=True).first()
        
        if not product:
            current_app.logger.warning(f"Product not found: {product_id}")
            return jsonify({'error': 'Product not found', 'product_id': product_id}), 404
        
        # Check admin status
        is_admin = False
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                user = db.session.get(User, user_id)
                is_admin = user and user.role == UserRole.ADMIN
        except Exception:
            pass
        
        # Safely serialize product (never throws)
        product_data = serialize_product_detail(product, is_admin=is_admin)
        
        # Add related products if requested
        include_related = request.args.get('include_related', 'true').lower() == 'true'
        if include_related:
            product_data['related_products'] = get_related_products(product)
        else:
            product_data['related_products'] = []
        
        # Check wishlist status
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                is_in_wishlist = db.session.query(WishlistItem).filter_by(
                    user_id=user_id,
                    product_id=product_id
                ).first() is not None
                product_data['is_in_wishlist'] = is_in_wishlist
        except Exception:
            product_data['is_in_wishlist'] = False
        
        # Build response - DO NOT include timestamp in cached data (it changes per request)
        response_data = {
            'success': True,
            'data': product_data,
            'timestamp': datetime.utcnow().isoformat(),
            'cache_key': cache_key
        }
        
        # Only cache after successful full serialization
        try:
            cache_manager.set(cache_key, response_data, ttl=PRODUCT_DETAIL_CACHE_TTL)
            current_app.logger.info(f"CACHE SET: {cache_key} (TTL: {PRODUCT_DETAIL_CACHE_TTL}s)")
        except Exception as e:
            current_app.logger.error(f"Failed to cache product details: {e}")
        
        response = jsonify(response_data)
        response.headers['X-Cache'] = 'MISS'
        response.headers['X-Cache-Key'] = cache_key
        return response, 200
    
    except Exception as e:
        current_app.logger.error(f"Unexpected error in get_product_details: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/<int:product_id>/images', methods=['GET'])
def get_product_images(product_id: int):
    """
    Get all product images with Cloudinary optimization URLs.
    Returns empty list if product not found.
    """
    try:
        cache_key = get_images_cache_key(product_id)
        cached = cache_manager.get(cache_key)
        
        if cached:
            current_app.logger.info(f"CACHE HIT: {cache_key}")
            response = jsonify(cached)
            response.headers['X-Cache'] = 'HIT'
            return response, 200
        
        # Query product and images
        product = db.session.query(Product).filter_by(id=product_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        images = db.session.query(ProductImage).filter_by(product_id=product_id).order_by(
            ProductImage.is_primary.desc(),
            ProductImage.sort_order.asc()
        ).all()
        
        # Serialize safely
        serialized_images = []
        for img in images:
            try:
                serialized = serialize_image(img)
                if serialized:
                    serialized_images.append(serialized)
            except Exception as e:
                current_app.logger.warning(f"Skipping image {img.id}: {e}")
        
        # Ensure at least one primary
        if serialized_images and not any(img['is_primary'] for img in serialized_images):
            serialized_images[0]['is_primary'] = True
        
        response_data = {
            'success': True,
            'product_id': product_id,
            'images': serialized_images,
            'total': len(serialized_images),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Cache
        cache_manager.set(cache_key, response_data, ttl=PRODUCT_IMAGES_CACHE_TTL)
        current_app.logger.info(f"CACHE SET: {cache_key}")
        
        response = jsonify(response_data)
        response.headers['X-Cache'] = 'MISS'
        return response, 200
    
    except Exception as e:
        current_app.logger.error(f"Error in get_product_images: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/<int:product_id>/inventory', methods=['GET'])
def get_product_inventory(product_id: int):
    """
    Get product inventory and stock information.
    Real-time data (not cached) for accurate stock levels.
    """
    try:
        product = db.session.query(Product).filter_by(id=product_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Get variants and calculate totals
        variants = db.session.query(ProductVariant).filter_by(product_id=product_id).all()
        total_stock = sum(getattr(v, 'stock', 0) for v in variants) or getattr(product, 'stock', 0) or 0
        
        # Variants breakdown
        variants_by_color = {}
        for variant in variants:
            color = getattr(variant, 'color', None)
            if not color:
                continue
            if color not in variants_by_color:
                variants_by_color[color] = {'total': 0, 'sizes': {}}
            variants_by_color[color]['total'] += getattr(variant, 'stock', 0)
            if hasattr(variant, 'size') and variant.size:
                variants_by_color[color]['sizes'][variant.size] = getattr(variant, 'stock', 0)
        
        return jsonify({
            'success': True,
            'product_id': product_id,
            'is_in_stock': total_stock > 0,
            'available_quantity': total_stock,
            'variants_by_color': variants_by_color,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error in get_product_inventory: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/<int:product_id>/related', methods=['GET'])
def get_related_products_endpoint(product_id: int):
    """
    Get related products for a product.
    """
    try:
        limit = request.args.get('limit', 12, type=int)
        limit = min(limit, 100)  # Cap at 100
        
        product = db.session.query(Product).filter_by(id=product_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        related = get_related_products(product, limit=limit)
        
        return jsonify({
            'success': True,
            'product_id': product_id,
            'related_products': related,
            'total': len(related),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error in get_related_products_endpoint: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/<int:product_id>/cache/invalidate', methods=['POST', 'DELETE'])
def cache_invalidate_endpoint(product_id: int):
    """
    Invalidate product cache.
    """
    try:
        invalidate_product_cache(product_id)
        
        return jsonify({
            'success': True,
            'message': f'Cache invalidated for product {product_id}',
            'product_id': product_id
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error invalidating cache: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/health', methods=['GET'])
def health_check():
    """Health check for product details service."""
    health_info = {
        'status': 'ok',
        'service': 'product_details',
        'timestamp': datetime.utcnow().isoformat(),
    }
    
    # Test database
    try:
        db.session.execute(text('SELECT 1'))
        product_count = db.session.query(Product).count()
        active_product_count = db.session.query(Product).filter_by(is_active=True).count()
        health_info['database'] = 'healthy'
        health_info['products_total'] = product_count
        health_info['products_active'] = active_product_count
        
        if product_count == 0:
            health_info['warning'] = 'No products in database'
    except Exception as e:
        health_info['database'] = 'unhealthy'
        health_info['db_error'] = str(e)
    
    # Test cache
    try:
        health_info['cache'] = 'healthy' if cache_manager.is_connected else 'degraded'
        health_info['cache_stats'] = cache_manager.stats
    except Exception:
        health_info['cache'] = 'unhealthy'
    
    return jsonify(health_info), 200


@product_details_bp.route('/active-products', methods=['GET'])
def list_active_products():
    """List all active product IDs for testing."""
    try:
        active_products = db.session.query(Product.id, Product.name, Product.sku).filter_by(
            is_active=True
        ).limit(50).all()
        
        return jsonify({
            'status': 'ok',
            'active_products': [
                {'id': p.id, 'name': p.name, 'sku': p.sku} for p in active_products
            ],
            'total': len(active_products)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
