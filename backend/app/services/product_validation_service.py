"""
Product Validation Service - Production-safe validation with logging
Validates product data during create/update operations.
Lightweight, doesn't block valid products unnecessarily.
"""
import logging
import re
from typing import Dict, Any, Tuple, List
from app.models.models import Product, Category, Brand, db

logger = logging.getLogger(__name__)


class ProductValidationService:
    """Validate product data with safe, informative feedback"""
    
    @staticmethod
    def validate_create_payload(data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        """
        Validate incoming create product request.
        Returns: (is_valid, errors, warnings)
        """
        errors = []
        warnings = []
        
        # Required fields
        if not data.get('name') or not isinstance(data['name'], str) or not data['name'].strip():
            errors.append('name: Required field, must be non-empty string')
        else:
            # Clean name
            name = data['name'].strip()
            if len(name) > 255:
                errors.append('name: Must be 255 characters or less')
            if len(name) < 3:
                errors.append('name: Must be at least 3 characters')
        
        if not data.get('price'):
            errors.append('price: Required field')
        else:
            try:
                price = float(data['price'])
                if price <= 0:
                    errors.append('price: Must be greater than 0')
            except (ValueError, TypeError):
                errors.append('price: Must be a valid number')
        
        if not data.get('category_id'):
            errors.append('category_id: Required field')
        else:
            try:
                category_id = int(data['category_id'])
                category = Category.query.get(category_id)
                if not category:
                    errors.append(f'category_id: Category {category_id} not found')
            except (ValueError, TypeError):
                errors.append('category_id: Must be a valid integer')
        
        # Optional but validated fields
        if data.get('brand_id'):
            try:
                brand_id = int(data['brand_id'])
                brand = Brand.query.get(brand_id)
                if not brand:
                    errors.append(f'brand_id: Brand {brand_id} not found')
            except (ValueError, TypeError):
                errors.append('brand_id: Must be a valid integer')
        
        # Slug validation
        if data.get('slug'):
            slug = data['slug'].strip()
            if not re.match(r'^[a-z0-9-]+$', slug):
                errors.append('slug: Must contain only lowercase letters, numbers, and hyphens')
            
            # Check slug uniqueness
            existing = Product.query.filter_by(slug=slug).first()
            if existing:
                errors.append(f'slug: Slug "{slug}" already exists')
        else:
            # Generate slug from name if provided
            if data.get('name'):
                suggested_slug = re.sub(r'[^a-z0-9]+', '-', data['name'].lower()).strip('-')
                if suggested_slug:
                    existing = Product.query.filter_by(slug=suggested_slug).first()
                    if existing:
                        warnings.append(f'Generated slug would conflict: "{suggested_slug}" already exists')
        
        # SKU validation
        if data.get('sku'):
            sku = data['sku'].strip()
            existing = Product.query.filter_by(sku=sku).first()
            if existing:
                errors.append(f'sku: SKU "{sku}" already exists')
        
        # Sale price validation
        if data.get('sale_price'):
            try:
                sale_price = float(data['sale_price'])
                price = float(data['price']) if data.get('price') else 0
                if sale_price > price:
                    errors.append('sale_price: Cannot exceed regular price')
            except (ValueError, TypeError):
                errors.append('sale_price: Must be a valid number')
        
        # Description field validation
        if data.get('description') and len(str(data.get('description', ''))) > 10000:
            warnings.append('description: Very long description (>10000 chars), may impact performance')
        
        if data.get('short_description') and len(str(data.get('short_description', ''))) > 500:
            warnings.append('short_description: Unusually long (>500 chars)')
        
        # Check if description looks like it might be misaligned
        if data.get('description') and not data.get('short_description'):
            # This is fine, but warn if it looks like there's a pattern
            pass
        
        return len(errors) == 0, errors, warnings
    
    @staticmethod
    def validate_update_payload(product: Product, data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
        """
        Validate incoming update product request.
        Returns: (is_valid, errors, warnings)
        """
        errors = []
        warnings = []
        
        # Validate name if provided
        if 'name' in data:
            if not data['name'] or not isinstance(data['name'], str) or not data['name'].strip():
                errors.append('name: Cannot be empty')
            else:
                name = data['name'].strip()
                if len(name) > 255:
                    errors.append('name: Must be 255 characters or less')
        
        # Validate price if provided
        if 'price' in data:
            try:
                price = float(data['price'])
                if price <= 0:
                    errors.append('price: Must be greater than 0')
            except (ValueError, TypeError):
                errors.append('price: Must be a valid number')
        
        # Validate sale_price if provided
        if 'sale_price' in data:
            if data['sale_price']:
                try:
                    sale_price = float(data['sale_price'])
                    # Get current price or use provided price
                    current_price = float(data.get('price', product.price or 0))
                    if sale_price > current_price:
                        errors.append('sale_price: Cannot exceed regular price')
                except (ValueError, TypeError):
                    errors.append('sale_price: Must be a valid number')
        
        # Validate category if provided
        if 'category_id' in data:
            if data['category_id']:
                try:
                    category_id = int(data['category_id'])
                    category = Category.query.get(category_id)
                    if not category:
                        errors.append(f'category_id: Category {category_id} not found')
                except (ValueError, TypeError):
                    errors.append('category_id: Must be a valid integer')
        
        # Validate brand if provided
        if 'brand_id' in data:
            if data['brand_id']:
                try:
                    brand_id = int(data['brand_id'])
                    brand = Brand.query.get(brand_id)
                    if not brand:
                        errors.append(f'brand_id: Brand {brand_id} not found')
                except (ValueError, TypeError):
                    errors.append('brand_id: Must be a valid integer')
        
        # Validate slug if provided
        if 'slug' in data:
            slug = data['slug'].strip()
            if not re.match(r'^[a-z0-9-]+$', slug):
                errors.append('slug: Must contain only lowercase letters, numbers, and hyphens')
            
            # Check slug uniqueness (excluding current product)
            existing = Product.query.filter_by(slug=slug).filter(Product.id != product.id).first()
            if existing:
                errors.append(f'slug: Slug "{slug}" already exists on another product')
        
        # Validate SKU if provided
        if 'sku' in data:
            if data['sku']:
                sku = data['sku'].strip()
                existing = Product.query.filter_by(sku=sku).filter(Product.id != product.id).first()
                if existing:
                    errors.append(f'sku: SKU "{sku}" already exists on another product')
        
        # Warn about long descriptions
        if 'description' in data and len(str(data.get('description', ''))) > 10000:
            warnings.append('description: Very long description (>10000 chars)')
        
        if 'short_description' in data and len(str(data.get('short_description', ''))) > 500:
            warnings.append('short_description: Unusually long (>500 chars)')
        
        logger.info(f"Product {product.id} validation: {len(errors)} errors, {len(warnings)} warnings")
        
        return len(errors) == 0, errors, warnings
    
    @staticmethod
    def sanitize_field(field_name: str, value: Any) -> Any:
        """
        Sanitize individual field values.
        Removes dangerous content while preserving valid data.
        """
        if value is None:
            return None
        
        # String fields: strip whitespace
        if isinstance(value, str):
            value = value.strip()
            
            # Don't allow HTML in name/slug/sku
            if field_name in ['name', 'slug', 'sku']:
                # Remove any HTML tags
                value = re.sub(r'<[^>]+>', '', value)
            
            # Empty string becomes None for optional fields
            if not value and field_name not in ['name', 'slug', 'sku']:
                return None
        
        # Numeric fields: ensure correct type
        if field_name in ['price', 'sale_price', 'weight']:
            try:
                return float(value) if value else None
            except (ValueError, TypeError):
                return None
        
        if field_name in ['category_id', 'brand_id', 'stock', 'stock_quantity']:
            try:
                return int(value) if value else None
            except (ValueError, TypeError):
                return None
        
        # Boolean fields
        if field_name in ['is_featured', 'is_new', 'is_sale', 'is_flash_sale', 'is_luxury_deal', 'is_active', 'is_visible']:
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ['true', '1', 'yes']
            if isinstance(value, int):
                return bool(value)
            return bool(value)
        
        return value
