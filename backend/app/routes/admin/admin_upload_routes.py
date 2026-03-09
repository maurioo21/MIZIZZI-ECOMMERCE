"""
Admin Upload Routes for handling file uploads with enhanced persistence
"""
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
import imghdr
from PIL import Image
import io
import json

admin_upload_routes = Blueprint('admin_upload', __name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
PRODUCT_IMAGES_FOLDER = 'product_images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def admin_required():
    """Check if user has admin role"""
    try:
        from ...models.models import User, UserRole
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return jsonify({'error': 'Authentication required'}), 401

        user = User.query.get(current_user_id)
        if not user or user.role != UserRole.ADMIN:
            return jsonify({'error': 'Admin access required'}), 403

        return None
    except Exception as e:
        current_app.logger.error(f"Error checking admin role: {str(e)}")
        return jsonify({'error': 'Authorization check failed'}), 500

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_image(file_stream):
    """Validate that the file is actually an image"""
    try:
        # Reset stream position
        file_stream.seek(0)

        # Check if it's a valid image using imghdr
        image_type = imghdr.what(file_stream)
        if image_type not in ['png', 'jpeg', 'gif', 'webp']:
            return False

        # Reset stream position again
        file_stream.seek(0)

        # Try to open with PIL to ensure it's not corrupted
        Image.open(file_stream)

        # Reset stream position for actual use
        file_stream.seek(0)

        return True
    except Exception as e:
        current_app.logger.error(f"Image validation error: {str(e)}")
        return False

def optimize_image(file_stream, max_width=1200, max_height=1200, quality=85):
    """Optimize image size and quality"""
    try:
        # Open image with PIL
        img = Image.open(file_stream)

        # Convert RGBA to RGB if necessary (for JPEG)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background

        # Resize if necessary
        if img.width > max_width or img.height > max_height:
            img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

        # Save optimized image to bytes
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)

        return output
    except Exception as e:
        current_app.logger.error(f"Error optimizing image: {str(e)}")
        # Return original if optimization fails
        file_stream.seek(0)
        return file_stream

def optimize_carousel_image(file_stream, max_width=1400, max_height=500, quality=75):
    """
    Optimize carousel banner images - more aggressive compression for web carousels
    Maintains 1400x500 aspect ratio and targets ~300KB file size
    """
    try:
        img = Image.open(file_stream)

        # Convert RGBA to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background

        # Calculate dimensions maintaining aspect ratio
        # For carousel, we want 1400x500 or proportional
        aspect_ratio = img.width / img.height
        target_aspect = max_width / max_height

        if aspect_ratio > target_aspect:
            # Image is wider than target
            new_width = max_width
            new_height = int(max_width / aspect_ratio)
        else:
            # Image is taller than target
            new_height = max_height
            new_width = int(max_height * aspect_ratio)

        # Resize image
        if new_width != img.width or new_height != img.height:
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Save with aggressive compression
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)

        original_size = file_stream.seek(0, os.SEEK_END)
        compressed_size = len(output.getvalue())
        
        current_app.logger.info(
            f"Carousel image optimized: {original_size/1024:.1f}KB → {compressed_size/1024:.1f}KB "
            f"(quality={quality}, size={new_width}x{new_height})"
        )

        return output
    except Exception as e:
        current_app.logger.error(f"Error optimizing carousel image: {str(e)}")
        file_stream.seek(0)
        return file_stream

@admin_upload_routes.route('/upload/image', methods=['POST', 'OPTIONS'])
@cross_origin()
@jwt_required()
def upload_image():
    """Upload a product image with enhanced persistence"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        # Log request details for debugging
        current_app.logger.info(f"Upload request files: {list(request.files.keys())}")
        current_app.logger.info(f"Upload request form: {list(request.form.keys())}")

        # Check if file is present - try multiple field names
        file = None
        for field_name in ['file', 'image']:
            if field_name in request.files:
                file = request.files[field_name]
                current_app.logger.info(f"Found file in field: {field_name}")
                break

        if not file:
            current_app.logger.error("No file found in request")
            return jsonify({'error': 'No image file provided. Expected field name: file or image'}), 400

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Validate file
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only PNG, JPG, JPEG, GIF, and WEBP are allowed'}), 400

        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File size too large. Maximum size is 5MB'}), 400

        # Validate that it's actually an image
        if not validate_image(file.stream):
            return jsonify({'error': 'Invalid image file'}), 400

        # Generate unique filename
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'jpg'
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"

        # Create upload directory if it doesn't exist
        upload_path = os.path.join(current_app.root_path, UPLOAD_FOLDER)
        product_images_path = os.path.join(upload_path, PRODUCT_IMAGES_FOLDER)

        os.makedirs(upload_path, exist_ok=True)
        os.makedirs(product_images_path, exist_ok=True)

        # Optimize image
        optimized_image = optimize_image(file.stream)

        # Save file
        file_path = os.path.join(product_images_path, unique_filename)
        with open(file_path, 'wb') as f:
            f.write(optimized_image.read())

        # Generate URL for the uploaded file
        base_url = request.host_url.rstrip('/')
        image_url = f"{base_url}/api/uploads/{PRODUCT_IMAGES_FOLDER}/{unique_filename}"

        # Get product_id if provided
        product_id = request.form.get('product_id')

        # Enhanced database persistence
        if product_id:
            try:
                from ...models.models import Product, ProductImage, db

                product = Product.query.get(int(product_id))
                if product:
                    # Create ProductImage record
                    product_image = ProductImage(
                        product_id=int(product_id),
                        filename=unique_filename,
                        original_name=original_filename,
                        url=image_url,
                        size=file_size,
                        is_primary=len(product.images) == 0,  # First image is primary
                        sort_order=len(product.images),
                        uploaded_by=get_jwt_identity()
                    )

                    db.session.add(product_image)
                    db.session.flush()  # Flush to get the ID

                    # Update product's image_urls and thumbnail_url with proper JSON handling
                    current_images = []
                    if product.image_urls:
                        try:
                            if isinstance(product.image_urls, str):
                                # Try to parse as JSON first
                                try:
                                    current_images = json.loads(product.image_urls)
                                except json.JSONDecodeError:
                                    # If not JSON, treat as comma-separated string
                                    current_images = [url.strip() for url in product.image_urls.split(',') if url.strip()]
                            elif isinstance(product.image_urls, list):
                                current_images = product.image_urls
                            else:
                                current_images = []
                        except:
                            current_images = []

                    # Add new image URL
                    current_images.append(image_url)

                    # Store as JSON string for database compatibility
                    product.image_urls = json.dumps(current_images)

                    # Set as thumbnail if it's the first image
                    if not product.thumbnail_url or len(current_images) == 1:
                        product.thumbnail_url = image_url

                    # Mark product as updated
                    product.updated_at = datetime.utcnow()

                    # Commit all changes
                    db.session.commit()

                    current_app.logger.info(f"Successfully updated product {product_id} with new image: {image_url}")
                    current_app.logger.info(f"Product now has {len(current_images)} images")

                else:
                    current_app.logger.warning(f"Product {product_id} not found")

            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error saving to database: {str(e)}")
                # Delete the uploaded file if database save fails
                try:
                    os.remove(file_path)
                except:
                    pass
                return jsonify({
                    'error': 'Failed to save image to database',
                    'details': str(e)
                }), 500

        current_app.logger.info(f"Image uploaded successfully: {unique_filename}")

        return jsonify({
            'success': True,
            'url': image_url,
            'filename': unique_filename,
            'size': file_size,
            'originalName': original_filename,
            'uploadedBy': get_jwt_identity(),
            'uploadedAt': datetime.now().isoformat()
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error uploading image: {str(e)}")
        return jsonify({
            'error': 'Failed to upload image',
            'details': str(e)
        }), 500

@admin_upload_routes.route('/upload/image', methods=['DELETE'])
@cross_origin()
@jwt_required()
def delete_image():
    """Delete an uploaded image with enhanced cleanup"""
    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Image URL is required'}), 400

        image_url = data['url']

        # Extract filename from URL
        filename = image_url.split('/')[-1]

        # Delete from database first
        try:
            from ...models.models import ProductImage, Product, db

            product_image = ProductImage.query.filter_by(url=image_url).first()
            if product_image:
                product = Product.query.get(product_image.product_id)
                if product:
                    # Update product's image_urls with proper JSON handling
                    try:
                        current_images = []
                        if product.image_urls:
                            if isinstance(product.image_urls, str):
                                try:
                                    current_images = json.loads(product.image_urls)
                                except json.JSONDecodeError:
                                    current_images = [url.strip() for url in product.image_urls.split(',') if url.strip()]
                            elif isinstance(product.image_urls, list):
                                current_images = product.image_urls

                        # Remove the image URL
                        if image_url in current_images:
                            current_images.remove(image_url)

                        # Update the product
                        product.image_urls = json.dumps(current_images)

                        # Update thumbnail if this was the thumbnail
                        if product.thumbnail_url == image_url:
                            product.thumbnail_url = current_images[0] if current_images else None

                        # Mark product as updated
                        product.updated_at = datetime.utcnow()

                        current_app.logger.info(f"Updated product {product.id} after image deletion")
                    except Exception as e:
                        current_app.logger.error(f"Error updating product images: {str(e)}")

                # Delete the ProductImage record
                db.session.delete(product_image)
                db.session.commit()
                current_app.logger.info(f"Deleted ProductImage record for: {image_url}")
            else:
                current_app.logger.warning(f"ProductImage record not found for URL: {image_url}")

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error deleting from database: {str(e)}")
            return jsonify({
                'error': 'Failed to delete image from database',
                'details': str(e)
            }), 500

        # Delete from filesystem
        file_path = os.path.join(current_app.root_path, UPLOAD_FOLDER, PRODUCT_IMAGES_FOLDER, filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                current_app.logger.info(f"Deleted file: {file_path}")
            except Exception as e:
                current_app.logger.error(f"Error deleting file {file_path}: {str(e)}")
        else:
            current_app.logger.warning(f"File not found: {file_path}")

        return jsonify({
            'success': True,
            'message': 'Image deleted successfully'
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting image: {str(e)}")
        return jsonify({
            'error': 'Failed to delete image',
            'details': str(e)
        }), 500

@admin_upload_routes.route('/upload/carousel-banner', methods=['POST', 'OPTIONS'])
@cross_origin()
@jwt_required()
def upload_carousel_banner():
    """Upload a carousel banner image to Cloudinary with automatic optimization"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        current_app.logger.info(f"[v0] Carousel upload request received, files: {list(request.files.keys())}")

        # Check if file is present
        file = None
        for field_name in ['file', 'image', 'banner_image']:
            if field_name in request.files:
                file = request.files[field_name]
                current_app.logger.info(f"[v0] Found carousel file in field: {field_name}")
                break

        if not file or file.filename == '':
            return jsonify({'error': 'No carousel banner image provided'}), 400

        # Get banner_id from request args if provided
        banner_id = request.args.get('banner_id', None)
        if banner_id and banner_id.isdigit():
            banner_id = int(banner_id)
        else:
            banner_id = None

        # Import Cloudinary service
        from ...services.cloudinary_service import CloudinaryService
        cloudinary_service = CloudinaryService()

        # Upload to Cloudinary (automatic optimization)
        upload_result = cloudinary_service.upload_carousel_banner(file, banner_id=banner_id)

        if not upload_result.get('success'):
            return jsonify({'error': upload_result.get('error', 'Upload failed')}), 400

        current_app.logger.info(
            f"[v0] Carousel banner uploaded successfully to Cloudinary: {upload_result['public_id']}"
        )

        return jsonify({
            'success': True,
            'url': upload_result['secure_url'],  # Main URL for display
            'display_url': upload_result['secure_url'],
            'public_id': upload_result['public_id'],
            'filename': secure_filename(file.filename),
            'size': upload_result['bytes'],
            'format': upload_result['format'],
            'responsive_urls': upload_result['responsive_urls'],
            'uploadedBy': get_jwt_identity(),
            'uploadedAt': datetime.now().isoformat()
        }), 200

    except Exception as e:
        current_app.logger.error(f"[v0] Error uploading carousel banner: {str(e)}")
        return jsonify({
            'error': 'Failed to upload carousel banner',
            'details': str(e)
        }), 500

# Add this new route for public image access (no authentication required)
@admin_upload_routes.route('/uploads/<path:filename>')
def serve_uploaded_file_public(filename):
    """Serve uploaded files publicly (no auth required)"""
    try:
        upload_path = os.path.join(current_app.root_path, UPLOAD_FOLDER)
        return send_from_directory(upload_path, filename)
    except Exception as e:
        current_app.logger.error(f"Error serving file {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

@admin_upload_routes.route('/products/<int:product_id>/images', methods=['GET'])
@cross_origin()
@jwt_required()
def get_product_images(product_id):
    """Get all images for a specific product"""
    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        from ...models.models import Product, ProductImage

        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        # Get all product images
        product_images = ProductImage.query.filter_by(product_id=product_id).order_by(ProductImage.sort_order).all()

        # Get image URLs from product.image_urls as backup
        stored_urls = []
        if product.image_urls:
            try:
                if isinstance(product.image_urls, str):
                    stored_urls = json.loads(product.image_urls)
                elif isinstance(product.image_urls, list):
                    stored_urls = product.image_urls
            except:
                stored_urls = []

        # Combine both sources and remove duplicates while preserving order
        all_images = []
        seen_urls = set()

        # First, add images from ProductImage table
        for img in product_images:
            if img.url not in seen_urls:
                all_images.append({
                    'id': img.id,
                    'url': img.url,
                    'filename': img.filename,
                    'original_name': img.original_name,
                    'is_primary': img.is_primary,
                    'sort_order': img.sort_order,
                    'alt_text': img.alt_text,
                    'size': img.size,
                    'created_at': img.created_at.isoformat() if img.created_at else None
                })
                seen_urls.add(img.url)

        # Then add any URLs from product.image_urls that weren't already included
        for url in stored_urls:
            if url not in seen_urls:
                all_images.append({
                    'id': None,
                    'url': url,
                    'filename': url.split('/')[-1],
                    'original_name': None,
                    'is_primary': len(all_images) == 0,
                    'sort_order': len(all_images),
                    'alt_text': None,
                    'size': None,
                    'created_at': None
                })
                seen_urls.add(url)

        return jsonify({
            'success': True,
            'images': all_images,
            'total_count': len(all_images),
            'thumbnail_url': product.thumbnail_url
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting product images: {str(e)}")
        return jsonify({
            'error': 'Failed to get product images',
            'details': str(e)
        }), 500

# Add a public product images endpoint
@admin_upload_routes.route('/api/products/<int:product_id>/images', methods=['GET'])
@cross_origin()
def get_product_images_public(product_id):
    """Get all images for a specific product (public access)"""
    try:
        from ...models.models import Product, ProductImage

        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        # Get all product images
        product_images = ProductImage.query.filter_by(product_id=product_id).order_by(ProductImage.sort_order).all()

        # Get image URLs from product.image_urls as backup
        stored_urls = []
        if product.image_urls:
            try:
                if isinstance(product.image_urls, str):
                    stored_urls = json.loads(product.image_urls)
                elif isinstance(product.image_urls, list):
                    stored_urls = product.image_urls
            except:
                stored_urls = []

        # Combine both sources and remove duplicates while preserving order
        all_images = []
        seen_urls = set()

        # First, add images from ProductImage table
        for img in product_images:
            if img.url not in seen_urls:
                all_images.append({
                    'id': img.id,
                    'url': img.url,
                    'filename': img.filename,
                    'original_name': img.original_name,
                    'is_primary': img.is_primary,
                    'sort_order': img.sort_order,
                    'alt_text': img.alt_text,
                    'size': img.size,
                    'created_at': img.created_at.isoformat() if img.created_at else None
                })
                seen_urls.add(img.url)

        # Then add any URLs from product.image_urls that weren't already included
        for url in stored_urls:
            if url not in seen_urls:
                all_images.append({
                    'id': None,
                    'url': url,
                    'filename': url.split('/')[-1],
                    'original_name': None,
                    'is_primary': len(all_images) == 0,
                    'sort_order': len(all_images),
                    'alt_text': None,
                    'size': None,
                    'created_at': None
                })
                seen_urls.add(url)

        return jsonify({
            'success': True,
            'images': all_images,
            'total_count': len(all_images),
            'thumbnail_url': product.thumbnail_url
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting product images: {str(e)}")
        return jsonify({
            'error': 'Failed to get product images',
            'details': str(e)
        }), 500
