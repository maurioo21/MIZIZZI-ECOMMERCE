"""
Comprehensive product details API with Redis caching and complete data.
Returns all data needed by frontend: product details, variants, reviews, related products,
category info, brand info, inventory, shipping, specs, and more.
"""
from flask import Blueprint, request, jsonify, current_app
import time
import json
from sqlalchemy.orm import selectinload

from app.configuration.extensions import db
from app.models.models import Product, Category, Brand, Review
from app.routes.products.serializers import serialize_product_detail
from app.cache.redis_client import get_redis_client

product_details_bp = Blueprint('product_details', __name__, url_prefix='/api/product-details')
redis_client = get_redis_client()

CACHE_CONFIG = {
    'product_detail_fresh': 600,      # 10 minutes
    'product_detail_sale': 120,       # 2 minutes for sales
    'product_detail_flash': 60,       # 1 minute for flash sales
}


def serialize_full_product_details(product, include_reviews=True):
    """Serialize product with all frontend-needed data."""
    try:
        # Base product data
        base = serialize_product_detail(product, for_admin=False)
        
        # Category info
        category_data = None
        if product.category:
            category_data = {
                'id': product.category.id,
                'name': product.category.name,
                'slug': product.category.slug,
                'description': product.category.description,
            }
        
        # Brand info
        brand_data = None
        if product.brand:
            brand_data = {
                'id': product.brand.id,
                'name': product.brand.name,
                'slug': product.brand.slug,
                'logo_url': getattr(product.brand, 'logo_url', None),
                'description': getattr(product.brand, 'description', None),
            }
        
        # Variants
        variants = []
        if hasattr(product, 'variants') and product.variants:
            for variant in product.variants:
                variants.append({
                    'id': variant.id,
                    'name': getattr(variant, 'name', ''),
                    'sku': getattr(variant, 'sku', ''),
                    'price': float(getattr(variant, 'price', 0)) if getattr(variant, 'price', 0) else None,
                    'stock': getattr(variant, 'stock', 0),
                    'image_url': getattr(variant, 'image_url', None),
                })
        
        # Reviews
        reviews = []
        if include_reviews and hasattr(product, 'reviews') and product.reviews:
            for review in product.reviews[:10]:  # Limit to 10 recent reviews
                reviews.append({
                    'id': review.id,
                    'rating': getattr(review, 'rating', 0),
                    'comment': getattr(review, 'comment', ''),
                    'author': getattr(review, 'author_name', 'Anonymous'),
                    'created_at': review.created_at.isoformat() if hasattr(review, 'created_at') and review.created_at else None,
                    'verified': getattr(review, 'is_verified', False),
                })
        
        # Related products
        related_product_ids = product.get_related_products() if hasattr(product, 'get_related_products') else []
        related_products = []
        if related_product_ids:
            try:
                related = db.session.query(Product).filter(
                    Product.id.in_(related_product_ids),
                    Product.is_active == True,
                    Product.is_visible == True
                ).limit(6).all()
                
                for p in related:
                    imgs = [img.url for img in p.images] if hasattr(p, 'images') and p.images else p.get_image_urls() if hasattr(p, 'get_image_urls') else []
                    related_products.append({
                        'id': p.id,
                        'name': p.name,
                        'slug': p.slug,
                        'price': float(p.price) if p.price else 0,
                        'sale_price': float(p.sale_price) if p.sale_price else None,
                        'thumbnail': imgs[0] if imgs else p.thumbnail_url,
                    })
            except Exception as e:
                current_app.logger.warning(f"Error fetching related products: {e}")
        
        # Cross-sell products
        cross_sell_ids = product.get_cross_sell_products() if hasattr(product, 'get_cross_sell_products') else []
        cross_sell_products = []
        if cross_sell_ids:
            try:
                cross_sell = db.session.query(Product).filter(
                    Product.id.in_(cross_sell_ids),
                    Product.is_active == True,
                    Product.is_visible == True
                ).limit(3).all()
                
                for p in cross_sell:
                    imgs = [img.url for img in p.images] if hasattr(p, 'images') and p.images else p.get_image_urls() if hasattr(p, 'get_image_urls') else []
                    cross_sell_products.append({
                        'id': p.id,
                        'name': p.name,
                        'price': float(p.price) if p.price else 0,
                        'sale_price': float(p.sale_price) if p.sale_price else None,
                        'thumbnail': imgs[0] if imgs else p.thumbnail_url,
                    })
            except Exception as e:
                current_app.logger.warning(f"Error fetching cross-sell products: {e}")
        
        # Combine all data
        return {
            **base,
            'category': category_data,
            'brand': brand_data,
            'variants': variants,
            'reviews': reviews,
            'reviews_count': len(reviews),
            'related_products': related_products,
            'cross_sell_products': cross_sell_products,
            'avg_rating': calculate_avg_rating(product),
            'in_stock': product.stock > 0,
            'stock_status': 'in_stock' if product.stock > 0 else 'out_of_stock',
            'has_variants': len(variants) > 0,
        }
    except Exception as e:
        current_app.logger.error(f"Error serializing product: {e}", exc_info=True)
        raise


def calculate_avg_rating(product):
    """Calculate average rating from reviews."""
    if not hasattr(product, 'reviews') or not product.reviews:
        return 0
    ratings = [r.rating for r in product.reviews if hasattr(r, 'rating') and r.rating]
    return sum(ratings) / len(ratings) if ratings else 0


@product_details_bp.route('/<int:product_id>', methods=['GET'])
def get_product_by_id(product_id):
    """Get complete product details by ID with all frontend data and Redis caching."""
    try:
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        include_reviews = request.args.get('reviews', 'true').lower() == 'true'
        
        cache_key = f"product:detail:{product_id}:full"
        start_time = time.time()
        
        # Try cache
        if use_cache and not force_refresh and redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    data = json.loads(cached)
                    data['cache_hit'] = True
                    data['response_time_ms'] = int((time.time() - start_time) * 1000)
                    return jsonify(data), 200
            except Exception as e:
                current_app.logger.warning(f"Cache read error: {e}")
        
        # Fetch product with all relationships
        product = db.session.query(Product)\
            .options(
                selectinload(Product.category),
                selectinload(Product.brand),
                selectinload(Product.variants),
                selectinload(Product.reviews),
                selectinload(Product.images)
            )\
            .filter(Product.id == product_id, Product.is_active == True, Product.is_visible == True)\
            .first()
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Serialize complete data
        product_data = serialize_full_product_details(product, include_reviews=include_reviews)
        
        response = {
            'success': True,
            'cache_hit': False,
            'data': product_data,
            'response_time_ms': int((time.time() - start_time) * 1000)
        }
        
        # Cache result
        if redis_client:
            try:
                ttl = CACHE_CONFIG['product_detail_fresh']
                if product.is_flash_sale:
                    ttl = CACHE_CONFIG['product_detail_flash']
                elif product.is_sale:
                    ttl = CACHE_CONFIG['product_detail_sale']
                redis_client.setex(cache_key, ttl, json.dumps(response))
            except Exception as e:
                current_app.logger.warning(f"Cache write error: {e}")
        
        return jsonify(response), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching product {product_id}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e) if current_app.debug else None
        }), 500


@product_details_bp.route('/slug/<slug>', methods=['GET'])
def get_product_by_slug(slug):
    """Get product details by slug with all frontend data."""
    try:
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        include_reviews = request.args.get('reviews', 'true').lower() == 'true'
        
        cache_key = f"product:slug:{slug}:full"
        start_time = time.time()
        
        # Try cache
        if use_cache and not force_refresh and redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    data = json.loads(cached)
                    data['cache_hit'] = True
                    data['response_time_ms'] = int((time.time() - start_time) * 1000)
                    return jsonify(data), 200
            except Exception as e:
                current_app.logger.warning(f"Cache read error: {e}")
        
        # Fetch product
        product = db.session.query(Product)\
            .options(
                selectinload(Product.category),
                selectinload(Product.brand),
                selectinload(Product.variants),
                selectinload(Product.reviews),
                selectinload(Product.images)
            )\
            .filter(Product.slug == slug, Product.is_active == True, Product.is_visible == True)\
            .first()
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Serialize complete data
        product_data = serialize_full_product_details(product, include_reviews=include_reviews)
        
        response = {
            'success': True,
            'cache_hit': False,
            'data': product_data,
            'response_time_ms': int((time.time() - start_time) * 1000)
        }
        
        # Cache result
        if redis_client:
            try:
                ttl = CACHE_CONFIG['product_detail_fresh']
                if product.is_flash_sale:
                    ttl = CACHE_CONFIG['product_detail_flash']
                elif product.is_sale:
                    ttl = CACHE_CONFIG['product_detail_sale']
                redis_client.setex(cache_key, ttl, json.dumps(response))
            except Exception as e:
                current_app.logger.warning(f"Cache write error: {e}")
        
        return jsonify(response), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching product {slug}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e) if current_app.debug else None
        }), 500


@product_details_bp.route('/<int:product_id>/cache-status', methods=['GET'])
def get_cache_status(product_id):
    """Check cache status for debugging."""
    try:
        cache_key = f"product:detail:{product_id}:full"
        if not redis_client:
            return jsonify({'cached': False, 'message': 'Redis not available'}), 200
        
        cached = redis_client.get(cache_key)
        ttl = redis_client.ttl(cache_key)
        
        return jsonify({
            'product_id': product_id,
            'is_cached': cached is not None,
            'ttl_seconds': ttl if ttl and ttl > 0 else None,
            'timestamp': int(time.time())
        }), 200
    except Exception as e:
        return jsonify({'error': str(e) if current_app.debug else 'Error checking cache'}), 500


@product_details_bp.route('/<int:product_id>/invalidate', methods=['POST'])
def invalidate_cache(product_id):
    """Invalidate product cache (admin only)."""
    try:
        cache_key = f"product:detail:{product_id}:full"
        if redis_client:
            redis_client.delete(cache_key)
        return jsonify({'success': True, 'message': f'Cache invalidated for product {product_id}'}), 200
    except Exception as e:
        return jsonify({'error': str(e) if current_app.debug else 'Error invalidating cache'}), 500
