"""
Product Audit & Diagnostic Service
Provides comprehensive diagnostics for detecting data integrity issues in products.
Production-safe: logs warnings without blocking operations.
"""
import logging
import json
from typing import Dict, Any, List, Optional
from app.models.models import Product, Brand, Category

logger = logging.getLogger(__name__)


class ProductAuditService:
    """Service for auditing and diagnosing product data integrity."""
    
    @staticmethod
    def audit_product(product: Product) -> Dict[str, Any]:
        """
        Comprehensive audit of a single product's data integrity.
        Returns diagnostic report without modifying the product.
        
        Args:
            product: Product instance to audit
        
        Returns:
            Dictionary with audit results and warnings
        """
        audit_report = {
            'product_id': product.id,
            'timestamp': product.updated_at.isoformat() if product.updated_at else None,
            'fields_audit': {},
            'relationships_audit': {},
            'warnings': [],
            'data_quality_score': 0
        }
        
        # Audit core fields
        audit_report['fields_audit'] = {
            'name': {
                'value': product.name,
                'is_empty': not product.name or product.name.strip() == '',
                'length': len(product.name) if product.name else 0
            },
            'description': {
                'value': product.description[:100] + '...' if product.description and len(product.description) > 100 else product.description,
                'is_empty': not product.description or product.description.strip() == '',
                'length': len(product.description) if product.description else 0
            },
            'short_description': {
                'value': product.short_description[:50] + '...' if product.short_description and len(product.short_description) > 50 else product.short_description,
                'is_empty': not product.short_description or product.short_description.strip() == '',
                'length': len(product.short_description) if product.short_description else 0
            },
            'price': {
                'value': float(product.price) if product.price else None,
                'is_valid': product.price and float(product.price) > 0
            },
            'stock': {
                'value': product.stock,
                'is_valid': product.stock is not None and product.stock >= 0
            },
            'sku': {
                'value': product.sku,
                'is_empty': not product.sku or product.sku.strip() == ''
            }
        }
        
        # Audit relationships
        try:
            audit_report['relationships_audit']['brand'] = {
                'brand_id': product.brand_id,
                'brand_object': product.brand.name if product.brand else None,
                'has_relationship': product.brand is not None,
                'is_valid': product.brand is not None if product.brand_id else True
            }
        except Exception as e:
            audit_report['relationships_audit']['brand'] = {
                'error': f'Failed to load brand: {str(e)}',
                'brand_id': product.brand_id
            }
        
        try:
            audit_report['relationships_audit']['category'] = {
                'category_id': product.category_id,
                'category_object': product.category.name if product.category else None,
                'has_relationship': product.category is not None,
                'is_valid': product.category is not None
            }
        except Exception as e:
            audit_report['relationships_audit']['category'] = {
                'error': f'Failed to load category: {str(e)}',
                'category_id': product.category_id
            }
        
        # Check semantic consistency (name vs description)
        name_desc_match = ProductAuditService._check_semantic_alignment(
            product.name,
            product.description,
            product.category.name if product.category else None,
            product.brand.name if product.brand else None
        )
        
        if not name_desc_match['is_aligned']:
            audit_report['warnings'].append({
                'severity': 'WARNING',
                'message': name_desc_match['mismatch_reason'],
                'details': name_desc_match
            })
        
        # Check for empty required fields
        if not product.name or product.name.strip() == '':
            audit_report['warnings'].append({
                'severity': 'ERROR',
                'message': 'Product name is empty',
                'field': 'name'
            })
        
        if not product.description or product.description.strip() == '':
            audit_report['warnings'].append({
                'severity': 'WARNING',
                'message': 'Product description is empty',
                'field': 'description'
            })
        
        if not product.price or float(product.price) <= 0:
            audit_report['warnings'].append({
                'severity': 'ERROR',
                'message': 'Product price is invalid or zero',
                'field': 'price',
                'value': product.price
            })
        
        if not product.category:
            audit_report['warnings'].append({
                'severity': 'ERROR',
                'message': 'Product has no category assigned',
                'field': 'category_id'
            })
        
        # Calculate data quality score (0-100)
        score = 100
        for warning in audit_report['warnings']:
            if warning['severity'] == 'ERROR':
                score -= 25
            elif warning['severity'] == 'WARNING':
                score -= 10
        
        audit_report['data_quality_score'] = max(0, score)
        
        # Log findings if critical issues found
        if audit_report['data_quality_score'] < 75:
            logger.warning(f"Product {product.id} ({product.name}) has data quality issues: {audit_report['warnings']}")
        
        return audit_report
    
    @staticmethod
    def _check_semantic_alignment(
        name: str,
        description: str,
        category: Optional[str],
        brand: Optional[str]
    ) -> Dict[str, Any]:
        """
        Check if product name, description, category, and brand seem semantically aligned.
        Returns non-blocking warnings for suspicious patterns.
        
        Returns:
            Dictionary with alignment assessment
        """
        result = {
            'is_aligned': True,
            'mismatch_reason': None,
            'details': {}
        }
        
        if not name or not description:
            return result
        
        name_lower = name.lower()
        desc_lower = description.lower()
        
        # Check 1: Description should mention key words from name
        name_tokens = [t.strip() for t in name.lower().split() if len(t) > 3]
        desc_tokens = [t.strip() for t in desc_lower.split() if len(t) > 3]
        
        # At least 20% of name tokens should appear in description
        matching_tokens = sum(1 for token in name_tokens if token in desc_tokens)
        token_match_ratio = matching_tokens / len(name_tokens) if name_tokens else 1
        
        result['details']['name_token_match_ratio'] = token_match_ratio
        
        if token_match_ratio < 0.2 and len(name_tokens) >= 3:
            result['is_aligned'] = False
            result['mismatch_reason'] = (
                f"Product name and description have low semantic alignment. "
                f"Name mentions '{name}' but description talks about different topic."
            )
            result['details']['reason'] = 'name_description_mismatch'
        
        # Check 2: Category keywords should appear in name or description
        if category:
            category_lower = category.lower()
            category_in_name = category_lower in name_lower
            category_in_desc = category_lower in desc_lower
            
            result['details']['category_in_name'] = category_in_name
            result['details']['category_in_desc'] = category_in_desc
            
            if not category_in_name and not category_in_desc:
                result['is_aligned'] = False
                result['mismatch_reason'] = (
                    f"Category '{category}' not mentioned in product name or description."
                )
                result['details']['reason'] = 'category_mismatch'
        
        # Check 3: Brand keywords should appear in description if specified
        if brand and len(brand) > 2:
            brand_lower = brand.lower()
            brand_in_desc = brand_lower in desc_lower
            
            result['details']['brand_in_description'] = brand_in_desc
            
            # Only warn if brand is in name but NOT in description (likely mistake)
            if brand_lower in name_lower and not brand_in_desc:
                result['is_aligned'] = False
                result['mismatch_reason'] = (
                    f"Brand '{brand}' mentioned in product name but not in description."
                )
                result['details']['reason'] = 'brand_description_mismatch'
        
        return result
    
    @staticmethod
    def compare_products(product_id_1: int, product_id_2: int) -> Dict[str, Any]:
        """
        Compare two products to detect similar issues or patterns.
        Useful for finding duplicate or related data corruption.
        
        Args:
            product_id_1: First product ID
            product_id_2: Second product ID
        
        Returns:
            Comparison report
        """
        p1 = Product.query.get(product_id_1)
        p2 = Product.query.get(product_id_2)
        
        if not p1 or not p2:
            return {'error': 'One or both products not found'}
        
        comparison = {
            'product_1_id': product_id_1,
            'product_2_id': product_id_2,
            'field_differences': {},
            'potential_issues': []
        }
        
        # Compare key fields
        fields_to_compare = ['name', 'description', 'brand_id', 'category_id', 'price']
        
        for field in fields_to_compare:
            val1 = getattr(p1, field, None)
            val2 = getattr(p2, field, None)
            
            if val1 != val2:
                comparison['field_differences'][field] = {
                    'product_1': val1,
                    'product_2': val2
                }
        
        return comparison


# Global instance
product_audit_service = ProductAuditService()
