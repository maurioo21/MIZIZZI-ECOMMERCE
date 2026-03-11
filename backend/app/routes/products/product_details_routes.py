"""
Enhanced Product Details Route for Mizizzi E-commerce
Handles single product detail views with Redis caching and Cloudinary image optimization.
Provides complete product information with high performance similar to enterprise e-commerce platforms.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from sqlalchemy.orm import joinedload
from datetime import datetime
import json
from typing import Optional, Dict, Any

from app.configuration.extensions import db
from app.models.models import (
    Product, ProductImage, ProductVariant, Review, Category, Brand, 
    WishlistItem, User, UserRole
)
from app.services.cloudinary_service import CloudinaryService
from app.utils.redis_cache import (
    product_cache,
    fast_json_dumps,
    fast_json_loads,
    cached_response,
    fast_cached_response
)

# Initialize blueprint
product_details_bp = Blueprint('product_details', __name__, url_prefix='/api/product-details')

# Initialize Cloudinary service
cloudinary_service = CloudinaryService()

# Cache constants specific to product details
PRODUCT_DETAIL_CACHE_TTL = 15 * 60  # 15 minutes
PRODUCT_IMAGES_CACHE_TTL = 30 * 60  # 30 minutes
RELATED_PRODUCTS_CACHE_TTL = 10 * 60  # 10 minutes


def get_cache_key(product_id: int) -> str:
    """Generate cache key for product details."""
    return f"product:detail:{product_id}"


def get_related_cache_key(product_id: int, category_id: Optional[int] = None) -> str:
    """Generate cache key for related products."""
    return f"product:related:{product_id}:{category_id or 'all'}"


def get_images_cache_key(product_id: int) -> str:
    """Generate cache key for product images."""
    return f"product:images:{product_id}"


def serialize_image_with_cloudinary(image: ProductImage) -> Dict[str, Any]:
    """
    Serialize product image with Cloudinary optimization.
    Returns original and optimized URLs.
    """
    try:
        # Get Cloudinary URLs if available
        if image.cloudinary_public_id:
            base_url = f"https://res.cloudinary.com/{cloudinary_service.settings.get('cloud_name', 'mizizzi')}/image/upload"
            
            # Original image
            original_url = f"{base_url}/{image.cloudinary_public_id}"
            
            # Optimized variants
            thumbnail_url = f"{base_url}/w_200,h_200,c_fill,q_auto:best/{image.cloudinary_public_id}"
            medium_url = f"{base_url}/w_500,h_500,c_fill,q_auto:best/{image.cloudinary_public_id}"
            large_url = f"{base_url}/w_1000,h_1000,c_fill,q_auto:best/{image.cloudinary_public_id}"
        else:
            # Fallback to local URLs if no Cloudinary ID
            original_url = image.image_url or "/generic-product-display.png"
            thumbnail_url = original_url
            medium_url = original_url
            large_url = original_url
        
        return {
            'id': image.id,
            'alt_text': image.alt_text or f"Product image {image.id}",
            'is_primary': image.is_primary,
            'urls': {
                'original': original_url,
                'thumbnail': thumbnail_url,
                'medium': medium_url,
                'large': large_url
            },
            'cloudinary_public_id': image.cloudinary_public_id,
            'display_order': image.display_order or 0
        }
    except Exception as e:
        current_app.logger.error(f"Error serializing image {image.id}: {str(e)}")
        return {
            'id': image.id,
            'alt_text': image.alt_text or "Product image",
            'is_primary': image.is_primary,
            'urls': {
                'original': "/generic-product-display.png",
                'thumbnail': "/generic-product-display.png",
                'medium': "/generic-product-display.png",
                'large': "/generic-product-display.png"
            },
            'cloudinary_public_id': None,
            'display_order': image.display_order or 0
        }


def serialize_variant(variant: ProductVariant) -> Dict[str, Any]:
    """Serialize product variant."""
    return {
        'id': variant.id,
        'color': variant.color,
        'size': variant.size,
        'stock': variant.stock,
        'sku': variant.sku
    }


def serialize_product_detail(product: Product, is_admin: bool = False) -> Dict[str, Any]:
    """
    Serialize product with full details for product page.
    Includes relationships, images, variants, and ratings.
    """
    try:
        # Get images (sorted by is_primary first, then display_order)
        images = ProductImage.query.filter_by(product_id=product.id).order_by(
            ProductImage.is_primary.desc(),
            ProductImage.display_order.asc()
        ).all()
        
        # Get variants
        variants = ProductVariant.query.filter_by(product_id=product.id).all()
        
        # Get reviews and calculate rating
        reviews = Review.query.filter_by(product_id=product.id, is_approved=True).all()
        avg_rating = sum([r.rating for r in reviews]) / len(reviews) if reviews else 0
        
        # Get inventory info
        total_stock = sum([v.stock for v in variants]) if variants else product.stock or 0
        is_in_stock = total_stock > 0
        
        # Calculate discount
        discount_percentage = 0
        if product.sale_price and product.original_price:
            discount_percentage = round(
                ((product.original_price - product.sale_price) / product.original_price) * 100
            )
        
        # Build base serialization
        serialized = {
            'id': product.id,
            'name': product.name,
            'slug': product.slug,
            'description': product.description,
            'original_price': float(product.original_price) if product.original_price else 0,
            'sale_price': float(product.sale_price) if product.sale_price else 0,
            'current_price': float(product.sale_price or product.original_price or 0),
            'discount_percentage': discount_percentage,
            'sku': product.sku,
            'brand': {
                'id': product.brand.id,
                'name': product.brand.name,
                'slug': product.brand.slug
            } if product.brand else None,
            'category': {
                'id': product.category.id,
                'name': product.category.name,
                'slug': product.category.slug
            } if product.category else None,
            'images': [serialize_image_with_cloudinary(img) for img in images],
            'variants': [serialize_variant(v) for v in variants],
            'stock': {
                'total': total_stock,
                'is_in_stock': is_in_stock,
                'available_quantity': total_stock
            },
            'is_flash_sale': product.is_flash_sale or False,
            'is_luxury_deal': product.is_luxury_deal or False,
            'is_new_arrival': product.is_new_arrival or False,
            'rating': {
                'average': round(avg_rating, 1),
                'total_reviews': len(reviews),
                'distribution': {
                    '5': len([r for r in reviews if r.rating == 5]),
                    '4': len([r for r in reviews if r.rating == 4]),
                    '3': len([r for r in reviews if r.rating == 3]),
                    '2': len([r for r in reviews if r.rating == 2]),
                    '1': len([r for r in reviews if r.rating == 1])
                }
            },
            'created_at': product.created_at.isoformat() if product.created_at else None,
            'updated_at': product.updated_at.isoformat() if product.updated_at else None
        }
        
        # Admin-only fields
        if is_admin:
            serialized.update({
                'is_active': product.is_active,
                'views': product.views or 0,
                'created_by_id': product.created_by_id,
                'cloudinary_public_ids': [img.cloudinary_public_id for img in images if img.cloudinary_public_id]
            })
        
        return serialized
    
    except Exception as e:
        current_app.logger.error(f"Error serializing product {product.id}: {str(e)}")
        raise


def get_related_products(product: Product, limit: int = 12) -> list:
    """
    Get related products from the same category.
    Cached for performance.
    """
    try:
        cache_key = get_related_cache_key(product.id, product.category_id)
        
        # Try to get from cache
        cached = product_cache.get(cache_key)
        if cached:
            current_app.logger.info(f"[v0] Cache HIT: Related products for product {product.id}")
            return json.loads(cached) if isinstance(cached, str) else cached
        
        # Query related products
        related = Product.query.filter(
            Product.category_id == product.category_id,
            Product.id != product.id,
            Product.is_active == True
        ).limit(limit).all()
        
        # Serialize
        related_serialized = [serialize_product_detail(p) for p in related]
        
        # Cache results
        product_cache.set(cache_key, fast_json_dumps(related_serialized), RELATED_PRODUCTS_CACHE_TTL)
        
        return related_serialized
    
    except Exception as e:
        current_app.logger.error(f"Error fetching related products: {str(e)}")
        return []


# ----------------------
# API Routes
# ----------------------

@product_details_bp.route('/<int:product_id>', methods=['GET'])
def get_product_details(product_id: int):
    """
    Get complete product details with Redis caching.
    Includes full image set, variants, reviews, and related products.
    
    Query parameters:
    - include_related: Include related products (default: true)
    - include_reviews: Include recent reviews (default: false)
    """
    try:
        # Check cache first
        cache_key = get_cache_key(product_id)
        cached_data = product_cache.get(cache_key)
        
        if cached_data:
            current_app.logger.info(f"[v0] Cache HIT: Product details {product_id}")
            return jsonify(json.loads(cached_data) if isinstance(cached_data, str) else cached_data), 200
        
        # Query product with relationships - first try active products
        product = Product.query.options(
            joinedload(Product.brand),
            joinedload(Product.category),
            joinedload(Product.images),
            joinedload(Product.variants)
        ).filter_by(id=product_id, is_active=True).first()
        
        # If not found as active, try all products (for debugging)
        if not product:
            current_app.logger.warning(f"[v0] Active product {product_id} not found, checking all products")
            product = Product.query.options(
                joinedload(Product.brand),
                joinedload(Product.category),
                joinedload(Product.images),
                joinedload(Product.variants)
            ).filter_by(id=product_id).first()
            
            if not product:
                current_app.logger.error(f"[v0] Product {product_id} not found in database")
                return jsonify({'error': 'Product not found', 'product_id': product_id}), 404
            else:
                current_app.logger.warning(f"[v0] Product {product_id} found but is_active={product.is_active}")
        
        # Check if user is admin
        is_admin = False
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                user = db.session.get(User, user_id)
                is_admin = user and user.role == UserRole.ADMIN
        except Exception:
            pass
        
        # Serialize product details
        product_data = serialize_product_detail(product, is_admin=is_admin)
        
        # Add related products if requested
        include_related = request.args.get('include_related', 'true').lower() == 'true'
        if include_related:
            product_data['related_products'] = get_related_products(product)
        else:
            product_data['related_products'] = []
        
        # Check wishlist status if user is logged in
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                is_in_wishlist = WishlistItem.query.filter_by(
                    user_id=user_id,
                    product_id=product_id
                ).first() is not None
                product_data['is_in_wishlist'] = is_in_wishlist
        except Exception:
            product_data['is_in_wishlist'] = False
        
        # Cache the response
        response_data = {
            'success': True,
            'data': product_data,
            'timestamp': datetime.utcnow().isoformat()
        }
        product_cache.set(cache_key, fast_json_dumps(response_data), PRODUCT_DETAIL_CACHE_TTL)
        
        current_app.logger.info(f"[v0] Cache MISS & SET: Product details {product_id}")
        return jsonify(response_data), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching product details: {str(e)}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@product_details_bp.route('/<int:product_id>/images', methods=['GET'])
def get_product_images(product_id: int):
    """
    Get all product images with Cloudinary optimization URLs.
    Cached separately for bulk image updates.
    """
    try:
        cache_key = get_images_cache_key(product_id)
        cached = product_cache.get(cache_key)
        
        if cached:
            current_app.logger.info(f"[v0] Cache HIT: Product images {product_id}")
            return jsonify(json.loads(cached) if isinstance(cached, str) else cached), 200
        
        # Query images
        product = Product.query.filter_by(id=product_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        images = ProductImage.query.filter_by(product_id=product_id).order_by(
            ProductImage.is_primary.desc(),
            ProductImage.display_order.asc()
        ).all()
        
        # Serialize with Cloudinary optimization
        serialized_images = [serialize_image_with_cloudinary(img) for img in images]
        
        response_data = {
            'success': True,
            'product_id': product_id,
            'images': serialized_images,
            'total': len(serialized_images),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Cache response
        product_cache.set(cache_key, fast_json_dumps(response_data), PRODUCT_IMAGES_CACHE_TTL)
        
        return jsonify(response_data), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching product images: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/<int:product_id>/inventory', methods=['GET'])
def get_product_inventory(product_id: int):
    """
    Get product inventory and stock information.
    Real-time data (not cached) for accurate stock levels.
    """
    try:
        product = Product.query.filter_by(id=product_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Get variants and calculate totals
        variants = ProductVariant.query.filter_by(product_id=product_id).all()
        total_stock = sum([v.stock for v in variants]) if variants else product.stock or 0
        
        # Calculate variants breakdown
        variants_by_color = {}
        for variant in variants:
            if variant.color not in variants_by_color:
                variants_by_color[variant.color] = {'total': 0, 'sizes': {}}
            variants_by_color[variant.color]['total'] += variant.stock
            if variant.size:
                variants_by_color[variant.color]['sizes'][variant.size] = variant.stock
        
        return jsonify({
            'success': True,
            'product_id': product_id,
            'is_in_stock': total_stock > 0,
            'available_quantity': total_stock,
            'variants_by_color': variants_by_color,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching inventory: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/<int:product_id>/cache/invalidate', methods=['POST'])
def invalidate_product_cache(product_id: int):
    """
    Invalidate product detail cache.
    Called when product is updated (admin only via webhook).
    """
    try:
        # Invalidate all related caches
        cache_patterns = [
            get_cache_key(product_id),
            get_images_cache_key(product_id),
            get_related_cache_key(product_id, None)
        ]
        
        for pattern in cache_patterns:
            try:
                product_cache.delete(pattern)
                current_app.logger.info(f"[v0] Cache invalidated: {pattern}")
            except Exception as e:
                current_app.logger.error(f"Error invalidating cache {pattern}: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': f'Cache invalidated for product {product_id}',
            'caches_cleared': len(cache_patterns)
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error invalidating product cache: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@product_details_bp.route('/health', methods=['GET'])
def health_check():
    """Health check for product details service."""
    health_info = {
        'status': 'ok',
        'service': 'product_details',
        'timestamp': datetime.utcnow().isoformat(),
    }
    
    # Test database connection
    try:
        db.session.execute('SELECT 1')
        product_count = Product.query.count()
        active_product_count = Product.query.filter_by(is_active=True).count()
        health_info['database'] = 'healthy'
        health_info['products_total'] = product_count
        health_info['products_active'] = active_product_count
        
        if product_count == 0:
            health_info['warning'] = 'No products in database'
    except Exception as e:
        health_info['database'] = 'unhealthy'
        health_info['db_error'] = str(e)
    
    # Test cache connection
    try:
        health_info['cache'] = 'healthy' if getattr(product_cache, 'is_connected', False) else 'degraded'
    except Exception:
        health_info['cache'] = 'unhealthy'
    
    # Test Cloudinary
    health_info['cloudinary'] = 'connected' if cloudinary_service else 'unavailable'
    
    return jsonify(health_info), 200
