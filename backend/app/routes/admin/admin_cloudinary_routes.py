"""
Admin Cloudinary routes for managing Cloudinary image operations.
Handles image uploads, deletions, and transformations.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
import re

from app.validations.validation import admin_required
from app.configuration.extensions import db
from app.models.models import ProductImage, Product

import cloudinary.uploader

# Create blueprint for admin Cloudinary routes
admin_cloudinary_routes = Blueprint('admin_cloudinary_routes', __name__, url_prefix='/api/admin/cloudinary')

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.environ.get('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_SECRET')
)

def extract_public_id_from_url(url):
    """
    Extract Cloudinary public_id from a Cloudinary URL.
    
    Args:
        url: Cloudinary image URL
        
    Returns:
        public_id string or None
    """
    try:
        # Pattern: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{extension}
        # Or: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/v{version}/{public_id}.{extension}
        
        # Match the public_id with or without folder structure
        match = re.search(r'/v\d+/(.+?)\.(jpg|jpeg|png|webp|gif|bmp|svg)$', url, re.IGNORECASE)
        if match:
            return match.group(1)
        
        # Alternative pattern without version number
        match = re.search(r'/upload/(?:.*?/)?([^/]+)\.(jpg|jpeg|png|webp|gif|bmp|svg)$', url, re.IGNORECASE)
        if match:
            return match.group(1)
            
        return None
    except Exception as e:
        current_app.logger.error(f"Error extracting public_id from URL {url}: {str(e)}")
        return None

@admin_cloudinary_routes.route('/delete-by-public-id', methods=['DELETE', 'OPTIONS'])
@jwt_required()
@admin_required
def delete_by_public_id():
    """Delete an image from Cloudinary by public_id."""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        public_id = data.get('public_id')
        url = data.get('url')
        
        if not public_id and not url:
            return jsonify({'error': 'Either public_id or url is required'}), 400
        
        # If URL is provided, extract public_id
        if url and not public_id:
            public_id = extract_public_id_from_url(url)
            
        if not public_id:
            return jsonify({'error': 'Could not extract public_id from URL'}), 400
        
        current_app.logger.info(f"Attempting to delete Cloudinary image with public_id: {public_id}")
        
        # Delete from Cloudinary
        result = cloudinary.uploader.destroy(public_id)
        
        current_app.logger.info(f"Cloudinary deletion result: {result}")
        
        if result.get('result') == 'ok' or result.get('result') == 'not found':
            # Also delete from database if URL is provided
            if url:
                image = ProductImage.query.filter_by(url=url).first()
                if image:
                    product_id = image.product_id
                    db.session.delete(image)
                    
                    # Update product cache
                    product = db.session.get(Product, product_id)
                    if product:
                        # Update image_urls array
                        current_urls = product.get_image_urls() or []
                        if url in current_urls:
                            current_urls.remove(url)
                            product.set_image_urls(current_urls)
                        
                        # Update thumbnail if needed
                        if product.thumbnail_url == url:
                            remaining_images = ProductImage.query.filter_by(product_id=product_id).filter(
                                ProductImage.url != url
                            ).order_by(ProductImage.is_primary.desc(), ProductImage.sort_order.asc()).first()
                            
                            product.thumbnail_url = remaining_images.url if remaining_images else None
                        
                        product.updated_at = db.func.now()
                    
                    db.session.commit()
                    current_app.logger.info(f"Image deleted from database: {image.id}")
            
            return jsonify({
                'success': True,
                'message': 'Image deleted successfully from Cloudinary and database',
                'cloudinary_result': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete image from Cloudinary',
                'cloudinary_result': result
            }), 400
            
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting image from Cloudinary: {str(e)}")
        return jsonify({'error': f'Failed to delete image: {str(e)}'}), 500

@admin_cloudinary_routes.route('/delete-by-url', methods=['DELETE', 'OPTIONS'])
@jwt_required()
@admin_required
def delete_by_url():
    """Delete an image from Cloudinary and database by URL."""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        
        if not data or not data.get('url'):
            return jsonify({'error': 'Image URL is required'}), 400
        
        url = data['url']
        
        # Extract public_id from URL
        public_id = extract_public_id_from_url(url)
        
        if not public_id:
            return jsonify({'error': 'Could not extract public_id from URL'}), 400
        
        current_app.logger.info(f"Deleting image with URL: {url}, public_id: {public_id}")
        
        # Delete from Cloudinary
        result = cloudinary.uploader.destroy(public_id)
        
        current_app.logger.info(f"Cloudinary deletion result: {result}")
        
        # Delete from database
        image = ProductImage.query.filter_by(url=url).first()
        if image:
            product_id = image.product_id
            db.session.delete(image)
            
            # Update product cache
            product = db.session.get(Product, product_id)
            if product:
                # Update image_urls array
                current_urls = product.get_image_urls() or []
                if url in current_urls:
                    current_urls.remove(url)
                    product.set_image_urls(current_urls)
                
                # Update thumbnail if needed
                if product.thumbnail_url == url:
                    remaining_images = ProductImage.query.filter_by(product_id=product_id).filter(
                        ProductImage.url != url
                    ).order_by(ProductImage.is_primary.desc(), ProductImage.sort_order.asc()).first()
                    
                    product.thumbnail_url = remaining_images.url if remaining_images else None
                
                product.updated_at = db.func.now()
            
            db.session.commit()
            current_app.logger.info(f"Image deleted from database: {image.id}")
        
        return jsonify({
            'success': True,
            'message': 'Image deleted successfully from Cloudinary and database',
            'cloudinary_result': result
        }), 200
            
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting image by URL: {str(e)}")
        return jsonify({'error': f'Failed to delete image: {str(e)}'}), 500

@admin_cloudinary_routes.route('/search-by-url', methods=['POST', 'OPTIONS'])
@jwt_required()
@admin_required
def search_by_url():
    """Search for an image in the database by URL and return its ID."""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        
        if not data or not data.get('url'):
            return jsonify({'error': 'Image URL is required'}), 400
        
        url = data['url']
        
        # Search for image in database
        image = ProductImage.query.filter_by(url=url).first()
        
        if image:
            return jsonify({
                'success': True,
                'image_id': image.id,
                'product_id': image.product_id,
                'url': image.url
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Image not found in database'
            }), 404
            
    except Exception as e:
        current_app.logger.error(f"Error searching for image by URL: {str(e)}")
        return jsonify({'error': f'Failed to search for image: {str(e)}'}), 500

@admin_cloudinary_routes.route('/health', methods=['GET'])
def cloudinary_health():
    """Health check for Cloudinary configuration."""
    try:
        # Check if Cloudinary is configured
        config_status = {
            'cloud_name': bool(os.environ.get('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')),
            'api_key': bool(os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_KEY')),
            'api_secret': bool(os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_SECRET'))
        }
        
        all_configured = all(config_status.values())
        
        return jsonify({
            'status': 'ok' if all_configured else 'misconfigured',
            'service': 'admin_cloudinary_routes',
            'configuration': config_status
        }), 200 if all_configured else 500
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@admin_cloudinary_routes.route('/upload', methods=['POST', 'OPTIONS'])
@jwt_required()
@admin_required
def upload_to_cloudinary():
    """Upload one or multiple images to Cloudinary and optionally attach to a product.

    Accepts form-data:
      - file OR image OR images (one or many)
      - product_id (optional) - if provided, will create ProductImage rows
      - alt_text_<index> optional alt texts for images
    """
    if request.method == 'OPTIONS':
        return '', 200

    try:
        files = []
        # Support different field names
        if 'images' in request.files:
            files = request.files.getlist('images')
        elif 'file' in request.files:
            files = [request.files.get('file')]
        elif 'image' in request.files:
            files = [request.files.get('image')]

        if not files or len(files) == 0:
            return jsonify({'error': 'No file(s) provided'}), 400

        # Ensure Cloudinary is configured at request time (handles environments
        # where env vars weren't available at import time)
        cloud_name = os.environ.get('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') or os.environ.get('CLOUDINARY_CLOUD_NAME')
        api_key = os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_KEY') or os.environ.get('CLOUDINARY_API_KEY')
        api_secret = os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_SECRET') or os.environ.get('CLOUDINARY_API_SECRET')

        if not api_key or not api_secret or not cloud_name:
            current_app.logger.error("Cloudinary configuration missing: api_key/api_secret/cloud_name not set")
            return jsonify({'error': 'Upload failed: Cloudinary configuration missing (api_key/api_secret/cloud_name)'}), 500

        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret)

        product_id = request.form.get('product_id')

        uploaded = []
        errors = []

        for idx, f in enumerate(files):
            # Use Cloudinary uploader
            filename = getattr(f, 'filename', 'unknown')
            current_app.logger.info(f"Uploading file to Cloudinary: {filename}")
            upload_result = cloudinary.uploader.upload(
                f,
                folder=os.environ.get('CLOUDINARY_FOLDER', ''),
                resource_type='image',
            )

            # Log the raw Cloudinary result for debugging (DNS failures or partial responses)
            current_app.logger.debug(f"Cloudinary upload result for {filename}: {upload_result}")

            secure_url = upload_result.get('secure_url') or upload_result.get('url') if upload_result else None
            public_id = upload_result.get('public_id') if upload_result else None

            # Optionally save to DB if product id provided
            saved_image = None
            try:
                if product_id:
                    pi = ProductImage(
                        product_id=int(product_id) if str(product_id).isdigit() else None,
                        url=secure_url,
                        filename=upload_result.get('original_filename') or getattr(f, 'filename', None),
                        is_primary=False,
                        sort_order=0,
                    )
                    db.session.add(pi)
                    db.session.commit()
                    saved_image = pi
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Failed to save ProductImage: {str(e)}")

            # If Cloudinary returned no useful metadata, record as an error and skip
            if not secure_url and not public_id:
                current_app.logger.error(f"Cloudinary returned no metadata for uploaded file: {filename}")
                errors.append({'file': filename, 'error': 'No image metadata returned from Cloudinary'})
                # Continue to next file without persisting an empty entry
                continue

            uploaded.append({
                'public_id': public_id,
                'secure_url': secure_url,
                'url': secure_url,
                'width': upload_result.get('width'),
                'height': upload_result.get('height'),
                'format': upload_result.get('format'),
                'bytes': upload_result.get('bytes'),
                'database_id': getattr(saved_image, 'id', None),
            })

        # Normalize response to match frontend expectations across upload endpoints
        success = len(errors) == 0
        response_payload = {
            'success': success,
            'uploaded': uploaded,
            'uploaded_images': uploaded,
            'errors': errors,
            'count': len(uploaded),
            'message': ('Image uploaded successfully' if len(uploaded) == 1 else f'{len(uploaded)} images uploaded successfully') if success else ('Upload completed with errors' if len(uploaded) > 0 else 'Upload failed')
        }

        # Provide single-image aliases for older frontend callers
        if len(uploaded) == 1:
            response_payload['uploaded_image'] = uploaded[0]
            response_payload['image'] = uploaded[0]

        return jsonify(response_payload), 200 if success else (207 if len(uploaded) > 0 else 500)

    except Exception as e:
        current_app.logger.error(f"Cloudinary upload error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Upload failed: {str(e)}',
            'uploaded_images': [],
            'uploaded': [],
            'count': 0,
            'message': 'Upload failed'
        }), 500
