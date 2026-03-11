"""
Product Data Validator Service
Provides validation, sanitization, and integrity checking for product data.
Production-safe: validates data with optional strict mode.
"""
import logging
import json
from typing import Dict, Any, Optional, Tuple
from app.models.models import Product, Brand, Category, db

logger = logging.getLogger(__name__)


class ProductValidationError(Exception):
    """Raised when product validation fails in strict mode."""
    pass


class ProductValidatorService:
    """Service for validating and sanitizing product data."""
    
    @staticmethod
    def validate_product_fields(
        product_data: Dict[str, Any],
        strict: bool = False
    ) -> Tuple[bool, List[str]]:
        """
        Validate product fields for data integrity.
        
        Args:
            product_data: Dictionary with product fields
            strict: If True, raise exception on validation errors
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check required fields
        if 'name' not in product_data or not product_data['name'] or not str(product_data['name']).strip():
            errors.append('Product name is required and cannot be empty')
        
        if 'price' not in product_data or product_data['price'] is None:
            errors.append('Product price is required')
        else:
            try:
                price = float(product_data['price'])
                if price <= 0:
                    errors.append('Product price must be greater than 0')
            except (ValueError, TypeError):
                errors.append('Product price must be a valid number')
        
        if 'category_id' not in product_data or not product_data['category_id']:
            errors.append('Product category is required')
        else:
            try:
                category = Category.query.get(product_data['category_id'])
                if not category:
                    errors.append(f"Category with ID {product_data['category_id']} does not exist")
            except Exception as e:
                errors.append(f"Error validating category: {str(e)}")
        
        # Validate optional fields
        if 'brand_id' in product_data and product_data['brand_id']:
            try:
                brand = Brand.query.get(product_data['brand_id'])
                if not brand:
                    errors.append(f"Brand with ID {product_data['brand_id']} does not exist")
            except Exception as e:
                errors.append(f"Error validating brand: {str(e)}")
        
        # Validate sale_price if provided
        if 'sale_price' in product_data and product_data['sale_price'] is not None:
            try:
                sale_price = float(product_data['sale_price'])
                if sale_price <= 0:
                    errors.append('Sale price must be greater than 0 or None')
                
                if 'price' in product_data:
                    regular_price = float(product_data['price'])
                    if sale_price > regular_price:
                        errors.append('Sale price cannot be greater than regular price')
            except (ValueError, TypeError):
                errors.append('Sale price must be a valid number')
        
        # Validate stock if provided
        if 'stock' in product_data and product_data['stock'] is not None:
            try:
                stock = int(product_data['stock'])
                if stock < 0:
                    errors.append('Stock cannot be negative')
            except (ValueError, TypeError):
                errors.append('Stock must be a valid integer')
        
        is_valid = len(errors) == 0
        
        if not is_valid and strict:
            raise ProductValidationError('; '.join(errors))
        
        if errors:
            logger.warning(f"Product validation errors: {errors}")
        
        return is_valid, errors
    
    @staticmethod
    def sanitize_product_data(product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize product data by trimming whitespace and normalizing values.
        
        Args:
            product_data: Dictionary with product fields
        
        Returns:
            Sanitized dictionary
        """
        sanitized = {}
        
        # String fields to trim
        string_fields = ['name', 'slug', 'description', 'short_description', 'sku', 
                        'meta_title', 'meta_description', 'material', 'barcode', 
                        'manufacturer', 'country_of_origin']
        
        for field in string_fields:
            if field in product_data and product_data[field]:
                value = str(product_data[field]).strip()
                sanitized[field] = value if value else None
            elif field in product_data:
                sanitized[field] = None
        
        # Numeric fields - convert and validate
        numeric_fields = {
            'price': float,
            'sale_price': float,
            'stock': int,
            'weight': float,
            'discount_percentage': float,
            'tax_rate': float,
            'category_id': int,
            'brand_id': int
        }
        
        for field, field_type in numeric_fields.items():
            if field in product_data and product_data[field] is not None:
                try:
                    sanitized[field] = field_type(product_data[field])
                except (ValueError, TypeError):
                    logger.warning(f"Failed to convert {field} to {field_type.__name__}: {product_data[field]}")
                    sanitized[field] = None
        
        # Boolean fields
        boolean_fields = ['is_featured', 'is_new', 'is_sale', 'is_flash_sale', 
                         'is_luxury_deal', 'is_trending', 'is_top_pick', 'is_daily_find',
                         'is_new_arrival', 'is_active', 'is_visible', 'is_searchable', 
                         'is_comparable', 'is_digital', 'is_taxable', 'is_shippable', 
                         'is_gift_card', 'is_customizable', 'is_preorder']
        
        for field in boolean_fields:
            if field in product_data:
                sanitized[field] = bool(product_data[field])
        
        # JSON fields - validate and parse if string
        json_fields = ['specifications', 'dimensions', 'customization_options', 'image_urls', 
                      'related_products', 'cross_sell_products', 'up_sell_products', 'seo_keywords']
        
        for field in json_fields:
            if field in product_data and product_data[field]:
                if isinstance(product_data[field], str):
                    try:
                        sanitized[field] = json.loads(product_data[field])
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse JSON field {field}: {product_data[field]}")
                        sanitized[field] = None
                else:
                    sanitized[field] = product_data[field]
        
        # Copy any remaining fields not explicitly handled
        for key, value in product_data.items():
            if key not in sanitized:
                sanitized[key] = value
        
        return sanitized
    
    @staticmethod
    def validate_field_mapping(
        request_fields: Dict[str, Any],
        product: Product
    ) -> Tuple[bool, Dict[str, str]]:
        """
        Validate that request fields map correctly to product columns (prevent field leakage).
        
        Args:
            request_fields: Fields from admin request
            product: Product instance to update
        
        Returns:
            Tuple of (is_valid, field_mapping)
        """
        field_mapping = {}
        errors = {}
        
        # Define valid Product model fields
        valid_fields = {
            'name', 'slug', 'description', 'short_description', 'price', 'sale_price',
            'stock', 'category_id', 'brand_id', 'sku', 'weight', 'is_featured',
            'is_new', 'is_sale', 'is_flash_sale', 'is_luxury_deal', 'meta_title',
            'meta_description', 'image_urls', 'thumbnail_url', 'is_active', 'is_visible',
            'is_searchable', 'is_comparable', 'barcode', 'material', 'badge_text',
            'badge_color', 'discount_percentage', 'tax_rate', 'warranty_info',
            'shipping_info', 'specifications', 'dimensions', 'video_url', 'condition',
            'is_preorder', 'preorder_release_date', 'preorder_message', 'tags',
            'is_trending', 'is_top_pick', 'is_daily_find', 'is_new_arrival',
            'manufacturer', 'country_of_origin', 'availability_status', 'min_order_quantity',
            'max_order_quantity', 'seo_keywords', 'canonical_url', 'sort_order'
        }
        
        for field, value in request_fields.items():
            if field in valid_fields:
                field_mapping[field] = value
            else:
                errors[field] = f"Invalid field '{field}' - not a valid product column"
                logger.warning(f"Attempted to set invalid field on product {product.id}: {field}")
        
        is_valid = len(errors) == 0
        return is_valid, field_mapping if is_valid else errors
    
    @staticmethod
    def validate_update_operation(
        product: Product,
        updates: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """
        Validate an update operation before applying changes.
        Checks for cross-field assignment bugs and data consistency.
        
        Args:
            product: Product instance being updated
            updates: Dictionary of fields to update
        
        Returns:
            Tuple of (is_valid, list_of_validation_warnings)
        """
        warnings = []
        
        # Track what's changing for logging
        changed_fields = []
        for field, new_value in updates.items():
            old_value = getattr(product, field, None)
            if old_value != new_value:
                changed_fields.append({
                    'field': field,
                    'old_value': str(old_value)[:50],  # Truncate for logging
                    'new_value': str(new_value)[:50]
                })
        
        if changed_fields:
            logger.info(f"Product {product.id} update: {changed_fields}")
        
        # Validate specific field combinations
        if 'category_id' in updates and updates['category_id']:
            try:
                category = Category.query.get(updates['category_id'])
                if not category:
                    warnings.append(f"Invalid category ID: {updates['category_id']}")
            except Exception as e:
                warnings.append(f"Error validating category: {str(e)}")
        
        if 'brand_id' in updates and updates['brand_id']:
            try:
                brand = Brand.query.get(updates['brand_id'])
                if not brand:
                    warnings.append(f"Invalid brand ID: {updates['brand_id']}")
            except Exception as e:
                warnings.append(f"Error validating brand: {str(e)}")
        
        # Validate price relationships
        current_price = float(updates.get('price', product.price or 0))
        current_sale_price = float(updates.get('sale_price', product.sale_price or 0)) if updates.get('sale_price') else None
        
        if current_sale_price and current_sale_price > current_price:
            warnings.append(f"Sale price ({current_sale_price}) exceeds regular price ({current_price})")
        
        is_valid = len(warnings) == 0
        return is_valid, warnings


# Global instance
product_validator = ProductValidatorService()
