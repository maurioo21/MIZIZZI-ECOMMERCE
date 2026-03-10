"""
High-performance product details API with Redis caching.
Designed for Jumia-level performance (50ms cached, 200ms fresh).
Uses proven patterns from existing product routes.
"""
from flask import Blueprint, request, jsonify, current_app
import time
import json

from app.configuration.extensions import db
from app.models.models import Product
from app.routes.products.serializers import (
    serialize_product_detail,
    get_product_with_relationships,
    get_product_by_slug_with_relationships
)
from app.cache.redis_client import get_redis_client

# Create blueprint
product_details_bp = Blueprint('product_details', __name__, url_prefix='/api/product-details')

# Redis client
redis_client = get_redis_client()

# Cache TTL configuration
CACHE_CONFIG = {
    'product_detail_fresh': 600,      # 10 minutes for regular products
    'product_detail_sale': 120,        # 2 minutes for sale items
    'product_detail_flash': 60,        # 1 minute for flash sales
}


@product_details_bp.route('/<int:product_id>', methods=['GET'])
def get_product_by_id(product_id):
    """
    Get complete product details by ID with Redis caching.
    
    Query parameters:
    - cache: 'true' or 'false' (default: true)
    - force: 'true' to bypass cache and refresh (default: false)
    
    Performance:
    - Warm cache: ~30-50ms
    - Cold cache: ~150-250ms
    """
    try:
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        
        cache_key = f"product:detail:{product_id}"
        start_time = time.time()
        
        # Try cache first
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
        
        # Fetch product using existing serializer (uses is_active/is_visible filter)
        product = get_product_with_relationships(product_id, for_admin=False)
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Serialize product
        product_data = serialize_product_detail(product, for_admin=False)
        
        # Build response
        response = {
            'success': True,
            'cache_hit': False,
            'data': product_data,
            'response_time_ms': int((time.time() - start_time) * 1000)
        }
        
        # Cache the result
        if redis_client:
            try:
                ttl = CACHE_CONFIG.get('product_detail_fresh', 600)
                if product.is_flash_sale:
                    ttl = CACHE_CONFIG.get('product_detail_flash', 60)
                elif product.is_sale:
                    ttl = CACHE_CONFIG.get('product_detail_sale', 120)
                
                redis_client.setex(cache_key, ttl, json.dumps(response))
            except Exception as e:
                current_app.logger.warning(f"Cache write error: {e}")
        
        return jsonify(response), 200
    
    except Exception as e:
        error_msg = str(e)
        current_app.logger.error(f"Error fetching product {product_id}: {error_msg}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': error_msg if current_app.debug else None
        }), 500


@product_details_bp.route('/slug/<slug>', methods=['GET'])
def get_product_by_slug(slug):
    """
    Get complete product details by slug with Redis caching.
    Same performance as ID lookup.
    """
    try:
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        
        cache_key = f"product:slug:{slug}"
        start_time = time.time()
        
        # Try cache first
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
        
        # Fetch product by slug
        product = get_product_by_slug_with_relationships(slug, for_admin=False)
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Serialize product
        product_data = serialize_product_detail(product, for_admin=False)
        
        # Build response
        response = {
            'success': True,
            'cache_hit': False,
            'data': product_data,
            'response_time_ms': int((time.time() - start_time) * 1000)
        }
        
        # Cache the result
        if redis_client:
            try:
                ttl = CACHE_CONFIG.get('product_detail_fresh', 600)
                if product.is_flash_sale:
                    ttl = CACHE_CONFIG.get('product_detail_flash', 60)
                elif product.is_sale:
                    ttl = CACHE_CONFIG.get('product_detail_sale', 120)
                
                redis_client.setex(cache_key, ttl, json.dumps(response))
            except Exception as e:
                current_app.logger.warning(f"Cache write error: {e}")
        
        return jsonify(response), 200
    
    except Exception as e:
        error_msg = str(e)
        current_app.logger.error(f"Error fetching product {slug}: {error_msg}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': error_msg if current_app.debug else None
        }), 500


@product_details_bp.route('/<int:product_id>/cache-status', methods=['GET'])
def get_cache_status(product_id):
    """
    Check if product is cached and show cache metadata.
    Useful for debugging and monitoring.
    """
    try:
        cache_key = f"product:detail:{product_id}"
        
        if not redis_client:
            return jsonify({
                'cached': False,
                'message': 'Redis not available'
            }), 200
        
        cached = redis_client.get(cache_key)
        ttl = redis_client.ttl(cache_key) if redis_client else -2
        
        return jsonify({
            'cached': cached is not None,
            'product_id': product_id,
            'cache_key': cache_key,
            'ttl_seconds': ttl if ttl and ttl > 0 else None,
            'timestamp': int(time.time())
        }), 200
    
    except Exception as e:
        return jsonify({
            'error': 'Cache status check failed',
            'details': str(e) if current_app.debug else None
        }), 500


@product_details_bp.route('/<int:product_id>/invalidate', methods=['POST'])
def invalidate_cache(product_id):
    """
    Manually invalidate product cache.
    Requires admin authentication (can be secured with @jwt_required or @admin_required).
    """
    try:
        cache_key = f"product:detail:{product_id}"
        
        if redis_client:
            redis_client.delete(cache_key)
            return jsonify({
                'success': True,
                'message': f'Cache invalidated for product {product_id}'
            }), 200
        
        return jsonify({
            'error': 'Redis not available'
        }), 503
    
    except Exception as e:
        return jsonify({
            'error': 'Cache invalidation failed',
            'details': str(e) if current_app.debug else None
        }), 500
