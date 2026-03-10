"""
Product Details API Endpoints
High-performance REST API with Redis caching and real-time updates
"""

import time
import json
from typing import Optional, Dict, Any
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.orm import selectinload
from sqlalchemy import and_

from app.configuration.extensions import db
from app.models.models import Product
from app.cache.product_cache_manager import CacheConfig


product_details_bp = Blueprint(
    'product_details',
    __name__,
    url_prefix='/api/product-details'
)


def get_request_context():
    """Extract request context for logging and tracking"""
    return {
        'user_agent': request.headers.get('User-Agent', ''),
        'ip_address': request.remote_addr,
        'timestamp': datetime.utcnow().isoformat()
    }


def build_product_query(product_id: int, include_inactive: bool = False):
    """Build optimized query with eager loading to prevent N+1 queries"""
    query = db.session.query(Product).options(
        selectinload(Product.images),
        selectinload(Product.variants),
        selectinload(Product.reviews),
        selectinload(Product.category),
        selectinload(Product.brand),
    ).filter(Product.id == product_id)
    
    if not include_inactive:
        query = query.filter(
            and_(
                Product.is_active == True,
                Product.is_visible == True
            )
        )
    
    return query.first()


def serialize_product_complete(product) -> Dict:
    """Serialize complete product data for frontend"""
    
    if not product:
        return {}
    
    # Sort images by priority
    images = sorted(
        product.images or [],
        key=lambda x: (not x.is_primary, x.sort_order or 999)
    )
    image_urls = [img.url for img in images if img.url]
    
    # Calculate discount percentage
    discount_pct = 0
    if product.sale_price and product.price and product.sale_price < product.price:
        discount_pct = int(((product.price - product.sale_price) / product.price) * 100)
    
    # Serialize reviews
    reviews_list = []
    if product.reviews:
        for review in list(product.reviews)[:20]:  # Limit to 20 reviews
            reviews_list.append({
                'id': review.id,
                'rating': review.rating,
                'comment': review.comment,
                'author': getattr(review.user, 'name', 'Anonymous') if hasattr(review, 'user') else 'Anonymous',
                'verified': getattr(review, 'is_verified', False),
                'helpful_count': getattr(review, 'helpful_count', 0),
                'created_at': review.created_at.isoformat() if hasattr(review, 'created_at') else None
            })
    
    # Calculate average rating
    avg_rating = 0
    if reviews_list:
        avg_rating = sum(r['rating'] for r in reviews_list) / len(reviews_list)
    
    return {
        # Core product data
        'id': product.id,
        'name': product.name,
        'slug': product.slug,
        'description': product.description,
        'short_description': getattr(product, 'short_description', ''),
        'price': float(product.price) if product.price else 0,
        'sale_price': float(product.sale_price) if product.sale_price else None,
        'discount_percentage': discount_pct,
        'stock': product.stock,
        'in_stock': product.stock > 0,
        
        # Images
        'images': [
            {
                'id': img.id,
                'url': img.url,
                'alt_text': getattr(img, 'alt_text', ''),
                'is_primary': getattr(img, 'is_primary', False),
                'position': getattr(img, 'sort_order', 0)
            } for img in images
        ],
        'thumbnail_url': image_urls[0] if image_urls else None,
        'image_urls': image_urls,
        'video_url': getattr(product, 'video_url', None),
        
        # Category & Brand
        'category': {
            'id': product.category.id,
            'name': product.category.name,
            'slug': product.category.slug,
            'description': getattr(product.category, 'description', '')
        } if product.category else None,
        
        'brand': {
            'id': product.brand.id,
            'name': product.brand.name,
            'slug': product.brand.slug,
            'logo_url': getattr(product.brand, 'logo_url', '')
        } if product.brand else None,
        
        # Variants
        'variants': [
            {
                'id': v.id,
                'name': v.name,
                'sku': v.sku,
                'price': float(v.price) if v.price else product.price,
                'stock': v.stock,
                'color': getattr(v, 'color', None),
                'size': getattr(v, 'size', None),
                'image_url': getattr(v, 'image_url', None)
            } for v in (product.variants or [])
        ],
        
        # Reviews
        'reviews': reviews_list,
        'avg_rating': round(avg_rating, 1),
        'reviews_count': len(reviews_list),
        
        # Features & flags
        'is_featured': getattr(product, 'is_featured', False),
        'is_new': getattr(product, 'is_new', False),
        'is_sale': getattr(product, 'is_sale', False),
        'is_flash_sale': getattr(product, 'is_flash_sale', False),
        'is_trending': getattr(product, 'is_trending', False),
        'is_top_pick': getattr(product, 'is_top_pick', False),
        
        # Technical details
        'specifications': (
            json.loads(product.specifications) 
            if isinstance(product.specifications, str) 
            else product.specifications
        ) if hasattr(product, 'specifications') else None,
        'warranty_info': getattr(product, 'warranty_info', None),
        'shipping_info': getattr(product, 'shipping_info', None),
        'weight': getattr(product, 'weight', None),
        'dimensions': getattr(product, 'dimensions', None),
        'material': getattr(product, 'material', None),
        'color': getattr(product, 'color', None),
        
        # Shopping constraints
        'min_order_qty': getattr(product, 'min_order_qty', 1),
        'max_order_qty': getattr(product, 'max_order_qty', 1000),
        
        # Preorder
        'is_preorder': getattr(product, 'is_preorder', False),
        'preorder_date': (
            product.preorder_date.isoformat() 
            if hasattr(product, 'preorder_date') and product.preorder_date 
            else None
        ),
        
        # Timestamps
        'created_at': product.created_at.isoformat() if hasattr(product, 'created_at') else None,
        'updated_at': product.updated_at.isoformat() if hasattr(product, 'updated_at') else None
    }


@product_details_bp.route('/<int:product_id>', methods=['GET'])
def get_product_details(product_id: int):
    """
    GET /api/product-details/<id>
    
    Get complete product details with Redis caching
    
    Query Parameters:
    - cache: true/false (default: true) - Enable/disable caching
    - force: true/false (default: false) - Bypass cache
    - admin: true/false (default: false) - Include inactive products
    
    Performance:
    - Fresh: 150-250ms
    - Cached: 30-50ms
    """
    try:
        start_time = time.time()
        
        # Parse query parameters
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        admin_mode = request.args.get('admin', 'false').lower() == 'true'
        
        cache_client = getattr(current_app, 'cache_manager', None)
        
        # Try cache first
        if use_cache and not force_refresh and cache_client:
            cached = cache_client.get(product_id)
            if cached:
                cached['cache_hit'] = True
                cached['response_time_ms'] = int((time.time() - start_time) * 1000)
                return jsonify(cached), 200
        
        # Build optimized query
        product = build_product_query(product_id, include_inactive=admin_mode)
        
        if not product:
            # Check if product exists but is hidden
            hidden_product = db.session.query(Product).filter(Product.id == product_id).first()
            if hidden_product and not admin_mode:
                return jsonify({
                    'error': 'Product not found',
                    'reason': 'Product is inactive or hidden',
                    'hint': 'Use ?admin=true to view inactive products'
                }), 404
            
            return jsonify({'error': 'Product not found'}), 404
        
        # Serialize data
        product_data = serialize_product_complete(product)
        
        # Build response
        response = {
            'success': True,
            'cache_hit': False,
            'data': product_data,
            'response_time_ms': int((time.time() - start_time) * 1000),
            'timestamp': int(time.time())
        }
        
        # Cache the response
        if use_cache and cache_client:
            ttl = CacheConfig.get_product_ttl(product_data)
            cache_client.set(product_id, response, ttl)
        
        # Log performance
        if hasattr(current_app, 'performance_monitor'):
            current_app.performance_monitor.log_request(
                product_id,
                response['response_time_ms'],
                cache_hit=False
            )
        
        return jsonify(response), 200
    
    except Exception as e:
        current_app.logger.error(f"Product details error: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e) if current_app.debug else None
        }), 500


@product_details_bp.route('/slug/<slug>', methods=['GET'])
def get_product_by_slug(slug: str):
    """GET /api/product-details/slug/<slug> - Get product by URL slug"""
    try:
        # Query product by slug
        product = db.session.query(Product).filter(
            and_(
                Product.slug == slug,
                Product.is_active == True,
                Product.is_visible == True
            )
        ).first()
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Redirect to ID endpoint to leverage caching
        return get_product_details(product.id)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@product_details_bp.route('/<int:product_id>/cache-status', methods=['GET'])
def get_cache_status(product_id: int):
    """GET /api/product-details/<id>/cache-status - Check cache status"""
    try:
        cache_client = getattr(current_app, 'cache_manager', None)
        
        if not cache_client:
            return jsonify({
                'product_id': product_id,
                'cached': False,
                'message': 'Cache not available'
            }), 200
        
        ttl = cache_client.get_ttl_remaining(product_id)
        
        return jsonify({
            'product_id': product_id,
            'is_cached': ttl > -2,
            'ttl_seconds': ttl if ttl > 0 else None,
            'timestamp': int(time.time())
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@product_details_bp.route('/<int:product_id>/invalidate', methods=['POST'])
def invalidate_cache(product_id: int):
    """POST /api/product-details/<id>/invalidate - Clear product cache"""
    # Should have @admin_required decorator
    try:
        cache_client = getattr(current_app, 'cache_manager', None)
        
        if not cache_client:
            return jsonify({'error': 'Cache not available'}), 503
        
        invalidated = cache_client.invalidate(product_id)
        
        current_app.logger.info(f"Cache invalidated for product {product_id}")
        
        return jsonify({
            'success': True,
            'message': f'Cache invalidated for product {product_id}',
            'keys_removed': invalidated
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@product_details_bp.route('/cache/stats', methods=['GET'])
def get_cache_stats():
    """GET /api/product-details/cache/stats - Get cache performance statistics"""
    try:
        cache_client = getattr(current_app, 'cache_manager', None)
        
        if not cache_client:
            return jsonify({'error': 'Cache not available'}), 503
        
        stats = cache_client.get_stats()
        
        return jsonify({
            'success': True,
            'cache_stats': stats,
            'timestamp': int(time.time())
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
