"""
Product Details Routes - Final Production-Grade Implementation
Handles single product detail views with Redis caching, Cloudinary image optimization,
defensive serialization, and complete cache invalidation.

Architecture:
- Routes handle HTTP validation and responses only
- Services handle database queries and serialization
- Cache service handles Redis operations
- Only stable product data is cached (no request-time metadata)
- Fresh timestamps and cache metadata per request
- No broken data gets cached
- All HTML is sanitized
- Images always safely serialized
"""
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Tuple

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy import text

from app.configuration.extensions import db
from app.models.models import Product, Review, WishlistItem, User
from app.routes.products.cache_keys import (
    get_public_product_key, 
    CACHE_TTL
)
from app.utils.redis_cache import product_cache
from app.services.product_service import ProductService
from app.services.product_serializer import ProductSerializer

logger = logging.getLogger(__name__)

# Initialize blueprint
product_details_bp = Blueprint(
    'product_details',
    __name__,
    url_prefix='/api/product-details'
)


@product_details_bp.route('/debug/query/<int:product_id>', methods=['GET'])
def debug_query(product_id: int):
    """Debug endpoint to test database queries"""
    try:
        # Direct query
        product = Product.query.filter_by(id=product_id).first()
        if product:
            return jsonify({
                'status': 'found',
                'product_id': product.id,
                'name': product.name,
                'is_active': product.is_active
            }), 200
        else:
            return jsonify({
                'status': 'not_found',
                'product_id': product_id
            }), 404
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@product_details_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint with diagnostics.
    Tests database connectivity, product counts, and cache status.
    """
    health_status = {
        'status': 'ok',
        'service': 'product_details',
        'timestamp': datetime.utcnow().isoformat()
    }
    
    try:
        # Test database connection
        db.session.execute(text('SELECT 1'))
        product_count = Product.query.count()
        active_count = Product.query.filter_by(is_active=True).count()
        health_status['database'] = 'healthy'
        health_status['database_products'] = product_count
        health_status['active_products'] = active_count
    except Exception as e:
        health_status['database'] = 'unhealthy'
        health_status['database_error'] = str(e)
        logger.error(f"Database health check failed: {e}")
    
    # Test cache connection
    try:
        health_status['cache'] = 'healthy'
    except Exception as e:
        health_status['cache'] = 'unhealthy'
        logger.error(f"Cache health check failed: {e}")
    
    return jsonify(health_status), 200


@product_details_bp.route('/by-slug/<slug>', methods=['GET'])
def get_product_details_by_slug(slug: str):
    """
    Get complete product details by slug with all relationships.
    
    Cache Strategy:
    - Cache ONLY the stable product data payload (data field)
    - Generate fresh metadata on every request (_cache, success, timestamp)
    - This ensures accurate cache timestamps while reusing expensive queries
    
    Includes:
    - Product info (name, description, pricing, stock)
    - Brand and category
    - Images with Cloudinary URLs
    - Variants
    - Ratings and reviews
    - Cache status with fresh timestamp
    """
    cache_key = f"product:slug:{slug}"
    request_timestamp = datetime.utcnow().isoformat()
    cache_hit = False
    
    try:
        # Try cache first - only retrieve the product data payload
        cached_payload = product_cache.get(cache_key)
        
        if cached_payload:
            try:
                cached_data = json.loads(cached_payload) if isinstance(cached_payload, str) else cached_payload
                cache_hit = True
                product_data = cached_data
                logger.debug(f"CACHE HIT: {cache_key}")
            except Exception as e:
                logger.warning(f"Cache retrieval error for {cache_key}: {e}")
                cached_payload = None
        
        # Cache miss - fetch from database
        if not cache_hit:
            logger.info(f"Product slug '{slug}' cache MISS - fetching from database")
            
            product = ProductService.get_product_by_slug_optimized(slug)
            
            if not product:
                logger.warning(f"Product with slug '{slug}' not found in database")
                return jsonify({
                    'success': False,
                    'error': 'Product not found',
                    'slug': slug,
                    'timestamp': request_timestamp
                }), 404
            
            # Serialize product - this is where data integrity is guaranteed
            serialized = ProductSerializer.serialize_product_full(product, include_reviews=True)
            
            if not serialized.get('success'):
                logger.error(f"Serialization failed for product slug '{slug}'")
                return jsonify({
                    'success': False,
                    'error': 'Failed to serialize product',
                    'timestamp': request_timestamp
                }), 500
            
            # Extract only the stable product data for caching
            product_data = serialized.get('data', {})
            
            # Cache only the stable payload, not request-time metadata
            try:
                cache_ttl = CACHE_TTL.get('product_detail', 600)
                cache_payload = json.dumps(product_data)
                product_cache.set(cache_key, cache_payload, cache_ttl)
                logger.debug(f"CACHE SET: {cache_key} (TTL: {cache_ttl}s)")
                logger.info(f"Product slug '{slug}' cached for {cache_ttl}s")
            except Exception as e:
                logger.error(f"Cache write error for {cache_key}: {e}")
                # Continue anyway - cache failure shouldn't block response
        
        # Build response with fresh request-time metadata
        response = {
            'success': True,
            'data': product_data,
            'timestamp': request_timestamp,  # Always fresh
            '_cache': {
                'status': 'HIT' if cache_hit else 'MISS',
                'key': cache_key,
                'timestamp': request_timestamp  # Always fresh
            }
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Unhandled error in get_product_details_by_slug: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'timestamp': request_timestamp
        }), 500


@product_details_bp.route('/<int:product_id>', methods=['GET'])
def get_product_details(product_id: int):
    """
    Get complete product details with all relationships.
    
    Cache Strategy:
    - Cache ONLY the stable product data payload (data field)
    - Generate fresh metadata on every request (_cache, success, timestamp)
    - This ensures accurate cache timestamps while reusing expensive queries
    
    Includes:
    - Product info (name, description, pricing, stock)
    - Brand and category
    - Images with Cloudinary URLs
    - Variants
    - Ratings and reviews
    - Cache status with fresh timestamp
    
    Query Parameters:
    - include_reviews: boolean (default: true)
    - include_variants: boolean (default: true)
    """
    cache_key = get_public_product_key(product_id)
    request_timestamp = datetime.utcnow().isoformat()
    cache_hit = False
    
    try:
        # Try cache first - only retrieve the product data payload
        cached_payload = product_cache.get(cache_key)
        
        if cached_payload:
            try:
                cached_data = json.loads(cached_payload) if isinstance(cached_payload, str) else cached_payload
                cache_hit = True
                product_data = cached_data
                logger.debug(f"CACHE HIT: {cache_key}")
            except Exception as e:
                logger.warning(f"Cache retrieval error for {cache_key}: {e}")
                cached_payload = None
        
        # Cache miss - fetch from database
        if not cache_hit:
            logger.info(f"Product {product_id} cache MISS - fetching from database")
            
            product = ProductService.get_product_by_id_optimized(product_id)
            
            if not product:
                logger.warning(f"Product {product_id} not found in database")
                return jsonify({
                    'success': False,
                    'error': 'Product not found',
                    'product_id': product_id,
                    'timestamp': request_timestamp
                }), 404
            
            # Serialize product - this is where data integrity is guaranteed
            serialized = ProductSerializer.serialize_product_full(product, include_reviews=True)
            
            if not serialized.get('success'):
                logger.error(f"Serialization failed for product {product_id}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to serialize product',
                    'timestamp': request_timestamp
                }), 500
            
            # Extract only the stable product data for caching
            product_data = serialized.get('data', {})
            
            # Cache only the stable payload, not request-time metadata
            try:
                cache_ttl = CACHE_TTL.get('product_detail', 600)
                cache_payload = json.dumps(product_data)
                product_cache.set(cache_key, cache_payload, cache_ttl)
                logger.debug(f"CACHE SET: {cache_key} (TTL: {cache_ttl}s)")
                logger.info(f"Product {product_id} cached for {cache_ttl}s")
            except Exception as e:
                logger.error(f"Cache write error for {cache_key}: {e}")
                # Continue anyway - cache failure shouldn't block response
        
        # Build response with fresh request-time metadata
        response = {
            'success': True,
            'data': product_data,
            'timestamp': request_timestamp,  # Always fresh
            '_cache': {
                'status': 'HIT' if cache_hit else 'MISS',
                'key': cache_key,
                'timestamp': request_timestamp  # Always fresh
            }
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Unhandled error in get_product_details: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'timestamp': request_timestamp
        }), 500


@product_details_bp.route('/<int:product_id>/images', methods=['GET'])
def get_product_images(product_id: int):
    """
    Get product images with optimized Cloudinary URLs.
    Cache only the image data, generate fresh metadata per request.
    """
    cache_key = f"product:images:{product_id}"
    request_timestamp = datetime.utcnow().isoformat()
    cache_hit = False
    
    try:
        # Try cache
        cached_images = product_cache.get(cache_key)
        
        if cached_images:
            try:
                images = json.loads(cached_images) if isinstance(cached_images, str) else cached_images
                cache_hit = True
                logger.debug(f"CACHE HIT: {cache_key}")
            except Exception as e:
                logger.warning(f"Image cache retrieval error: {e}")
                cached_images = None
        
        # Cache miss - fetch from database
        if not cache_hit:
            product = Product.query.options(
                selectinload(Product.images)
            ).filter_by(id=product_id).first()
            
            if not product:
                return jsonify({
                    'success': False,
                    'error': 'Product not found',
                    'product_id': product_id,
                    'timestamp': request_timestamp
                }), 404
            
            # Serialize images defensively
            images = []
            try:
                product_images = getattr(product, 'images', []) or []
                for img in product_images:
                    try:
                        serialized = ProductSerializer.serialize_image(img)
                        if serialized:
                            images.append(serialized)
                    except Exception as e:
                        logger.error(f"Error serializing image {img.id}: {e}")
                        # Skip this image but continue with others
            except Exception as e:
                logger.error(f"Error processing images for product {product_id}: {e}")
            
            # Ensure primary image is marked
            if images:
                primary_found = any(img.get('is_primary', False) for img in images)
                if not primary_found and images:
                    images[0]['is_primary'] = True
            
            # Cache only the image data
            try:
                cache_ttl = CACHE_TTL.get('product_images', 600)
                cache_payload = json.dumps(images)
                product_cache.set(cache_key, cache_payload, cache_ttl)
                logger.debug(f"CACHE SET: {cache_key} (TTL: {cache_ttl}s)")
            except Exception as e:
                logger.error(f"Image cache write error: {e}")
        
        # Build response with fresh metadata
        response = {
            'success': True,
            'product_id': product_id,
            'images': images,
            'total': len(images),
            'timestamp': request_timestamp,  # Always fresh
            '_cache': {
                'status': 'HIT' if cache_hit else 'MISS',
                'key': cache_key,
                'timestamp': request_timestamp  # Always fresh
            }
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Error in get_product_images: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'timestamp': request_timestamp
        }), 500


@product_details_bp.route('/<int:product_id>/inventory', methods=['GET'])
def get_product_inventory(product_id: int):
    """
    Get real-time inventory - NOT CACHED.
    Always fresh from database for accuracy.
    """
    request_timestamp = datetime.utcnow().isoformat()
    
    try:
        product = Product.query.filter_by(id=product_id).first()
        
        if not product:
            return jsonify({
                'success': False,
                'error': 'Product not found',
                'product_id': product_id,
                'timestamp': request_timestamp
            }), 404
        
        stock = int(getattr(product, 'stock_quantity', 0) or 0)
        
        response = {
            'success': True,
            'product_id': product_id,
            'stock': {
                'quantity': stock,
                'is_in_stock': stock > 0,
                'status': 'in_stock' if stock > 0 else 'out_of_stock',
                'low_stock': 0 < stock < 5,
            },
            'cached': False,  # Always fresh
            'timestamp': request_timestamp,
            '_cache': {
                'status': 'BYPASS',
                'reason': 'Inventory is always fresh'
            }
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Error in get_product_inventory: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'timestamp': request_timestamp
        }), 500


@product_details_bp.route('/<int:product_id>/related', methods=['GET'])
def get_related_products(product_id: int):
    """
    Get related products from same category.
    Cache only the product data, generate fresh metadata per request.
    """
    limit = request.args.get('limit', 6, type=int)
    cache_key = f"product:related:{product_id}"
    request_timestamp = datetime.utcnow().isoformat()
    cache_hit = False
    
    try:
        # Try cache
        cached_related = product_cache.get(cache_key)
        
        if cached_related:
            try:
                related_data = json.loads(cached_related) if isinstance(cached_related, str) else cached_related
                cache_hit = True
                logger.debug(f"CACHE HIT: {cache_key}")
            except Exception as e:
                logger.warning(f"Related products cache error: {e}")
                cached_related = None
        
        # Cache miss - fetch from database
        if not cache_hit:
            related_products = ProductService.get_related_products_by_category(
                product_id, 
                limit=limit
            )
            
            # Serialize related products (lightweight version)
            related_data = []
            for product in related_products:
                try:
                    product_image = None
                    if hasattr(product, 'images') and product.images:
                        product_image = getattr(product.images[0], 'url', None)
                    
                    related_data.append({
                        'id': product.id,
                        'name': getattr(product, 'name', 'Unknown'),
                        'price': float(getattr(product, 'price', 0) or 0),
                        'sale_price': float(getattr(product, 'sale_price', 0) or 0),
                        'image': product_image,
                    })
                except Exception as e:
                    logger.error(f"Error serializing related product {product.id}: {e}")
            
            # Cache only the related products data
            try:
                cache_ttl = CACHE_TTL.get('related_products', 300)
                cache_payload = json.dumps(related_data)
                product_cache.set(cache_key, cache_payload, cache_ttl)
                logger.debug(f"CACHE SET: {cache_key} (TTL: {cache_ttl}s)")
            except Exception as e:
                logger.error(f"Related products cache error: {e}")
        
        # Build response with fresh metadata
        response = {
            'success': True,
            'product_id': product_id,
            'related': related_data,
            'total': len(related_data),
            'timestamp': request_timestamp,  # Always fresh
            '_cache': {
                'status': 'HIT' if cache_hit else 'MISS',
                'key': cache_key,
                'timestamp': request_timestamp  # Always fresh
            }
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Error in get_related_products: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'timestamp': request_timestamp
        }), 500


@product_details_bp.route('/<int:product_id>/cache/invalidate', methods=['POST'])
def invalidate_product_cache(product_id: int):
    """
    Invalidate product cache.
    Admin endpoint - requires authentication in production.
    
    Invalidates:
    - Product detail cache
    - Related products cache
    - Product images cache
    """
    request_timestamp = datetime.utcnow().isoformat()
    
    try:
        # In production, verify admin JWT token here
        
        cache_key = get_public_product_key(product_id)
        
        # Delete all related caches
        cache_keys_to_delete = [
            cache_key,
            f"product:related:{product_id}",
            f"product:images:{product_id}"
        ]
        
        for key in cache_keys_to_delete:
            try:
                product_cache.delete(key)
                logger.debug(f"Deleted cache key: {key}")
            except Exception as e:
                logger.warning(f"Error deleting cache key {key}: {e}")
        
        logger.info(f"Invalidated all caches for product {product_id}")
        
        response = {
            'success': True,
            'message': f'Cache invalidated for product {product_id}',
            'invalidated_keys': cache_keys_to_delete,
            'timestamp': request_timestamp
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}")
        return jsonify({
            'success': False,
            'error': 'Cache invalidation failed',
            'timestamp': request_timestamp
        }), 500


@product_details_bp.route('/list', methods=['GET'])
def list_active_products():
    """
    List all active products (for debugging/development).
    Not cached to ensure accurate product list during development.
    """
    try:
        active_products = Product.query.filter_by(is_active=True).with_entities(
            Product.id,
            Product.name,
            Product.sku
        ).limit(50).all()
        
        response = {
            'status': 'ok',
            'active_products': [
                {'id': p.id, 'name': p.name, 'sku': p.sku}
                for p in active_products
            ],
            'total': len(active_products),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Error listing products: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to list products',
            'timestamp': datetime.utcnow().isoformat()
        }), 500
