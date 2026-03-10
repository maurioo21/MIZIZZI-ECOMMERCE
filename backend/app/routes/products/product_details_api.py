"""
Product Details API Endpoints
RESTful API for fetching and managing product details with full caching support
"""

import time
from flask import Blueprint, request, jsonify, current_app
from app.services.product_details_service import (
    product_service,
    inventory_service,
    ProductCacheService
)

# Create blueprint
product_details_api = Blueprint(
    'product_details_api',
    __name__,
    url_prefix='/api/product-details'
)


@product_details_api.route('/<int:product_id>', methods=['GET'])
def get_product_details(product_id):
    """
    Get complete product details by ID.
    
    Query Parameters:
    - cache: 'true'/'false' (default: true)
    - force: 'true' to bypass cache
    - admin: 'true' to include inactive products
    
    Performance:
    - Cache hit: ~30-50ms
    - Cache miss: ~150-300ms
    """
    try:
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        admin_mode = request.args.get('admin', 'false').lower() == 'true'
        
        result = product_service.get_product_details(
            product_id=product_id,
            use_cache=use_cache,
            force_refresh=force_refresh,
            include_inactive=admin_mode
        )
        
        if not result:
            return jsonify({'error': 'Product not found'}), 404
        
        return jsonify(result), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching product: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e) if current_app.debug else None
        }), 500


@product_details_api.route('/slug/<slug>', methods=['GET'])
def get_product_by_slug(slug):
    """Get product details by slug instead of ID"""
    try:
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        
        result = product_service.get_product_details(
            slug=slug,
            use_cache=use_cache,
            force_refresh=force_refresh
        )
        
        if not result:
            return jsonify({'error': 'Product not found'}), 404
        
        return jsonify(result), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching product: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@product_details_api.route('/<int:product_id>/inventory', methods=['GET'])
def check_inventory(product_id):
    """Check product availability"""
    try:
        quantity = request.args.get('quantity', 1, type=int)
        variant_id = request.args.get('variant_id', type=int)
        
        result = inventory_service.check_availability(
            product_id=product_id,
            quantity=quantity,
            variant_id=variant_id
        )
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@product_details_api.route('/<int:product_id>/cache-status', methods=['GET'])
def get_cache_status(product_id):
    """Debug endpoint: Check cache status for a product"""
    try:
        cache_service = ProductCacheService()
        cache_key = f"product:detail:{product_id}"
        
        cached_data = cache_service.get_cache(cache_key)
        
        return jsonify({
            'product_id': product_id,
            'is_cached': cached_data is not None,
            'cache_key': cache_key,
            'has_data': cached_data is not None,
            'timestamp': int(time.time())
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@product_details_api.route('/<int:product_id>/invalidate', methods=['POST'])
def invalidate_cache(product_id):
    """
    Admin endpoint: Invalidate cache for a product.
    Triggers cache refresh on next request.
    """
    try:
        cache_service = ProductCacheService()
        cache_service.invalidate_product_cache(product_id)
        
        return jsonify({
            'success': True,
            'message': f'Cache invalidated for product {product_id}'
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@product_details_api.route('/<int:product_id>', methods=['PUT', 'PATCH'])
def update_product(product_id):
    """
    Admin endpoint: Update product and automatically invalidate cache.
    Supports partial updates (PATCH) and full updates (PUT).
    """
    try:
        data = request.get_json()
        
        success, error = product_service.update_product_and_invalidate_cache(
            product_id=product_id,
            updates=data
        )
        
        if not success:
            return jsonify({'error': error}), 400
        
        # Fetch and return updated product
        result = product_service.get_product_details(
            product_id=product_id,
            force_refresh=True
        )
        
        return jsonify({
            'success': True,
            'message': 'Product updated successfully',
            'data': result['data'] if result else None
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error updating product: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@product_details_api.route('/<int:product_id>/inventory', methods=['POST'])
def update_inventory(product_id):
    """
    Admin endpoint: Update product inventory.
    Automatically invalidates cache.
    """
    try:
        data = request.get_json()
        quantity_change = data.get('quantity_change', 0)
        variant_id = data.get('variant_id')
        
        success, error = inventory_service.update_inventory(
            product_id=product_id,
            quantity_change=quantity_change,
            variant_id=variant_id
        )
        
        if not success:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'message': 'Inventory updated'
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Register blueprint
def init_product_details_api(app):
    """Initialize the product details API with the Flask app"""
    app.register_blueprint(product_details_api)
