"""
Admin Product Routes for Mizizzi E-Commerce Backend
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from app.models.models import Product, Category, Brand, db, User, UserRole, ProductImage
from app.services.product_cache_invalidation import product_cache_service
import json
from datetime import datetime
import werkzeug
import uuid
import os
from flask import current_app
from flask_cors import cross_origin
import cloudinary
import cloudinary.uploader

admin_product_routes = Blueprint('admin_products', __name__)

def admin_required():
    """Decorator to check if user has admin role"""
    current_user_id = get_jwt_identity()
    if not current_user_id:
        return jsonify({'error': 'Authentication required'}), 401

    try:
        user = User.query.get(current_user_id)
        if not user or user.role != UserRole.ADMIN:
            return jsonify({'error': 'Admin access required'}), 403
        return None
    except Exception as e:
        return jsonify({'error': 'Database error during authentication'}), 500

def handle_options(allowed_methods):
    """Standard OPTIONS response handler for CORS."""
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Methods', allowed_methods)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@admin_product_routes.route('/api/admin/products', methods=['POST', 'OPTIONS'])
@cross_origin()
@jwt_required()
def create_product():
    """Create a new product"""
    if request.method == 'OPTIONS':
        return handle_options('POST, OPTIONS')
    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate required fields
        required_fields = ['name', 'price', 'category_id']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400

        # Check if category exists
        category = Category.query.get(data['category_id'])
        if not category:
            return jsonify({'error': 'Invalid category'}), 400

        # Check if brand exists (if provided)
        if data.get('brand_id'):
            brand = Brand.query.get(data['brand_id'])
            if not brand:
                return jsonify({'error': 'Invalid brand'}), 400

        # Handle tags - convert list to JSON string for storage
        tags_json = None
        if data.get('tags'):
            if isinstance(data['tags'], list):
                tags_json = json.dumps(data['tags'])
            elif isinstance(data['tags'], str):
                tags_json = data['tags']

        # Handle image_urls - convert list to JSON string for storage
        image_urls_json = None
        if data.get('image_urls'):
            if isinstance(data['image_urls'], list):
                image_urls_json = json.dumps(data['image_urls'])
            elif isinstance(data['image_urls'], str):
                image_urls_json = data['image_urls']

        # Create new product
        product = Product(
            name=data['name'],
            slug=data.get('slug', data['name'].lower().replace(' ', '-')),
            description=data.get('description', ''),
            price=float(data['price']),
            sale_price=float(data['sale_price']) if data.get('sale_price') else None,
            stock=int(data.get('stock', 0)),
            category_id=int(data['category_id']),
            brand_id=int(data['brand_id']) if data.get('brand_id') else None,
            sku=data.get('sku', f"SKU-{datetime.now().timestamp()}"),
            weight=float(data['weight']) if data.get('weight') else None,
            is_featured=bool(data.get('is_featured', False)),
            is_new=bool(data.get('is_new', True)),
            is_sale=bool(data.get('is_sale', False)),
            is_flash_sale=bool(data.get('is_flash_sale', False)),
            is_luxury_deal=bool(data.get('is_luxury_deal', False)),
            meta_title=data.get('meta_title', ''),
            meta_description=data.get('meta_description', ''),
            material=data.get('material', ''),
            image_urls=image_urls_json,
            thumbnail_url=data.get('thumbnail_url'),
            tags=tags_json
        )

        # Add to database
        db.session.add(product)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Product created successfully',
            'product': product.to_dict()
        }), 201

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Product with this name or SKU already exists'}), 409
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': f'Invalid data format: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to create product',
            'details': str(e)
        }), 500

@admin_product_routes.route('/api/admin/products', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_products():
    """Get all products with pagination and filtering"""
    if request.method == 'OPTIONS':
        return handle_options('GET, OPTIONS')
    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 100)
        search = request.args.get('search', '')
        category_id = request.args.get('category_id', type=int)
        brand_id = request.args.get('brand_id', type=int)
        featured = request.args.get('featured', type=bool)
        new = request.args.get('new', type=bool)
        sale = request.args.get('sale', type=bool)
        flash_sale = request.args.get('flash_sale', type=bool)
        luxury_deal = request.args.get('luxury_deal', type=bool)

        # Build query
        query = Product.query

        # Apply filters
        if search:
            query = query.filter(Product.name.ilike(f'%{search}%'))

        if category_id:
            query = query.filter(Product.category_id == category_id)

        if brand_id:
            query = query.filter(Product.brand_id == brand_id)

        if featured is not None:
            query = query.filter(Product.is_featured == featured)

        if new is not None:
            query = query.filter(Product.is_new == new)

        if sale is not None:
            query = query.filter(Product.is_sale == sale)

        if flash_sale is not None:
            query = query.filter(Product.is_flash_sale == flash_sale)

        if luxury_deal is not None:
            query = query.filter(Product.is_luxury_deal == luxury_deal)

        # Order by creation date (newest first)
        query = query.order_by(Product.created_at.desc())

        # Paginate
        products = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        return jsonify({
            'items': [product.to_dict() for product in products.items],
            'pagination': {
                'page': products.page,
                'per_page': products.per_page,
                'total': products.total,
                'pages': products.pages,
                'has_next': products.has_next,
                'has_prev': products.has_prev
            }
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch products',
            'details': str(e)
        }), 500

@admin_product_routes.route('/api/admin/products/<int:product_id>', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_product(product_id):
    """Get a single product by ID"""
    if request.method == 'OPTIONS':
        return handle_options('GET, OPTIONS')

    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        def to_dict_with_images(product_instance):
            """Convert product to dictionary with proper image handling"""
            import json

            # Parse image_urls from JSON string if it exists
            image_urls_list = []
            if product_instance.image_urls:
                try:
                    if isinstance(product_instance.image_urls, str):
                        # Check if it's already a JSON string
                        if product_instance.image_urls.startswith('[') and product_instance.image_urls.endswith(']'):
                            parsed_urls = json.loads(product_instance.image_urls)
                            if isinstance(parsed_urls, list):
                                image_urls_list = [url for url in parsed_urls if url and isinstance(url, str) and url.strip()]
                        else:
                            # Single URL string
                            if product_instance.image_urls.strip():
                                image_urls_list = [product_instance.image_urls.strip()]
                    elif isinstance(product_instance.image_urls, list):
                        image_urls_list = [url for url in product_instance.image_urls if url and isinstance(url, str) and url.strip()]
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"Error parsing image_urls for product {product_instance.id}: {e}")
                    # If parsing fails, treat as single URL if it's a valid string
                    if isinstance(product_instance.image_urls, str) and product_instance.image_urls.strip():
                        image_urls_list = [product_instance.image_urls.strip()]

            # Parse tags from JSON string if it exists
            tags_list = []
            if product_instance.tags:
                try:
                    if isinstance(product_instance.tags, str):
                        tags_list = json.loads(product_instance.tags)
                    else:
                        tags_list = product_instance.tags
                except (json.JSONDecodeError, TypeError):
                    tags_list = []

            # Get product images from ProductImage table
            product_images = []
            try:
                if hasattr(product_instance, 'images') and product_instance.images:
                    for img in product_instance.images:
                        img_dict = {
                            'id': img.id,
                            'url': img.url,
                            'filename': getattr(img, 'filename', ''),
                            'is_primary': getattr(img, 'is_primary', False),
                            'sort_order': getattr(img, 'sort_order', 0),
                            'alt_text': getattr(img, 'alt_text', '')
                        }
                        product_images.append(img_dict)
                        # Add to image_urls_list if not already there
                        if img.url and img.url not in image_urls_list:
                            image_urls_list.append(img.url)
            except Exception as e:
                print(f"Error getting product images: {e}")

            # Ensure we have at least one image
            if not image_urls_list and not product_instance.thumbnail_url:
                image_urls_list = ['/placeholder.svg?height=400&width=400']
            elif not image_urls_list and product_instance.thumbnail_url:
                image_urls_list = [product_instance.thumbnail_url]

            # Set thumbnail_url if not set
            thumbnail_url = product_instance.thumbnail_url
            if not thumbnail_url and image_urls_list:
                thumbnail_url = image_urls_list[0]

            return {
                'id': product_instance.id,
                'name': product_instance.name,
                'slug': product_instance.slug,
                'description': product_instance.description,
                'price': float(product_instance.price) if product_instance.price else None,
                'sale_price': float(product_instance.sale_price) if product_instance.sale_price else None,
                'stock': product_instance.stock,
                'category_id': product_instance.category_id,
                'brand_id': product_instance.brand_id,
                'image_urls': image_urls_list,  # Return as proper array
                'thumbnail_url': thumbnail_url,
                'is_featured': product_instance.is_featured,
                'is_new': product_instance.is_new,
                'is_sale': product_instance.is_sale,
                'is_flash_sale': product_instance.is_flash_sale,
                'is_luxury_deal': product_instance.is_luxury_deal,
                'is_active': product_instance.is_active,
                'tags': tags_list,
                'images': product_images,
                'created_at': product_instance.created_at.isoformat() if product_instance.created_at else None,
                'updated_at': product_instance.updated_at.isoformat() if product_instance.updated_at else None
            }

        return jsonify(to_dict_with_images(product)), 200
    except Exception as e:
        print(f"Error fetching product {product_id}: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch product',
            'details': str(e)
        }), 500

@admin_product_routes.route('/api/admin/products/<int:product_id>', methods=['PUT', 'OPTIONS'])
@cross_origin()
@jwt_required()
def update_product(product_id):
    """Update a product"""
    if request.method == 'OPTIONS':
        return handle_options('PUT, OPTIONS')
    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Update fields if provided
        if 'name' in data:
            product.name = data['name']

        if 'slug' in data:
            product.slug = data['slug']

        if 'description' in data:
            product.description = data['description']

        if 'price' in data:
            product.price = float(data['price'])

        if 'sale_price' in data:
            product.sale_price = float(data['sale_price']) if data['sale_price'] else None

        if 'stock' in data:
            product.stock = int(data['stock'])

        if 'category_id' in data:
            # Validate category exists
            category = Category.query.get(data['category_id'])
            if not category:
                return jsonify({'error': 'Invalid category'}), 400
            product.category_id = int(data['category_id'])

        if 'brand_id' in data:
            if data['brand_id']:
                # Validate brand exists
                brand = Brand.query.get(data['brand_id'])
                if not brand:
                    return jsonify({'error': 'Invalid brand'}), 400
                product.brand_id = int(data['brand_id'])
            else:
                product.brand_id = None

        if 'sku' in data:
            product.sku = data['sku']

        if 'weight' in data:
            product.weight = float(data['weight']) if data['weight'] else None

        if 'is_featured' in data:
            product.is_featured = bool(data['is_featured'])

        if 'is_new' in data:
            product.is_new = bool(data['is_new'])

        if 'is_sale' in data:
            product.is_sale = bool(data['is_sale'])

        if 'is_flash_sale' in data:
            product.is_flash_sale = bool(data['is_flash_sale'])

        if 'is_luxury_deal' in data:
            product.is_luxury_deal = bool(data['is_luxury_deal'])

        if 'meta_title' in data:
            product.meta_title = data['meta_title']

        if 'meta_description' in data:
            product.meta_description = data['meta_description']

        if 'material' in data:
            product.material = data['material']

        if 'image_urls' in data:
            if isinstance(data['image_urls'], list):
                product.image_urls = json.dumps(data['image_urls'])
            else:
                product.image_urls = data['image_urls']

        if 'thumbnail_url' in data:
            product.thumbnail_url = data['thumbnail_url']

        if 'tags' in data:
            if isinstance(data['tags'], list):
                product.tags = json.dumps(data['tags'])
            else:
                product.tags = data['tags']

        # Update timestamp
        product.updated_at = datetime.utcnow()

        db.session.commit()

        # Invalidate product cache after successful update
        product_cache_service.invalidate_product(product_id)

        return jsonify({
            'success': True,
            'message': 'Product updated successfully',
            'product': product.to_dict()
        }), 200

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Product with this name or SKU already exists'}), 409
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': f'Invalid data format: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to update product',
            'details': str(e)
        }), 500

@admin_product_routes.route('/api/admin/products/<int:product_id>', methods=['DELETE', 'OPTIONS'])
@cross_origin()
@jwt_required()
def delete_product(product_id):
    """Delete a product"""
    if request.method == 'OPTIONS':
        return handle_options('DELETE, OPTIONS')
    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        product = Product.query.get_or_404(product_id)

        # Store product name for response
        product_name = product.name
        
        # Store category_id for related products invalidation
        category_id = product.category_id

        # Delete the product
        db.session.delete(product)
        db.session.commit()

        # Invalidate product cache after successful delete
        product_cache_service.invalidate_product(product_id)
        
        # Also invalidate related products cache for this category
        if category_id:
            product_cache_service.invalidate_products_by_category(category_id)

        return jsonify({
            'success': True,
            'message': f'Product "{product_name}" deleted successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to delete product',
            'details': str(e)
        }), 500

@admin_product_routes.route('/api/admin/products/<int:product_id>/images', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_product_images(product_id):
    """Get images for a specific product"""
    if request.method == 'OPTIONS':
        return handle_options('GET, OPTIONS')

    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        # Get images from ProductImage table if it exists
        images = []
        try:
            product_images = ProductImage.query.filter_by(product_id=product_id).order_by(ProductImage.sort_order).all()
            for img in product_images:
                image_data = {
                    'id': img.id,
                    'url': img.url,
                    'alt_text': img.alt_text if hasattr(img, 'alt_text') else '',
                    'sort_order': img.sort_order if hasattr(img, 'sort_order') else 0,
                    'is_primary': img.is_primary if hasattr(img, 'is_primary') else False
                }
                images.append(image_data)
        except Exception as e:
            print(f"Error accessing ProductImage table: {str(e)}")
            # If ProductImage table doesn't exist, use image_urls from product
            if product.image_urls:
                try:
                    if isinstance(product.image_urls, str):
                        import json
                        image_urls = json.loads(product.image_urls)
                    else:
                        image_urls = product.image_urls

                    images = [{'url': url, 'alt_text': f'{product.name} image'} for url in image_urls]
                except:
                    images = []

        return jsonify({
            'success': True,
            'images': images,
            'total_count': len(images),
            'thumbnail_url': product.thumbnail_url
        }), 200

    except Exception as e:
        print(f"Error fetching images for product {product_id}: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch product images',
            'details': str(e)
        }), 500

@admin_product_routes.route('/api/admin/products/<int:product_id>/image', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_product_image(product_id):
    """Get the main image for a product"""
    if request.method == 'OPTIONS':
        return handle_options('GET, OPTIONS')

    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        product = Product.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        # Return the thumbnail URL or first image URL
        image_url = product.thumbnail_url

        if not image_url and product.image_urls:
            try:
                if isinstance(product.image_urls, str):
                    import json
                    image_urls = json.loads(product.image_urls)
                    if image_urls and len(image_urls) > 0:
                        image_url = image_urls[0]
                elif isinstance(product.image_urls, list) and len(product.image_urls) > 0:
                    image_url = product.image_urls[0]
            except:
                pass

        return jsonify({
            'url': image_url or '/placeholder.svg'
        }), 200

    except Exception as e:
        print(f"Error fetching image for product {product_id}: {str(e)}")
        return jsonify({
            'url': '/placeholder.svg'
        }), 200


@admin_product_routes.route('/api/admin/products/<int:product_id>/images/upload', methods=['POST', 'OPTIONS'])
@cross_origin()
@jwt_required()
def upload_product_images(product_id):
    """Upload one or more images for a product. Matches frontend expectation:
    POST /api/admin/products/<product_id>/images/upload
    """
    if request.method == 'OPTIONS':
        return handle_options('POST, OPTIONS')

    # Check admin permissions
    auth_check = admin_required()
    if auth_check:
        return auth_check

    try:
        files = []
        if 'images' in request.files:
            files = request.files.getlist('images')
        elif 'image' in request.files:
            files = [request.files.get('image')]
        elif 'file' in request.files:
            files = [request.files.get('file')]

        if not files or len(files) == 0:
            return jsonify({'success': False, 'errors': [{'file': None, 'error': 'No files provided'}], 'uploaded_images': [], 'message': 'No files provided'}), 400

        # Ensure Cloudinary is configured at request time
        cloud_name = os.environ.get('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') or os.environ.get('CLOUDINARY_CLOUD_NAME')
        api_key = os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_KEY') or os.environ.get('CLOUDINARY_API_KEY')
        api_secret = os.environ.get('NEXT_PUBLIC_CLOUDINARY_API_SECRET') or os.environ.get('CLOUDINARY_API_SECRET')

        if not api_key or not api_secret or not cloud_name:
            current_app.logger.error("Cloudinary configuration missing: api_key/api_secret/cloud_name not set")
            return jsonify({'success': False, 'errors': [{'file': None, 'error': 'Cloudinary configuration missing (api_key/api_secret/cloud_name)'}], 'uploaded_images': [], 'message': 'Upload failed'}), 500

        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret)

        uploaded_images = []
        errors = []

        for idx, f in enumerate(files):
            try:
                current_app.logger.info(f"Uploading product {product_id} image to Cloudinary: {getattr(f, 'filename', 'unknown')}")
                result = cloudinary.uploader.upload(f, folder=os.environ.get('CLOUDINARY_FOLDER', ''), resource_type='image')

                secure_url = result.get('secure_url') or result.get('url')
                public_id = result.get('public_id')

                # Persist to ProductImage
                pi = ProductImage(
                    product_id=product_id,
                    url=secure_url,
                    filename=result.get('original_filename') or getattr(f, 'filename', None),
                    is_primary=False,
                    sort_order=0,
                )
                db.session.add(pi)
                db.session.commit()

                uploaded_images.append({
                    'id': pi.id,
                    'product_id': product_id,
                    'cloudinary_public_id': public_id,
                    'url': secure_url,
                    'secure_url': secure_url,
                    'filename': pi.filename,
                    'width': result.get('width'),
                    'height': result.get('height'),
                    'format': result.get('format'),
                    'size_bytes': result.get('bytes'),
                    'is_primary': pi.is_primary,
                    'sort_order': pi.sort_order,
                })
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error uploading image: {str(e)}")
                errors.append({'file': getattr(f, 'filename', None), 'error': str(e)})

        return jsonify({
            'success': len(errors) == 0,
            'uploaded_images': uploaded_images,
            'errors': errors,
            'message': 'Upload completed' if len(errors) == 0 else 'Upload completed with errors'
        }), 200 if len(errors) == 0 else 207

        # Invalidate product cache after images change
        product_cache_service.invalidate_product_images(product_id)

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Unexpected error uploading images: {str(e)}")
        return jsonify({'success': False, 'errors': [{'file': None, 'error': str(e)}], 'uploaded_images': [], 'message': 'Upload failed'}), 500
