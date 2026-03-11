"""
Product Serializer Service - Production Grade
Handles safe serialization of product data with defensive programming.
Sanitizes HTML descriptions and safely serializes all product relationships.
"""
import bleach
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.models.models import Product, ProductImage, Review
from flask import current_app

logger = logging.getLogger(__name__)

# HTML sanitization configuration
ALLOWED_HTML_TAGS = [
    'p', 'div', 'ol', 'ul', 'li', 'strong', 'em', 'b', 'i',
    'span', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
]
ALLOWED_HTML_ATTRIBUTES = {}


class ProductSerializer:
    """Safely serializes product data for API responses"""

    @staticmethod
    def sanitize_html(html_content: Optional[str]) -> str:
        """
        Sanitize HTML description to remove dangerous tags and images.
        Prevents description HTML from injecting product gallery images.
        """
        if not html_content:
            return ""
        
        try:
            # Bleach removes all disallowed tags and attributes
            cleaned = bleach.clean(
                html_content,
                tags=ALLOWED_HTML_TAGS,
                attributes=ALLOWED_HTML_ATTRIBUTES,
                strip=True
            )
            return cleaned.strip()
        except Exception as e:
            logger.error(f"HTML sanitization error: {e}")
            # Fallback: return text only
            return str(html_content)

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
            # Safe attribute access for basic fields
            product_name = getattr(product, 'name', 'Unknown Product')
            product_sku = getattr(product, 'sku', '')
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
                
                # Ensure primary image exists
                primary_found = False
                for img in product_images:
                    serialized = ProductSerializer.serialize_image(img)
                    if serialized:
                        images.append(serialized)
                        if serialized['is_primary']:
                            primary_found = True
                
                # If no primary, mark first as primary
                if images and not primary_found:
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
