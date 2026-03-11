"""
Product Audit Service - Debug and Inspection Helper
Provides utilities to inspect product records for data integrity issues.
Production-safe and reusable across admin and debugging code.
"""
import logging
from typing import Dict, Any, Optional, List
from app.models.models import Product, ProductImage, Review
from datetime import datetime

logger = logging.getLogger(__name__)


class ProductAuditService:
    """Safely inspect product records for data integrity"""
    
    @staticmethod
    def audit_product(product: Product) -> Dict[str, Any]:
        """
        Generate comprehensive audit report for a product record.
        Shows all fields, relationships, and flags suspicious patterns.
        """
        if not product:
            return {'error': 'Product not found', 'audit_timestamp': datetime.utcnow().isoformat()}
        
        audit_report = {
            'audit_timestamp': datetime.utcnow().isoformat(),
            'product_id': product.id,
            
            # Core identity fields
            'identity': {
                'name': product.name or '(MISSING)',
                'slug': product.slug or '(MISSING)',
                'sku': product.sku or '(MISSING)',
                'name_exists': bool(product.name),
                'slug_exists': bool(product.slug),
                'sku_exists': bool(product.sku),
            },
            
            # Description fields - THE KEY FIELDS FOR DATA INTEGRITY
            'descriptions': {
                'short_description': {
                    'exists': bool(product.short_description),
                    'length': len(product.short_description or ''),
                    'first_100_chars': (product.short_description or '')[:100],
                    'has_html': '<' in (product.description or ''),
                },
                'description': {
                    'exists': bool(product.description),
                    'length': len(product.description or ''),
                    'first_100_chars': (product.description or '')[:100],
                    'has_html': '<' in (product.description or ''),
                },
            },
            
            # Relationships
            'relationships': {
                'brand': {
                    'id': product.brand_id,
                    'exists': product.brand_id is not None,
                    'brand_name': product.brand.name if product.brand else '(NO BRAND)',
                    'brand_slug': product.brand.slug if product.brand else None,
                },
                'category': {
                    'id': product.category_id,
                    'exists': product.category_id is not None,
                    'category_name': product.category.name if product.category else '(NO CATEGORY)',
                    'category_slug': product.category.slug if product.category else None,
                },
            },
            
            # Images
            'images': {
                'product_images_count': len(product.images or []),
                'product_images_exist': bool(product.images),
                'image_urls_json': bool(product.image_urls),
                'thumbnail_url': bool(product.thumbnail_url),
                'images': [
                    {
                        'id': img.id,
                        'url_exists': bool(img.url),
                        'is_primary': img.is_primary,
                        'sort_order': img.sort_order,
                    }
                    for img in (product.images or [])
                ],
            },
            
            # Pricing
            'pricing': {
                'price': float(product.price or 0),
                'sale_price': float(product.sale_price or 0) if product.sale_price else None,
                'price_exists': product.price is not None,
                'sale_price_exists': product.sale_price is not None,
            },
            
            # Stock
            'stock': {
                'stock': product.stock,
                'stock_quantity': product.stock_quantity,
                'in_stock': (product.stock_quantity or 0) > 0,
            },
            
            # Metadata
            'metadata': {
                'meta_title': bool(product.meta_title),
                'meta_description': bool(product.meta_description),
                'is_active': product.is_active,
                'is_visible': product.is_visible,
                'is_searchable': product.is_searchable,
            },
            
            # Timestamps
            'timestamps': {
                'created_at': product.created_at.isoformat() if product.created_at else None,
                'updated_at': product.updated_at.isoformat() if product.updated_at else None,
                'age_seconds': (datetime.utcnow() - product.created_at).total_seconds() if product.created_at else None,
            },
            
            # Suspicious patterns
            'suspicious_patterns': ProductAuditService._detect_suspicious_patterns(product),
        }
        
        return audit_report
    
    @staticmethod
    def _detect_suspicious_patterns(product: Product) -> Dict[str, List[str]]:
        """Detect obviously suspicious data combinations"""
        warnings = []
        errors = []
        
        # Core field validation
        if not product.name:
            errors.append('CRITICAL: Product name is missing')
        
        if not product.slug:
            errors.append('CRITICAL: Product slug is missing')
        
        if not product.category_id:
            errors.append('WARNING: Product has no category')
        
        if not product.brand_id:
            warnings.append('NOTE: Product has no brand assigned')
        
        # Description validation
        if not product.description and not product.short_description:
            warnings.append('WARNING: Neither description nor short_description exist')
        
        # Stock validation
        if product.stock_quantity is None or product.stock_quantity < 0:
            warnings.append(f'WARNING: Invalid stock_quantity: {product.stock_quantity}')
        
        # Price validation
        if product.price is None or float(product.price) <= 0:
            errors.append(f'CRITICAL: Invalid price: {product.price}')
        
        if product.sale_price and float(product.sale_price) > float(product.price or 0):
            warnings.append(f'WARNING: Sale price ({product.sale_price}) exceeds regular price ({product.price})')
        
        # Image validation
        if not product.images or len(product.images) == 0:
            warnings.append('WARNING: Product has no images')
        elif not any(img.is_primary for img in product.images):
            warnings.append('WARNING: No primary image marked')
        
        # Semantic validation
        if product.name and product.description:
            name_lower = product.name.lower()
            desc_lower = product.description.lower()
            
            # Very basic check: if name contains "milk" but description talks about oils
            if ('milk' in name_lower or 'lotion' in name_lower or 'cream' in name_lower) and \
               ('oil' in desc_lower and 'milk' not in desc_lower and 'lotion' not in desc_lower):
                warnings.append('SUSPICIOUS: Product name/description mismatch (e.g., name says "Milk" but description talks about "Oils")')
        
        # Brand/Category semantic match
        if product.brand and product.category:
            # This is basic - just warn if both exist (normal case)
            pass
        
        return {
            'errors': errors,
            'warnings': warnings,
            'suspicious_count': len(errors) + len(warnings),
        }
    
    @staticmethod
    def compare_products(product_a_id: int, product_b_id: int) -> Dict[str, Any]:
        """Compare two products to find data inconsistencies"""
        product_a = Product.query.get(product_a_id)
        product_b = Product.query.get(product_b_id)
        
        if not product_a or not product_b:
            return {'error': 'One or both products not found'}
        
        comparison = {
            'product_a_id': product_a_id,
            'product_b_id': product_b_id,
            'differences': {
                'name_match': product_a.name == product_b.name,
                'category_match': product_a.category_id == product_b.category_id,
                'brand_match': product_a.brand_id == product_b.brand_id,
                'description_match': product_a.description == product_b.description,
                'price_match': product_a.price == product_b.price,
            }
        }
        
        return comparison
    
    @staticmethod
    def list_suspicious_products(limit: int = 20) -> List[Dict[str, Any]]:
        """Find products with suspicious data patterns"""
        products = Product.query.limit(limit).all()
        suspicious = []
        
        for product in products:
            audit = ProductAuditService.audit_product(product)
            if audit.get('suspicious_patterns', {}).get('suspicious_count', 0) > 0:
                suspicious.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'issues': audit['suspicious_patterns'],
                })
        
        return suspicious
