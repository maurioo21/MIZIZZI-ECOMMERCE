"""
Carousel Management Routes
Handles carousel banner CRUD operations and carousel display
OPTIMIZED with Upstash Redis caching for fast frontend responses.
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
import logging
from functools import wraps
import requests
import os
from ...services.image_optimization_service import ImageOptimizationService
from ...services.cloudinary_service import CloudinaryService
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)

carousel_routes = Blueprint('carousel_routes', __name__)

# Initialize Cloudinary service
cloudinary_service = CloudinaryService()

# Allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

try:
    from ...utils.redis_cache import (
        product_cache,
        cached_response,
        fast_cached_response,
        invalidate_on_change,
        fast_json_dumps
    )
    CACHE_AVAILABLE = True
    logger.info("✅ Redis cache available for carousel routes")
except ImportError as e:
    logger.warning(f"Redis cache not available: {e}")
    CACHE_AVAILABLE = False
    product_cache = None
    
    def cached_response(prefix, ttl=30, key_params=None):
        def decorator(func):
            return func
        return decorator
    
    def fast_cached_response(prefix, ttl=30, key_params=None):
        def decorator(func):
            return func
        return decorator
    
    def invalidate_on_change(prefixes):
        def decorator(func):
            return func
        return decorator


# ============================================================================
# WEBHOOK HELPERS - Trigger frontend cache invalidation
# ============================================================================

def trigger_frontend_webhook(position: str, action: str = "update"):
    """
    Trigger webhook on frontend to invalidate carousel cache.
    This ensures carousel changes appear instantly to users.
    
    Args:
        position: carousel position (homepage, category_page, flash_sales, luxury_deals)
        action: create, update, or delete
    """
    try:
        webhook_url = os.environ.get('WEBHOOK_URL') or os.environ.get('FRONTEND_WEBHOOK_URL')
        webhook_secret = os.environ.get('CAROUSEL_WEBHOOK_SECRET', 'your-secret-key')
        
        if not webhook_url:
            logger.warning("⚠️ WEBHOOK_URL not configured - frontend cache won't update instantly")
            return False
        
        payload = {
            "position": position,
            "action": action,
            "secret": webhook_secret
        }
        
        # Send webhook with timeout
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=5,
            headers={"Content-Type": "application/json"}
        )
        
        if response.ok:
            logger.info(f"✅ Webhook triggered for carousel {action} at {position}")
            return True
        else:
            logger.warning(f"⚠️ Webhook returned {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        logger.error("❌ Webhook timeout - frontend cache may not update immediately")
        return False
    except Exception as e:
        logger.error(f"❌ Error triggering webhook: {str(e)}")
        return False

try:
    from ...models.carousel_model import CarouselBanner
    from ...configuration.extensions import db
    logger.info("✅ Imported CarouselBanner from models.carousel_model")
    CAROUSEL_AVAILABLE = True
except ImportError as e:
    logger.error(f"❌ Failed to import CarouselBanner: {str(e)}")
    CAROUSEL_AVAILABLE = False
    db = None
    CarouselBanner = None


def init_carousel_tables():
    """Initialize carousel tables if they don't exist."""
    if db is None:
        logger.warning("Database not available for carousel table initialization")
        return
    
    try:
        db.create_all()
        logger.info("✅ Carousel tables initialized successfully")
    except Exception as e:
        logger.error(f"❌ Error initializing carousel tables: {str(e)}")


# ============================================================================
# PUBLIC ROUTES - Get carousel items for display (OPTIMIZED with Redis)
# ============================================================================

@carousel_routes.route('/items', methods=['GET'])
@cached_response("carousel_items", ttl=60, key_params=["position", "limit"])
def get_carousel_items():
    """
    Get active carousel items for a specific position.
    OPTIMIZED: Redis cached for instant frontend loading.
    Query params: position (homepage, category_page, flash_sales, luxury_deals), limit (max items to return)
    """
    try:
        position = request.args.get('position', 'homepage')
        limit = request.args.get('limit', 5, type=int)
        
        # Enforce maximum limit to prevent cache overflow
        MAX_LIMIT = 5
        if limit > MAX_LIMIT:
            limit = MAX_LIMIT
            logger.warning(f"Limit {request.args.get('limit')} exceeds max {MAX_LIMIT}, clamping to {MAX_LIMIT}")
        
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            logger.warning(f"Carousel system not available, returning empty items")
            return {
                "success": False,
                "error": "Carousel system not available",
                "items": [],
                "position": position
            }, 503
        
        # Get active carousel items for the position, ordered by sort_order, limited to prevent cache overflow
        items = CarouselBanner.query.filter_by(
            position=position,
            is_active=True
        ).order_by(CarouselBanner.sort_order).limit(limit).all()
        
        logger.info(f"Retrieved {len(items)} active carousel items for position: {position} (limit: {limit})")
        
        carousel_data = [{
            "id": item.id,
            "name": item.name,
            "title": item.title,
            "description": item.description,
            "badge_text": item.badge_text,
            "discount": item.discount,
            "button_text": item.button_text,
            "link_url": item.link_url,
            "image_url": item.image_url,
            "sort_order": item.sort_order
        } for item in items]
        
        return {
            "success": True,
            "position": position,
            "items": carousel_data,
            "count": len(carousel_data),
            "limit": limit,
            "cached": CACHE_AVAILABLE,
            "cached_at": datetime.utcnow().isoformat()
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching carousel items: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "items": []
        }, 500


@carousel_routes.route('/item/<int:item_id>', methods=['GET'])
@cached_response("carousel_item", ttl=60, key_params=[])
def get_carousel_item(item_id):
    """Get a specific carousel item by ID. OPTIMIZED: Redis cached."""
    try:
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return {
                "success": False,
                "error": "Carousel system not available"
            }, 503
        
        item = CarouselBanner.query.get(item_id)
        if not item:
            return {
                "success": False,
                "error": "Carousel item not found"
            }, 404
        
        return {
            "success": True,
            "item": item.to_dict(),
            "cached": CACHE_AVAILABLE
        }, 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching carousel item: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }, 500


# ============================================================================
# ADMIN ROUTES - Manage carousel items (with cache invalidation)
# ============================================================================

@carousel_routes.route('/admin/all', methods=['GET'])
@jwt_required()
def get_all_carousel_items():
    """Get all carousel items for a specific position (admin)."""
    try:
        position = request.args.get('position', 'homepage')
        
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            logger.error("CarouselBanner model is not available")
            return jsonify({
                "success": False,
                "error": "Carousel system not available",
                "banners": []
            }), 503
        
        items = CarouselBanner.query.filter_by(position=position).order_by(
            CarouselBanner.sort_order
        ).all()
        
        logger.info(f"Admin retrieved {len(items)} carousel items for position: {position}")
        
        banners = [item.to_dict() for item in items]
        
        return jsonify({
            "success": True,
            "position": position,
            "banners": banners,
            "count": len(banners)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching carousel items: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "banners": []
        }), 500


@carousel_routes.route('/admin', methods=['POST'])
@jwt_required()
@invalidate_on_change(["carousel_items", "carousel_item"])
def create_carousel_item():
    """Create a new carousel item. Invalidates carousel cache and triggers frontend webhook."""
    try:
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return jsonify({
                "success": False,
                "error": "Carousel system not available"
            }), 503
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'title', 'button_text', 'image_url', 'position']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        # Get the highest sort_order for this position
        max_sort = db.session.query(db.func.max(CarouselBanner.sort_order)).filter_by(
            position=data['position']
        ).scalar() or 0
        
        # Create new carousel item
        new_item = CarouselBanner(
            name=data['name'],
            title=data['title'],
            description=data.get('description', ''),
            badge_text=data.get('badge_text', ''),
            discount=data.get('discount', ''),
            button_text=data['button_text'],
            link_url=data.get('link_url', ''),
            image_url=data['image_url'],
            image_public_id=data.get('image_public_id'),  # Store Cloudinary public_id
            position=data['position'],
            is_active=data.get('is_active', True),
            sort_order=max_sort + 1
        )
        
        db.session.add(new_item)
        db.session.commit()
        
        logger.info(f"Created carousel item: {new_item.id}")
        
        # Trigger frontend webhook for instant cache invalidation
        trigger_frontend_webhook(data['position'], "create")
        
        return jsonify({
            "success": True,
            "message": "Carousel item created successfully",
            "banner": new_item.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error creating carousel item: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@carousel_routes.route('/admin/<int:item_id>', methods=['PUT'])
@jwt_required()
@invalidate_on_change(["carousel_items", "carousel_item"])
def update_carousel_item(item_id):
    """Update a carousel item. Invalidates carousel cache and triggers frontend webhook."""
    try:
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return jsonify({
                "success": False,
                "error": "Carousel system not available"
            }), 503
        
        item = CarouselBanner.query.get(item_id)
        if not item:
            return jsonify({
                "success": False,
                "error": "Carousel item not found"
            }), 404
        
        data = request.get_json()
        position = data.get('position', item.position)
        
        # Update fields
        if 'name' in data:
            item.name = data['name']
        if 'title' in data:
            item.title = data['title']
        if 'description' in data:
            item.description = data['description']
        if 'badge_text' in data:
            item.badge_text = data['badge_text']
        if 'discount' in data:
            item.discount = data['discount']
        if 'button_text' in data:
            item.button_text = data['button_text']
        if 'link_url' in data:
            item.link_url = data['link_url']
        if 'image_url' in data:
            # Delete old image from Cloudinary if replacing
            if data.get('delete_old_image') and item.image_public_id:
                try:
                    cloudinary_service.delete_image(item.image_public_id)
                    logger.info(f"Old carousel image deleted from Cloudinary: {item.image_public_id}")
                except Exception as e:
                    logger.warning(f"Failed to delete old image: {str(e)}")
            
            item.image_url = data['image_url']
            item.image_public_id = data.get('image_public_id')  # Store Cloudinary public_id
            logger.info(f"Carousel image updated: {data['image_url']} (public_id: {data.get('image_public_id')})")
        if 'is_active' in data:
            item.is_active = data['is_active']
        if 'sort_order' in data:
            item.sort_order = data['sort_order']
        
        item.updated_at = datetime.now(timezone.utc)
        
        db.session.commit()
        
        logger.info(f"Updated carousel item: {item_id}")
        
        # Trigger frontend webhook for instant cache invalidation
        trigger_frontend_webhook(position, "update")
        
        return jsonify({
            "success": True,
            "message": "Carousel item updated successfully",
            "banner": item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error updating carousel item: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@carousel_routes.route('/admin/upload-image', methods=['POST'])
@jwt_required()
def upload_carousel_image():
    """Upload carousel image to Cloudinary CDN"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
        
        logger.info(f"Uploading carousel image to Cloudinary: {file.filename}")
        
        # Get carousel position from request if provided
        position = request.form.get('position', 'homepage')
        
        # Upload to Cloudinary using carousel folder
        result = cloudinary_service.upload_image(
            file=file,
            folder=f"mizizzi/carousel/{position}",
            alt_text=file.filename
        )
        
        if not result.get('success'):
            logger.error(f"Cloudinary upload failed: {result.get('error')}")
            return jsonify({'error': result.get('error', 'Upload failed')}), 500
        
        logger.info(f"Carousel image uploaded to Cloudinary: {result.get('public_id')}")
        
        return jsonify({
            'message': 'Image uploaded successfully to CDN',
            'success': True,
            'url': result.get('secure_url'),
            'secure_url': result.get('secure_url'),
            'public_id': result.get('public_id'),
            'width': result.get('width'),
            'height': result.get('height'),
            'format': result.get('format'),
            'bytes': result.get('bytes'),
        }), 200
        
    except Exception as e:
        logger.error(f"Error uploading carousel image: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Failed to upload image: {str(e)}'}), 500


@carousel_routes.route('/admin/<int:item_id>', methods=['DELETE'])
@jwt_required()
@invalidate_on_change(["carousel_items", "carousel_item"])
def delete_carousel_item(item_id):
    """Delete a carousel item. Invalidates carousel cache and triggers frontend webhook."""
    try:
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return jsonify({
                "success": False,
                "error": "Carousel system not available"
            }), 503
        
        item = CarouselBanner.query.get(item_id)
        if not item:
            return jsonify({
                "success": False,
                "error": "Carousel item not found"
            }), 404
        
        position = item.position
        
        # Delete image from Cloudinary if exists
        if item.image_public_id:
            try:
                cloudinary_service.delete_image(item.image_public_id)
                logger.info(f"Carousel image deleted from Cloudinary: {item.image_public_id}")
            except Exception as e:
                logger.warning(f"Failed to delete carousel image from Cloudinary: {str(e)}")
        
        db.session.delete(item)
        db.session.commit()
        
        logger.info(f"Deleted carousel item: {item_id}")
        
        # Trigger frontend webhook for instant cache invalidation
        trigger_frontend_webhook(position, "delete")
        
        return jsonify({
            "success": True,
            "message": "Carousel item deleted successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error deleting carousel item: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@carousel_routes.route('/admin/reorder', methods=['POST'])
@jwt_required()
@invalidate_on_change(["carousel_items"])
def reorder_carousel_items():
    """Reorder carousel items. Invalidates carousel cache and triggers frontend webhook."""
    try:
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return jsonify({
                "success": False,
                "error": "Carousel system not available"
            }), 503
        
        data = request.get_json()
        items_order = data.get('items', [])
        
        position = None
        for idx, item_data in enumerate(items_order):
            item = CarouselBanner.query.get(item_data['id'])
            if item:
                item.sort_order = idx + 1
                position = item.position
        
        db.session.commit()
        
        logger.info(f"Reordered carousel items")
        
        # Trigger frontend webhook for instant cache invalidation
        if position:
            trigger_frontend_webhook(position, "update")
        
        return jsonify({
            "success": True,
            "message": "Carousel items reordered successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error reordering carousel items: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@carousel_routes.route('/admin/bulk-update', methods=['POST'])
@jwt_required()
@invalidate_on_change(["carousel_items", "carousel_item"])
def bulk_update_carousel_items():
    """Bulk update carousel items. Invalidates carousel cache."""
    try:
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return jsonify({
                "success": False,
                "error": "Carousel system not available"
            }), 503
        
        data = request.get_json()
        item_ids = data.get('item_ids', [])
        updates = data.get('updates', {})
        
        for item_id in item_ids:
            item = CarouselBanner.query.get(item_id)
            if item:
                for key, value in updates.items():
                    if hasattr(item, key):
                        setattr(item, key, value)
        
        db.session.commit()
        
        logger.info(f"Bulk updated {len(item_ids)} carousel items")
        
        return jsonify({
            "success": True,
            "message": f"Updated {len(item_ids)} carousel items successfully",
            "updated_count": len(item_ids)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error bulk updating carousel items: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@carousel_routes.route('/admin/stats', methods=['GET'])
@jwt_required()
def get_carousel_stats():
    """Get carousel statistics."""
    try:
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return jsonify({
                "success": False,
                "error": "Carousel system not available",
                "stats": {}
            }), 503
        
        total_items = CarouselBanner.query.count()
        active_items = CarouselBanner.query.filter_by(is_active=True).count()
        
        # Count by position
        positions = {}
        for position in ['homepage', 'category_page', 'flash_sales', 'luxury_deals']:
            positions[position] = CarouselBanner.query.filter_by(position=position).count()
        
        return jsonify({
            "success": True,
            "stats": {
                "total_items": total_items,
                "active_items": active_items,
                "inactive_items": total_items - active_items,
                "by_position": positions
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching carousel stats: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "stats": {}
        }), 500


@carousel_routes.route('/cache/status', methods=['GET'])
def carousel_cache_status():
    """Get cache status for carousel routes."""
    cache_info = {
        "connected": False,
        "type": "none",
        "stats": {}
    }
    
    if CACHE_AVAILABLE and product_cache:
        cache_info = {
            "connected": product_cache.is_connected,
            "type": "upstash" if product_cache.is_connected else "memory",
            "stats": product_cache.stats
        }
    
    return jsonify({
        "service": "carousel",
        "cache": cache_info,
        "database_available": CAROUSEL_AVAILABLE,
        "timestamp": datetime.utcnow().isoformat()
    }), 200


@carousel_routes.route('/health', methods=['GET'])
def carousel_health():
    """Health check for carousel system."""
    cache_status = {
        "connected": product_cache.is_connected if CACHE_AVAILABLE and product_cache else False,
        "type": "upstash" if (CACHE_AVAILABLE and product_cache and product_cache.is_connected) else "none"
    }
    
    return jsonify({
        "status": "ok",
        "service": "carousel",
        "database_available": CAROUSEL_AVAILABLE,
        "cache": cache_status,
        "endpoints": [
            "GET /api/carousel/items",
            "GET /api/carousel/item/<id>",
            "GET /api/carousel/cache/status",
            "GET /api/carousel/admin/all",
            "POST /api/carousel/admin",
            "PUT /api/carousel/admin/<id>",
            "DELETE /api/carousel/admin/<id>",
            "POST /api/carousel/admin/reorder",
            "POST /api/carousel/admin/bulk-update",
            "GET /api/carousel/admin/stats"
        ]
    }), 200


# ============================================================================
# IMAGE OPTIMIZATION ROUTES - Generate LQIP and optimized URLs for frontend
# ============================================================================

@carousel_routes.route('/optimize/lqip', methods=['POST'])
@cached_response("carousel_lqip", ttl=3600)
def generate_lqip():
    """
    Generate LQIP (Low Quality Image Placeholder) for carousel images.
    This endpoint creates tiny blurred versions for instant display before full image loads.
    """
    try:
        data = request.get_json()
        image_url = data.get('image_url')
        
        if not image_url:
            return jsonify({
                "success": False,
                "error": "image_url is required"
            }), 400
        
        image_opt = ImageOptimizationService()
        lqip = image_opt.generate_lqip_from_url(image_url)
        
        if lqip:
            return jsonify({
                "success": True,
                "lqip": lqip,
                "image_url": image_url
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Failed to generate LQIP",
                "image_url": image_url
            }), 400
            
    except Exception as e:
        logger.error(f"Error generating LQIP: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@carousel_routes.route('/optimize/responsive', methods=['POST'])
@cached_response("carousel_responsive_urls", ttl=3600)
def generate_responsive_urls():
    """
    Generate responsive image URLs for carousel images at different breakpoints.
    Returns optimized URLs for mobile, tablet, and desktop.
    """
    try:
        data = request.get_json()
        image_url = data.get('image_url')
        
        if not image_url:
            return jsonify({
                "success": False,
                "error": "image_url is required"
            }), 400
        
        # Extract Cloudinary public ID from URL
        if 'cloudinary.com' not in image_url:
            return jsonify({
                "success": False,
                "error": "Only Cloudinary images are supported for responsive optimization"
            }), 400
        
        try:
            public_id = image_url.split('/upload/')[-1]
            # Remove version string if present
            if '/' in public_id:
                public_id = public_id.split('/')[0]
        except:
            return jsonify({
                "success": False,
                "error": "Could not extract public ID from image URL"
            }), 400
        
        image_opt = ImageOptimizationService()
        urls = image_opt.generate_optimized_carousel_urls(public_id)
        
        return jsonify({
            "success": True,
            "image_url": image_url,
            "public_id": public_id,
            "responsive_urls": urls
        }), 200
            
    except Exception as e:
        logger.error(f"Error generating responsive URLs: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@carousel_routes.route('/items/optimized', methods=['GET'])
@cached_response("carousel_items_optimized", ttl=60, key_params=["position"])
def get_optimized_carousel_items():
    """
    Get carousel items with optimizations: LQIP and responsive URLs pre-generated.
    This endpoint provides everything the frontend needs for instant display.
    """
    try:
        position = request.args.get('position', 'homepage')
        limit = request.args.get('limit', 5, type=int)
        
        # Enforce limits
        if limit > 5:
            limit = 5
        
        if not CAROUSEL_AVAILABLE or CarouselBanner is None:
            return jsonify({
                "success": False,
                "error": "Carousel system not available",
                "items": []
            }), 503
        
        items = CarouselBanner.query.filter_by(
            position=position,
            is_active=True
        ).order_by(CarouselBanner.sort_order).limit(limit).all()
        
        image_opt = ImageOptimizationService()
        optimized_items = []
        
        for item in items:
            # Generate LQIP for ultra-fast placeholder
            lqip = image_opt.generate_lqip_from_url(item.image_url)
            
            optimized_item = {
                "id": item.id,
                "name": item.name,
                "title": item.title,
                "description": item.description,
                "badge_text": item.badge_text,
                "discount": item.discount,
                "button_text": item.button_text,
                "link_url": item.link_url,
                "image_url": item.image_url,
                "lqip": lqip,  # Tiny blurred placeholder
                "sort_order": item.sort_order
            }
            
            # Try to generate responsive URLs if it's a Cloudinary image
            if 'cloudinary.com' in item.image_url:
                try:
                    public_id = item.image_url.split('/upload/')[-1]
                    if '/' in public_id:
                        public_id = public_id.split('/')[0]
                    responsive = image_opt.generate_optimized_carousel_urls(public_id)
                    optimized_item['responsive_urls'] = responsive
                except Exception as e:
                    logger.warning(f"Could not generate responsive URLs for item {item.id}: {str(e)}")
            
            optimized_items.append(optimized_item)
        
        return jsonify({
            "success": True,
            "position": position,
            "items": optimized_items,
            "count": len(optimized_items),
            "limit": limit,
            "optimizations": {
                "lqip": "Generated",
                "responsive": "Included where available"
            },
            "cached_at": datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching optimized carousel items: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "items": []
        }), 500
