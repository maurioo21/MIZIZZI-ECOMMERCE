"""
Admin routes for managing categories including CRUD operations and image uploads.
This file mirrors backend/routes/admin/admin_categories_routes.py for import compatibility.
Uses Cloudinary for image storage instead of database binary storage.
"""
from flask import Blueprint, request, jsonify, current_app, send_file
from functools import wraps
import os
from werkzeug.utils import secure_filename
from app.models.models import db, Category
from app.services.cloudinary_service import CloudinaryService
from datetime import datetime
import re
import inspect
import threading
import io
import base64

# Initialize Cloudinary service
cloudinary_service = CloudinaryService()

admin_categories_bp = Blueprint('admin_categories', __name__)

# Helper function to create slug from name
def create_slug(name):
    """Create URL-friendly slug from category name"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug

# Helper function for file uploads
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Admin authentication decorator (simplified - adjust based on your auth system)
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Add your admin authentication logic here
        # For now, check for Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Socket helpers (lightweight): try to find socketio instance and emit safely outside request thread.
def _get_socketio():
    try:
        # Common attachment points
        if hasattr(current_app, 'extensions') and current_app.extensions.get('socketio'):
            return current_app.extensions.get('socketio')
        app_obj = getattr(current_app, '_get_current_object', lambda: current_app)()
        sio = getattr(app_obj, 'socketio', None)
        if sio:
            return sio
    except Exception:
        pass
    return current_app.config.get('SOCKETIO')

def _emit_event(event, data):
    """
    Safely emit SocketIO events with proper app context handling.
    
    Avoids the "write() before start_response" error by ensuring
    events are emitted within an app context.
    """
    try:
        if not hasattr(current_app, 'socketio'):
            return
        
        sio = current_app.socketio
        if not sio:
            return
        
        # Use SocketIO's built-in background task support if available
        if hasattr(sio, 'start_background_task'):
            try:
                sio.start_background_task(_do_emit_safe, event, data, current_app._get_current_object())
                return
            except Exception:
                pass
        
        # Fallback: emit synchronously within current request context
        # This is safe because we're inside a Flask request
        try:
            sio.emit(event, data, namespace='/')
        except Exception as e:
            current_app.logger.debug(f"SocketIO emit error (non-fatal): {e}")
            
    except Exception as e:
        # Silent fail - don't let SocketIO errors break the API
        try:
            current_app.logger.debug(f"SocketIO event emission failed: {e}")
        except Exception:
            pass

def _do_emit_safe(event, data, app):
    """
    Safe background emit within app context.
    This function runs in a background thread with proper app context.
    """
    try:
        with app.app_context():
            if hasattr(app, 'socketio') and app.socketio:
                app.socketio.emit(event, data, namespace='/')
    except Exception as e:
        try:
            app.logger.debug(f"Background SocketIO emit failed: {e}")
        except Exception:
            pass

@admin_categories_bp.route('/categories', methods=['GET'])
@admin_required
def get_all_categories():
    """Get all categories with pagination and filtering"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        parent_id = request.args.get('parent_id', type=int)
        is_featured = request.args.get('is_featured', type=bool)
        
        # Build query - Show all categories, not just active ones
        query = Category.query
        
        if parent_id is not None:
            if parent_id == 0:
                query = query.filter_by(parent_id=None)
            else:
                query = query.filter_by(parent_id=parent_id)
        
        if is_featured is not None:
            query = query.filter_by(is_featured=is_featured)
        
        # Order by sort_order and name
        query = query.order_by(Category.sort_order.asc(), Category.name.asc())
        
        # Paginate
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        categories = [cat.to_dict() for cat in paginated.items]
        
        return jsonify({
            'items': categories,
            'total': paginated.total,
            'page': page,
            'per_page': per_page,
            'pages': paginated.pages
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching categories: {str(e)}")
        return jsonify({'error': 'Failed to fetch categories'}), 500

@admin_categories_bp.route('/categories/<int:category_id>', methods=['GET'])
@admin_required
def get_category(category_id):
    """Get single category by ID"""
    try:
        category = Category.query.get_or_404(category_id)
        return jsonify(category.to_dict()), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching category {category_id}: {str(e)}")
        return jsonify({'error': 'Category not found'}), 404

@admin_categories_bp.route('/categories', methods=['POST'])
@admin_required
def create_category():
    """Create new category with Cloudinary image support"""
    try:
        data = request.get_json()
        
        if not data or not data.get('name'):
            return jsonify({'error': 'Category name is required'}), 400
        
        # Generate slug from name if not provided
        slug = data.get('slug') or create_slug(data['name'])
        
        # Check if slug already exists
        existing = Category.query.filter_by(slug=slug).first()
        if existing:
            return jsonify({'error': 'Category with this slug already exists'}), 400
        
        category = Category(
            name=data['name'],
            slug=slug,
            description=data.get('description'),
            is_featured=data.get('is_featured', False),
            parent_id=data.get('parent_id'),
            sort_order=data.get('sort_order', 0),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Handle category image - now expects Cloudinary URL and public_id
        if data.get('image_url'):
            category.image_url = data['image_url']
            category.image_public_id = data.get('image_public_id')
            current_app.logger.info(f"Category image set: {data['image_url']} (public_id: {data.get('image_public_id')})")
        
        # Handle banner image - now expects Cloudinary URL and public_id
        if data.get('banner_url'):
            category.banner_url = data['banner_url']
            category.banner_public_id = data.get('banner_public_id')
            current_app.logger.info(f"Category banner set: {data['banner_url']} (public_id: {data.get('banner_public_id')})")
        
        db.session.add(category)
        db.session.commit()

        try:
            payload = {
                'id': category.id,
                'name': category.name,
                'slug': category.slug,
                'parent_id': category.parent_id,
                'is_featured': category.is_featured,
                'sort_order': category.sort_order
            }
            _emit_event('category_created', payload)
        except Exception:
            # Non-fatal - category still created even if WebSocket fails
            pass
        
        return jsonify({
            'message': 'Category created successfully',
            'category': category.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating category: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to create category'}), 500

@admin_categories_bp.route('/categories/<int:category_id>', methods=['PUT'])
@admin_required
def update_category(category_id):
    """Update existing category with Cloudinary image support"""
    try:
        category = Category.query.get_or_404(category_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            category.name = data['name']
            # Update slug if name changed
            if not data.get('slug'):
                category.slug = create_slug(data['name'])
        
        if 'slug' in data:
            # Check if new slug already exists (excluding current category)
            existing = Category.query.filter_by(slug=data['slug']).filter(Category.id != category_id).first()
            if existing:
                return jsonify({'error': 'Category with this slug already exists'}), 400
            category.slug = data['slug']
        
        if 'description' in data:
            category.description = data['description']
        
        # Handle image updates - now expects Cloudinary URL and public_id
        if 'image_url' in data and data['image_url']:
            # Delete old image from Cloudinary if replace with delete flag
            if data.get('delete_old_image') and category.image_public_id:
                try:
                    cloudinary_service.delete_image(category.image_public_id)
                    current_app.logger.info(f"Old category image deleted from Cloudinary: {category.image_public_id}")
                except Exception as e:
                    current_app.logger.warning(f"Failed to delete old image: {str(e)}")
            
            category.image_url = data['image_url']
            category.image_public_id = data.get('image_public_id')
            current_app.logger.info(f"Category image updated: {data['image_url']} (public_id: {data.get('image_public_id')})")
        
        # Handle banner updates - now expects Cloudinary URL and public_id
        if 'banner_url' in data and data['banner_url']:
            # Delete old banner from Cloudinary if replace with delete flag
            if data.get('delete_old_banner') and category.banner_public_id:
                try:
                    cloudinary_service.delete_image(category.banner_public_id)
                    current_app.logger.info(f"Old category banner deleted from Cloudinary: {category.banner_public_id}")
                except Exception as e:
                    current_app.logger.warning(f"Failed to delete old banner: {str(e)}")
            
            category.banner_url = data['banner_url']
            category.banner_public_id = data.get('banner_public_id')
            current_app.logger.info(f"Category banner updated: {data['banner_url']} (public_id: {data.get('banner_public_id')})")
        
        if 'is_featured' in data:
            category.is_featured = data['is_featured']
        if 'parent_id' in data:
            category.parent_id = data['parent_id']
        if 'sort_order' in data:
            category.sort_order = data['sort_order']
        
        category.updated_at = datetime.utcnow()
        
        db.session.commit()

        try:
            payload = {
                'id': category.id,
                'name': category.name,
                'slug': category.slug,
                'parent_id': category.parent_id,
                'is_featured': category.is_featured,
                'sort_order': category.sort_order,
                'updated_at': category.updated_at.isoformat()
            }
            _emit_event('category_updated', payload)
        except Exception:
            pass
        
        return jsonify({
            'message': 'Category updated successfully',
            'category': category.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating category {category_id}: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to update category'}), 500

@admin_categories_bp.route('/categories/<int:category_id>', methods=['DELETE'])
@admin_required
def delete_category(category_id):
    """Delete category and remove associated images from Cloudinary"""
    try:
        category = Category.query.get_or_404(category_id)
        
        # Check if category has subcategories
        from app.models.models import Category as CategoryModel
        subcategories = CategoryModel.query.filter_by(parent_id=category_id).count()
        if subcategories > 0:
            return jsonify({'error': 'Cannot delete category with subcategories'}), 400
        
        # Delete images from Cloudinary
        if category.image_public_id:
            try:
                cloudinary_service.delete_image(category.image_public_id)
                current_app.logger.info(f"Category image deleted from Cloudinary: {category.image_public_id}")
            except Exception as e:
                current_app.logger.warning(f"Failed to delete category image from Cloudinary: {str(e)}")
        
        if category.banner_public_id:
            try:
                cloudinary_service.delete_image(category.banner_public_id)
                current_app.logger.info(f"Category banner deleted from Cloudinary: {category.banner_public_id}")
            except Exception as e:
                current_app.logger.warning(f"Failed to delete category banner from Cloudinary: {str(e)}")
        
        db.session.delete(category)
        db.session.commit()

        try:
            _emit_event('category_deleted', {'id': category_id})
        except Exception:
            pass
        
        return jsonify({
            'message': 'Category deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting category {category_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete category'}), 500

@admin_categories_bp.route('/categories/upload-image', methods=['POST'])
@admin_required
def upload_category_image():
    """Upload category image to Cloudinary CDN"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
        
        current_app.logger.info(f"Uploading category image to Cloudinary: {file.filename}")
        
        # Get category_id from request if provided for organization
        category_id = request.form.get('category_id', 0)
        category_id = int(category_id) if str(category_id).isdigit() else 0
        
        # Upload to Cloudinary
        result = cloudinary_service.upload_category_image(
            file=file,
            category_id=category_id,
            alt_text=file.filename
        )
        
        if not result.get('success'):
            current_app.logger.error(f"Cloudinary upload failed: {result.get('error')}")
            return jsonify({'error': result.get('error', 'Upload failed')}), 500
        
        current_app.logger.info(f"Category image uploaded to Cloudinary: {result.get('public_id')}")
        
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
            'size': result.get('bytes')
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error uploading image: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': f'Failed to upload image: {str(e)}'}), 500

@admin_categories_bp.route('/categories/<int:category_id>/image', methods=['GET'])
def get_category_image(category_id):
    """Get category image from database"""
    try:
        category = Category.query.get_or_404(category_id)
        
        if not category.image_data:
            return jsonify({'error': 'No image found'}), 404
        
        # Create a BytesIO object from the binary data
        image_io = io.BytesIO(category.image_data)
        image_io.seek(0)
        
        mimetype = category.image_mimetype or 'image/jpeg'
        
        return send_file(
            image_io,
            mimetype=mimetype,
            as_attachment=False,
            download_name=category.image_filename or f'category_{category_id}.jpg'
        )
        
    except Exception as e:
        current_app.logger.error(f"Error fetching category image {category_id}: {str(e)}")
        return jsonify({'error': 'Failed to fetch image'}), 500

@admin_categories_bp.route('/categories/<int:category_id>/banner', methods=['GET'])
def get_category_banner(category_id):
    """Get category banner from database"""
    try:
        category = Category.query.get_or_404(category_id)
        
        if not category.banner_data:
            return jsonify({'error': 'No banner found'}), 404
        
        # Create a BytesIO object from the binary data
        banner_io = io.BytesIO(category.banner_data)
        banner_io.seek(0)
        
        mimetype = category.banner_mimetype or 'image/jpeg'
        
        return send_file(
            banner_io,
            mimetype=mimetype,
            as_attachment=False,
            download_name=category.banner_filename or f'banner_{category_id}.jpg'
        )
        
    except Exception as e:
        current_app.logger.error(f"Error fetching category banner {category_id}: {str(e)}")
        return jsonify({'error': 'Failed to fetch banner'}), 500

@admin_categories_bp.route('/categories/reorder', methods=['POST'])
@admin_required
def reorder_categories():
    """Reorder categories"""
    try:
        data = request.get_json()
        
        if not data or 'categories' not in data:
            return jsonify({'error': 'Categories data required'}), 400
        
        # Update sort order for each category
        for item in data['categories']:
            category_id = item.get('id')
            sort_order = item.get('sort_order')
            
            if category_id and sort_order is not None:
                category = Category.query.get(category_id)
                if category:
                    category.sort_order = sort_order
                    category.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'message': 'Categories reordered successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error reordering categories: {str(e)}")
        return jsonify({'error': 'Failed to reorder categories'}), 500

@admin_categories_bp.route('/categories/<int:category_id>/delete-image', methods=['POST'])
@admin_required
def delete_category_image(category_id):
    """Delete a specific image from Cloudinary for a category"""
    try:
        category = Category.query.get_or_404(category_id)
        data = request.get_json() or {}
        
        image_type = data.get('image_type', 'category')  # 'category' or 'banner'
        
        if image_type == 'category':
            if not category.image_public_id:
                return jsonify({'error': 'No category image to delete'}), 400
            
            # Delete from Cloudinary
            success = cloudinary_service.delete_image(category.image_public_id)
            if not success:
                return jsonify({'error': 'Failed to delete image from Cloudinary'}), 500
            
            # Clear from database
            category.image_url = None
            category.image_public_id = None
            current_app.logger.info(f"Category image deleted: {category_id}")
            
        elif image_type == 'banner':
            if not category.banner_public_id:
                return jsonify({'error': 'No banner image to delete'}), 400
            
            # Delete from Cloudinary
            success = cloudinary_service.delete_image(category.banner_public_id)
            if not success:
                return jsonify({'error': 'Failed to delete banner from Cloudinary'}), 500
            
            # Clear from database
            category.banner_url = None
            category.banner_public_id = None
            current_app.logger.info(f"Category banner deleted: {category_id}")
        
        else:
            return jsonify({'error': 'Invalid image type. Use "category" or "banner"'}), 400
        
        category.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': f'{image_type.capitalize()} image deleted successfully',
            'category': category.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting image for category {category_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete image'}), 500
