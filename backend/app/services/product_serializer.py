"""
Product Serializer Service - Production Grade
Handles safe serialization of product data with defensive programming.
Sanitizes HTML descriptions and safely serializes all product relationships.
"""
import json
import logging
import re
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.models.models import Product, ProductImage, Review

logger = logging.getLogger(__name__)

# Try to import bleach for HTML sanitization, fall back to regex if not available
try:
    import bleach
    HAS_BLEACH = True
except ImportError:
    HAS_BLEACH = False
    logger.warning("bleach not installed, using regex-based HTML sanitization")

# HTML sanitization configuration
ALLOWED_HTML_TAGS = [
    'p', 'div', 'ol', 'ul', 'li', 'strong', 'em', 'b', 'i',
    'span', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
]
ALLOWED_HTML_ATTRIBUTES = {}


class ProductSerializer:
    """Safely serializes product data for API responses"""

    @staticmethod
    def sanitize_sku(sku: Optional[str]) -> Optional[str]:
        """
        Clean SKU value. Return None if SKU is invalid, empty, false-like, or literally 'false'.
        """
        if not sku:
            return None
        
        sku_str = str(sku).strip()
        
        # Don't return 'false' string, empty strings, or falsy values
        if not sku_str or sku_str.lower() == 'false' or sku_str == '0':
            return None
        
        return sku_str

    @staticmethod
    def clean_product_name(name: Optional[str]) -> str:
        """Trim and clean product name"""
        if not name:
            return "Product"
        
        return str(name).strip()

    @staticmethod
    def build_cloudinary_variant_urls(image_url: str) -> Dict[str, str]:
        """
        Generate optimized Cloudinary URLs for different sizes from a single image URL.
        If URL contains cloudinary.com, apply transformations for different sizes.
        Otherwise, return the original URL for all sizes.
        
        Cloudinary transformation examples:
        - thumbnail: small, lightweight (~100px)
        - medium: medium preview (~300px)
        - large: detail view (~600px)
        - original: full quality
        """
        if not image_url:
            return {
                'thumbnail': '',
                'medium': '',
                'large': '',
                'original': '',
            }
        
        # Check if it's a Cloudinary URL
        if 'cloudinary.com' in image_url:
            try:
                # Extract the base URL and public ID from Cloudinary URL
                # Format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}
                
                # Simple approach: insert transform parameters before /v or at the end
                if '/upload/' in image_url:
                    # Insert transformation before the public ID
                    base_url = image_url.split('/upload/')[0] + '/upload/'
                    remaining = '/upload/'.join(image_url.split('/upload/')[1:])
                    
                    return {
                        'thumbnail': f"{base_url}w_120,h_120,c_fill,q_60/{remaining}",
                        'medium': f"{base_url}w_400,h_400,c_fill,q_75/{remaining}",
                        'large': f"{base_url}w_800,h_800,c_fill,q_85/{remaining}",
                        'original': image_url,
                    }
            except Exception as e:
                logger.warning(f"Failed to generate Cloudinary variants: {e}")
                # Fall through to return original URL for all sizes
        
        # Non-Cloudinary or error: return original for all sizes
        return {
            'thumbnail': image_url,
            'medium': image_url,
            'large': image_url,
            'original': image_url,
        }

    @staticmethod
    def serialize_product_image(image: ProductImage) -> Optional[Dict[str, Any]]:
        """
        Safely serialize product image with optimized Cloudinary URLs.
        Returns lightweight payload with only needed fields for frontend.
        """
        if not image or not hasattr(image, 'id'):
            return None
        
        try:
            # Get image URL with fallback
            image_url = getattr(image, 'url', None) or getattr(image, 'image_url', None)
            
            if not image_url:
                logger.warning(f"Image {image.id}: No URL found")
                return None
            
            # Generate optimized Cloudinary URLs
            urls = ProductSerializer.build_cloudinary_variant_urls(image_url)
            
            return {
                'id': image.id,
                'alt_text': getattr(image, 'alt_text', None) or "Product image",
                'is_primary': bool(getattr(image, 'is_primary', False)),
                'display_order': int(getattr(image, 'sort_order', 0) or 0),
                'urls': urls,
            }
        except Exception as e:
            logger.error(f"Error serializing image {image.id}: {e}")
            return None

    @staticmethod
    def sanitize_html(html_content: Optional[str]) -> str:
        """
        Sanitize HTML description to remove dangerous tags and images.
        Prevents description HTML from injecting product gallery images.
        """
        if not html_content:
            return ""
        
        try:
            if HAS_BLEACH:
                # Use bleach if available
                cleaned = bleach.clean(
                    html_content,
                    tags=ALLOWED_HTML_TAGS,
                    attributes=ALLOWED_HTML_ATTRIBUTES,
                    strip=True
                )
            else:
                # Fallback: simple regex-based sanitization
                # Remove dangerous tags like script, iframe, img, object, embed
                cleaned = re.sub(r'<(script|iframe|img|object|embed|svg|form|input)[^>]*>.*?</\1>', '', html_content, flags=re.IGNORECASE | re.DOTALL)
                # Remove event handlers
                cleaned = re.sub(r'\s*on\w+\s*=\s*["\']?[^"\'>\s]*["\']?', '', cleaned, flags=re.IGNORECASE)
                
            return cleaned.strip()
        except Exception as e:
            logger.error(f"HTML sanitization failed: {e}")
            # If sanitization fails, return plain text
            return re.sub(r'<[^>]+>', '', html_content or "")

    @staticmethod
    def serialize_image(image: ProductImage) -> Optional[Dict[str, Any]]:
        """
        Safely serialize product image with multiple URL field fallbacks.
        Never crashes if image is invalid or missing attributes.
        """
        if not image or not hasattr(image, 'id'):
            return None
        
        try:
            # Safe attribute access with getattr
            image_url = getattr(image, 'url', None) or getattr(image, 'image_url', None)
            
            if not image_url:
                logger.warning(f"Image {image.id}: No URL found")
                return None
            
            return {
                'id': image.id,
                'alt_text': getattr(image, 'alt_text', None) or "Product image",
                'is_primary': bool(getattr(image, 'is_primary', False)),
                'display_order': int(getattr(image, 'sort_order', 0) or 0),
                'cloudinary_public_id': getattr(image, 'cloudinary_public_id', None),
                'urls': {
                    'original': image_url,
                    'large': image_url,  # Cloudinary transforms happen at CDN level
                    'medium': image_url,
                    'thumbnail': image_url,
                }
            }
        except Exception as e:
            logger.error(f"Error serializing image {image.id}: {e}")
            return None

    @staticmethod
    def serialize_variant(variant) -> Optional[Dict[str, Any]]:
        """Safely serialize product variant"""
        if not variant:
            return None
        
        try:
            return {
                'id': getattr(variant, 'id', None),
                'sku': getattr(variant, 'sku', None),
                'name': getattr(variant, 'name', None),
                'color': getattr(variant, 'color', None),
                'size': getattr(variant, 'size', None),
                'price': float(getattr(variant, 'price', 0) or 0),
                'stock': int(getattr(variant, 'stock', 0) or 0),
            }
        except Exception as e:
            logger.error(f"Error serializing variant: {e}")
            return None

    @staticmethod
    def serialize_review(review: Review) -> Optional[Dict[str, Any]]:
        """Safely serialize product review"""
        if not review:
            return None
        
        try:
            return {
                'id': getattr(review, 'id', None),
                'rating': int(getattr(review, 'rating', 0) or 0),
                'title': getattr(review, 'title', None),
                'comment': getattr(review, 'comment', None),
                'user_name': getattr(review, 'user_name', 'Anonymous'),
                'is_verified_purchase': bool(getattr(review, 'is_verified_purchase', False)),
                'created_at': getattr(review, 'created_at', None).isoformat() if getattr(review, 'created_at', None) else None,
            }
        except Exception as e:
            logger.error(f"Error serializing review: {e}")
            return None

    @staticmethod
    def serialize_product_full(product: Product, include_reviews: bool = True) -> Dict[str, Any]:
        """
        Safely serialize complete product with all relationships.
        Handles missing data gracefully without crashing.
        """
        if not product or not hasattr(product, 'id'):
            return {'error': 'Invalid product'}
        
        try:
            # Clean and trim product name
            product_name = ProductSerializer.clean_product_name(getattr(product, 'name', 'Unknown Product'))
            
            # Sanitize SKU - return None if invalid/false
            product_sku = ProductSerializer.sanitize_sku(getattr(product, 'sku', ''))
            
            product_description = getattr(product, 'description', '')
            
            # Sanitize HTML description
            sanitized_description = ProductSerializer.sanitize_html(product_description)
            
            # Safely get brand info
            brand = getattr(product, 'brand', None)
            brand_data = None
            if brand:
                try:
                    brand_data = {
                        'id': getattr(brand, 'id', None),
                        'name': getattr(brand, 'name', 'Unknown Brand'),
                        'slug': getattr(brand, 'slug', None),
                    }
                except Exception as e:
                    logger.warning(f"Error serializing brand: {e}")
            
            # Safely get category info
            category = getattr(product, 'category', None)
            category_data = None
            if category:
                try:
                    category_data = {
                        'id': getattr(category, 'id', None),
                        'name': getattr(category, 'name', 'Unknown Category'),
                        'slug': getattr(category, 'slug', None),
                    }
                except Exception as e:
                    logger.warning(f"Error serializing category: {e}")
            
            # Safely get and process images
            images = []
            try:
                product_images = getattr(product, 'images', []) or []
                
                # Sort by primary first, then display order
                sorted_images = sorted(
                    product_images,
                    key=lambda img: (not getattr(img, 'is_primary', False), getattr(img, 'sort_order', 0) or 0, getattr(img, 'id', 0))
                )
                
                # Serialize each image with new helper
                for img in sorted_images:
                    serialized = ProductSerializer.serialize_product_image(img)
                    if serialized:
                        images.append(serialized)
                
                # Ensure one primary image
                if images:
                    primary_found = any(img['is_primary'] for img in images)
                    if not primary_found:
                        images[0]['is_primary'] = True
                    
            except Exception as e:
                logger.error(f"Error processing product images: {e}")
            
            # Safely get variants
            variants = []
            try:
                product_variants = getattr(product, 'variants', []) or []
                for variant in product_variants:
                    serialized = ProductSerializer.serialize_variant(variant)
                    if serialized:
                        variants.append(serialized)
            except Exception as e:
                logger.error(f"Error processing product variants: {e}")
            
            # Calculate ratings and reviews
            average_rating = 0
            total_reviews = 0
            reviews_data = []
            
            if include_reviews:
                try:
                    reviews = getattr(product, 'reviews', []) or []
                    total_reviews = len(reviews) if reviews else 0
                    
                    if total_reviews > 0:
                        ratings_sum = 0
                        for review in reviews:
                            serialized = ProductSerializer.serialize_review(review)
                            if serialized:
                                reviews_data.append(serialized)
                                ratings_sum += int(getattr(review, 'rating', 0) or 0)
                        
                        average_rating = round(ratings_sum / total_reviews, 2) if total_reviews > 0 else 0
                except Exception as e:
                    logger.error(f"Error processing product reviews: {e}")
            
            # Safely get pricing and stock
            price = float(getattr(product, 'price', 0) or 0)
            sale_price = float(getattr(product, 'sale_price', None) or 0)
            current_price = sale_price if sale_price > 0 else price
            
            discount_percentage = 0
            if sale_price and price > 0:
                discount_percentage = round(((price - sale_price) / price) * 100)
            
            stock_quantity = int(getattr(product, 'stock_quantity', 0) or 0)
            is_in_stock = stock_quantity > 0
            
            return {
                'success': True,
                'data': {
                    'id': product.id,
                    'name': product_name,
                    'sku': product_sku,
                    'slug': getattr(product, 'slug', None),
                    'description': sanitized_description,
                    'short_description': getattr(product, 'short_description', None),
                    
                    'brand': brand_data,
                    'category': category_data,
                    
                    'pricing': {
                        'original_price': price,
                        'sale_price': sale_price,
                        'current_price': current_price,
                        'discount_percentage': discount_percentage,
                        'currency': 'KES',
                    },
                    
                    'stock': {
                        'quantity': stock_quantity,
                        'is_in_stock': is_in_stock,
                        'stock_status': 'in_stock' if is_in_stock else 'out_of_stock',
                    },
                    
                    'images': images,
                    'thumbnail_url': getattr(product, 'thumbnail_url', None),
                    'image_urls': getattr(product, 'image_urls', None),
                    'variants': variants,
                    
                    'ratings': {
                        'average': average_rating,
                        'total_reviews': total_reviews,
                        'distribution': {
                            '5_star': len([r for r in reviews_data if r.get('rating') == 5]),
                            '4_star': len([r for r in reviews_data if r.get('rating') == 4]),
                            '3_star': len([r for r in reviews_data if r.get('rating') == 3]),
                            '2_star': len([r for r in reviews_data if r.get('rating') == 2]),
                            '1_star': len([r for r in reviews_data if r.get('rating') == 1]),
                        }
                    },
                    
                    'reviews': reviews_data[:10],  # Return last 10 reviews
                    
                    'timestamps': {
                        'created': getattr(product, 'created_at', None).isoformat() if getattr(product, 'created_at', None) else None,
                        'updated': getattr(product, 'updated_at', None).isoformat() if getattr(product, 'updated_at', None) else None,
                    }
                },
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Fatal error serializing product {getattr(product, 'id', 'unknown')}: {e}")
            return {
                'success': False,
                'error': 'Error serializing product data',
                'timestamp': datetime.utcnow().isoformat()
            }
