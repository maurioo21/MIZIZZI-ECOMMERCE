"""
Unified product serializers for Mizizzi E-commerce platform.
Provides consistent serialization across public and admin routes with N+1 query prevention.
Includes data integrity checking to detect field mismatches and semantic issues.
"""
from flask import current_app
from sqlalchemy.orm import joinedload
import logging
from app.models.models import Product, ProductVariant, ProductImage
from app.services.product_audit_service import product_audit_service

logger = logging.getLogger(__name__)


def serialize_product_detail(product, for_admin=False):
    """
    Full product serialization for detail views.
    Returns ~30 core fields (vs 90+ in old implementation).
    Includes data integrity checking to detect field mismatches.
    
    Args:
        product: Product instance (should be loaded with joinedload for relationships)
        for_admin: If True, includes admin-only fields (is_active, is_visible, sku, meta fields)
    
    Returns:
        Dictionary representation of the product
    """
    try:
        # Run integrity check to detect suspicious data patterns
        if product.id:
            audit_report = product_audit_service.audit_product(product)
            if audit_report['data_quality_score'] < 75:
                logger.warning(f"Product {product.id} has data integrity issues: {audit_report['warnings']}")
        # Get images - prefer eager-loaded images, fallback to product methods
        image_urls = []
        if hasattr(product, 'images') and product.images:
            # Use pre-loaded images (N+1 prevention)
            sorted_images = sorted(
                product.images, 
                key=lambda img: (not img.is_primary, img.sort_order or 999)
            )
            image_urls = [img.url for img in sorted_images if img.url]
        
        if not image_urls:
            image_urls = product.get_image_urls() if hasattr(product, 'get_image_urls') else []
        
        thumbnail_url = image_urls[0] if image_urls else product.thumbnail_url
        
        # INTEGRITY CHECK: Verify name and description come from correct columns
        # This prevents bugs where name/description get swapped or cross-assigned
        product_name = product.name
        product_description = product.description
        short_desc = product.short_description
        
        if not product_name or not str(product_name).strip():
            logger.error(f"Product {product.id} has empty name field - DATA INTEGRITY ISSUE")
        
        if product_description and len(str(product_description)) > 0:
            # Verify description isn't suspiciously short (potential field swap)
            if len(str(product_description)) < 20 and len(product_name or "") > 50:
                logger.warning(f"Product {product.id}: description is very short while name is long - possible field swap")
        
        # Core fields (always included)
        # CRITICAL: Read ONLY from correct model columns - no fallback logic that could mask issues
        data = {
            'id': product.id,
            'name': product_name,  # READ ONLY FROM product.name
            'slug': product.slug,
            'description': product_description,  # READ ONLY FROM product.description
            'short_description': short_desc,  # READ ONLY FROM product.short_description
            'price': float(product.price) if product.price else 0,
            'sale_price': float(product.sale_price) if product.sale_price else None,
            'discount_percentage': product.discount_percentage,
            'stock': product.stock,
            'availability_status': product.availability_status,
            'min_order_quantity': product.min_order_quantity,
            'max_order_quantity': product.max_order_quantity,
            'image_urls': image_urls,
            'thumbnail_url': thumbnail_url,
            'category_id': product.category_id,
            'brand_id': product.brand_id,
            # Feature flags
            'is_featured': product.is_featured,
            'is_new': product.is_new,
            'is_sale': product.is_sale,
            'is_flash_sale': product.is_flash_sale,
            'is_luxury_deal': product.is_luxury_deal,
            'is_trending': product.is_trending,
            'is_top_pick': product.is_top_pick,
            'is_daily_find': product.is_daily_find,
            'is_new_arrival': product.is_new_arrival,
            # Badge
            'badge_text': product.badge_text,
            'badge_color': product.badge_color,
            # Useful for checkout/details
            'specifications': product.specifications,
            'warranty_info': product.warranty_info,
            'shipping_info': product.shipping_info,
            'weight': product.weight,
            'dimensions': product.dimensions,
            'video_url': product.video_url,
            'condition': product.condition,
            # Preorder
            'is_preorder': product.is_preorder,
            'preorder_release_date': product.preorder_release_date.isoformat() if product.preorder_release_date else None,
            'preorder_message': product.preorder_message,
            # Timestamps
            'created_at': product.created_at.isoformat() if product.created_at else None,
            'updated_at': product.updated_at.isoformat() if product.updated_at else None,
        }
        
        # Admin-only fields
        if for_admin:
            data.update({
                'is_active': product.is_active,
                'is_visible': product.is_visible,
                'is_searchable': product.is_searchable,
                'is_comparable': product.is_comparable,
                'sku': product.sku,
                'barcode': product.barcode,
                'meta_title': product.meta_title,
                'meta_description': product.meta_description,
                'seo_keywords': product.get_seo_keywords() if hasattr(product, 'get_seo_keywords') else [],
                'canonical_url': product.canonical_url,
                'sort_order': product.sort_order,
                'tax_rate': product.tax_rate,
                'tax_class': product.tax_class,
                'is_taxable': product.is_taxable,
                'is_shippable': product.is_shippable,
                'requires_shipping': product.requires_shipping,
                'is_digital': product.is_digital,
                'download_link': product.download_link,
                'download_expiry_days': product.download_expiry_days,
                'is_gift_card': product.is_gift_card,
                'gift_card_value': float(product.gift_card_value) if product.gift_card_value else None,
                'is_customizable': product.is_customizable,
                'customization_options': product.customization_options,
                'manufacturer': product.manufacturer,
                'country_of_origin': product.country_of_origin,
            })
        
        # Category details (use pre-loaded relationship)
        if product.category:
            data['category'] = {
                'id': product.category.id,
                'name': product.category.name,
                'slug': product.category.slug
            }
        
        # Brand details (use pre-loaded relationship)
        if product.brand:
            data['brand'] = {
                'id': product.brand.id,
                'name': product.brand.name,
                'slug': product.brand.slug
            }
        
        # Variants (use pre-loaded relationship)
        if hasattr(product, 'variants') and product.variants:
            data['variants'] = [serialize_variant(v) for v in product.variants]
        
        # Images (detailed, use pre-loaded relationship)
        if hasattr(product, 'images') and product.images:
            data['images'] = [serialize_image(img) for img in product.images]
        
        return data
        
    except Exception as e:
        current_app.logger.error(f"Error in serialize_product_detail for product {getattr(product, 'id', 'unknown')}: {e}")
        return None


def serialize_product_list(product):
    """
    Lightweight serialization for list/grid views.
    Returns only essential fields (~10 fields) for maximum performance.
    
    Args:
        product: Product instance
    
    Returns:
        Dictionary with minimal product data for listing
    """
    try:
        # Get first image efficiently
        image_url = product.thumbnail_url
        if not image_url:
            if hasattr(product, 'image_urls') and product.image_urls:
                if isinstance(product.image_urls, list) and len(product.image_urls) > 0:
                    image_url = product.image_urls[0]
                elif isinstance(product.image_urls, str):
                    image_url = product.image_urls.split(',')[0] if product.image_urls else None
        
        return {
            'id': product.id,
            'name': product.name,
            'slug': product.slug,
            'price': float(product.price) if product.price else 0,
            'sale_price': float(product.sale_price) if product.sale_price else None,
            'discount_percentage': product.discount_percentage,
            'image_url': image_url,
            'stock': product.stock,
            'category_id': product.category_id,
            'brand_id': product.brand_id,
            # Flags for badges/indicators
            'is_featured': product.is_featured,
            'is_new': product.is_new,
            'is_sale': product.is_sale,
            'is_flash_sale': product.is_flash_sale,
            'is_luxury_deal': product.is_luxury_deal,
            'is_trending': product.is_trending,
            'is_top_pick': product.is_top_pick,
            'is_daily_find': product.is_daily_find,
            'is_new_arrival': product.is_new_arrival,
            'badge_text': product.badge_text,
            'badge_color': product.badge_color,
        }
    except Exception as e:
        current_app.logger.error(f"Error in serialize_product_list for product {getattr(product, 'id', 'unknown')}: {e}")
        return None


def serialize_product_minimal(product):
    """
    Ultra-minimal serialization for fast endpoints (trending, featured sections).
    Returns only 6 essential fields for maximum speed. OPTIMIZED: No JSON parsing per product.
    SAFE: Handles missing fields gracefully.
    
    Args:
        product: Product instance
    
    Returns:
        Dictionary with minimal product data
    """
    try:
        # OPTIMIZATION: Use thumbnail_url directly (already parsed from DB)
        # Don't re-parse image_urls JSON string per product - that's wasteful
        # If thumbnail is needed, it should be pre-selected at query time
        image_url = product.thumbnail_url
        
        # Safe access to rating
        rating = getattr(product, 'rating', 0)
        
        return {
            'id': product.id,
            'name': product.name,
            'slug': product.slug,
            'price': float(product.price) if product.price else 0,
            'sale_price': float(product.sale_price) if product.sale_price else None,
            'image': image_url,
            'rating': rating,  # Safe default to 0
        }
    except Exception as e:
        current_app.logger.error(f"Error in serialize_product_minimal: {e}")
        return None


def serialize_product_with_images(product):
    """
    Serialization for homepage products with proper image support.
    Returns essential fields plus complete image data for frontend display.
    SAFE: Handles missing optional fields like rating gracefully.
    
    Args:
        product: Product instance
    
    Returns:
        Dictionary with product data including full image support
    """
    try:
        # Get images - prefer eager-loaded images, fallback to product methods
        image_urls = []
        if hasattr(product, 'images') and product.images:
            # Use pre-loaded images (N+1 prevention)
            sorted_images = sorted(
                product.images, 
                key=lambda img: (not img.is_primary, img.sort_order or 999)
            )
            image_urls = [img.url for img in sorted_images if img.url]
        
        if not image_urls:
            image_urls = product.get_image_urls() if hasattr(product, 'get_image_urls') else []
        
        # Ensure thumbnail_url is set
        thumbnail_url = image_urls[0] if image_urls else product.thumbnail_url
        
        # Calculate discount percentage
        discount_percentage = 0
        if product.sale_price:
            discount_percentage = product.discount_percentage or int(
                ((product.price - product.sale_price) / product.price) * 100
            )
        
        # Safe access to rating field - use getattr with default value
        rating = getattr(product, 'rating', None)
        if rating is None:
            rating = 0  # Default to 0 if rating field doesn't exist
        
        return {
            'id': product.id,
            'name': product.name,
            'slug': product.slug,
            'price': float(product.price) if product.price else 0,
            'sale_price': float(product.sale_price) if product.sale_price else None,
            'discount_percentage': discount_percentage,
            'image': thumbnail_url,  # Keep for backward compatibility
            'image_urls': image_urls,  # New field for full image array
            'thumbnail_url': thumbnail_url,  # Explicit thumbnail
            'stock': product.stock,
            'rating': rating,  # Now safely defaults to 0 if missing
            # Feature flags for UI badges
            'is_featured': product.is_featured,
            'is_new': product.is_new,
            'is_sale': product.is_sale,
            'is_flash_sale': product.is_flash_sale,
            'is_luxury_deal': product.is_luxury_deal,
            'is_trending': product.is_trending,
            'is_top_pick': product.is_top_pick,
            'is_daily_find': product.is_daily_find,
            'is_new_arrival': product.is_new_arrival,
        }
    except Exception as e:
        current_app.logger.error(f"Error in serialize_product_with_images: {e}")
        return None


def serialize_variant(variant):
    """Serialize a product variant to dictionary format."""
    return {
        'id': variant.id,
        'product_id': variant.product_id,
        'color': variant.color,
        'size': variant.size,
        'price': float(variant.price) if variant.price else None,
        'sale_price': float(variant.sale_price) if variant.sale_price else None,
        'stock': variant.stock,
        'sku': variant.sku,
        'image_url': variant.image_url,
        'created_at': variant.created_at.isoformat() if variant.created_at else None,
        'updated_at': variant.updated_at.isoformat() if variant.updated_at else None
    }


def serialize_image(image):
    """Serialize a product image to dictionary format."""
    return {
        'id': image.id,
        'product_id': image.product_id,
        'filename': image.filename,
        'url': image.url,
        'is_primary': image.is_primary,
        'sort_order': image.sort_order,
        'alt_text': image.alt_text,
        'created_at': image.created_at.isoformat() if image.created_at else None,
        'updated_at': image.updated_at.isoformat() if image.updated_at else None
    }


def get_product_with_relationships(product_id, for_admin=False):
    """
    Fetch a single product with all relationships pre-loaded (N+1 prevention).
    
    Args:
        product_id: Product ID to fetch
        for_admin: If False, filters by is_active=True and is_visible=True
    
    Returns:
        Product instance with relationships loaded, or None
    """
    query = Product.query.options(
        joinedload(Product.category),
        joinedload(Product.brand),
        joinedload(Product.variants),
        joinedload(Product.images)
    )
    
    if for_admin:
        return query.filter(Product.id == product_id).first()
    else:
        return query.filter(
            Product.id == product_id,
            Product.is_active == True,
            Product.is_visible == True
        ).first()


def get_product_by_slug_with_relationships(slug, for_admin=False):
    """
    Fetch a single product by slug with all relationships pre-loaded.
    
    Args:
        slug: Product slug to fetch
        for_admin: If False, filters by is_active=True and is_visible=True
    
    Returns:
        Product instance with relationships loaded, or None
    """
    query = Product.query.options(
        joinedload(Product.category),
        joinedload(Product.brand),
        joinedload(Product.variants),
        joinedload(Product.images)
    )
    
    if for_admin:
        return query.filter(Product.slug == slug).first()
    else:
        return query.filter(
            Product.slug == slug,
            Product.is_active == True,
            Product.is_visible == True
        ).first()
