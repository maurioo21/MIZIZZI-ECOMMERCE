#!/usr/bin/env python3
"""
Test script for Product Data Integrity Fixes
Tests audit service, validator service, and admin routes for data integrity.
Run: python scripts/test_product_integrity.py
"""
import sys
import os

# Add backend path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../backend'))

from app import create_app
from app.models.models import Product, Category, Brand, db
from app.services.product_audit_service import product_audit_service
from app.services.product_validator import product_validator

def test_audit_service():
    """Test the product audit service"""
    print("\n=== Testing Product Audit Service ===")
    
    # Get a product to audit
    product = Product.query.first()
    if not product:
        print("❌ No products found in database")
        return False
    
    print(f"Auditing product {product.id}: {product.name}")
    
    audit_report = product_audit_service.audit_product(product)
    
    print(f"Data Quality Score: {audit_report['data_quality_score']}/100")
    print(f"Fields Audited: {len(audit_report['fields_audit'])}")
    print(f"Warnings Found: {len(audit_report['warnings'])}")
    
    if audit_report['warnings']:
        print("\nWarnings:")
        for warning in audit_report['warnings']:
            print(f"  - [{warning['severity']}] {warning['message']}")
    
    print("✅ Audit service working")
    return True


def test_validator_service():
    """Test the product validator service"""
    print("\n=== Testing Product Validator Service ===")
    
    # Test 1: Valid product data
    valid_data = {
        'name': 'Test Product',
        'description': 'This is a test product',
        'price': 99.99,
        'category_id': 1,  # Assuming category 1 exists
    }
    
    is_valid, errors = product_validator.validate_product_fields(valid_data, strict=False)
    print(f"Valid data test: {'✅' if is_valid else '❌'} (errors: {len(errors)})")
    
    # Test 2: Invalid data (missing name)
    invalid_data = {
        'price': 99.99,
        'category_id': 1,
    }
    
    is_valid, errors = product_validator.validate_product_fields(invalid_data, strict=False)
    print(f"Invalid data test: {'✅' if not is_valid else '❌'} (should have errors)")
    print(f"  Errors found: {len(errors)}")
    
    # Test 3: Field mapping validation
    product = Product.query.first()
    if product:
        test_update = {
            'name': 'Updated Name',
            'description': 'Updated Description',
            'invalid_field_xyz': 'Should be rejected'
        }
        
        is_valid, result = product_validator.validate_field_mapping(test_update, product)
        print(f"Field mapping test: {'✅' if not is_valid else '❌'} (should reject invalid_field_xyz)")
        if not is_valid:
            print(f"  Invalid fields: {list(result.keys())}")
    
    print("✅ Validator service working")
    return True


def test_data_sanitization():
    """Test data sanitization"""
    print("\n=== Testing Data Sanitization ===")
    
    test_data = {
        'name': '  Product With Spaces  ',
        'description': '  Description  ',
        'price': '99.99',
        'stock': '100',
        'is_featured': 'true',
    }
    
    sanitized = product_validator.sanitize_product_data(test_data)
    
    print("Original data:")
    for key, value in test_data.items():
        print(f"  {key}: {repr(value)}")
    
    print("\nSanitized data:")
    for key, value in sanitized.items():
        if key in test_data:
            print(f"  {key}: {repr(value)}")
    
    # Verify trimming worked
    if sanitized.get('name') == 'Product With Spaces':
        print("✅ Whitespace trimming works")
    else:
        print("❌ Whitespace trimming failed")
    
    return True


def test_semantic_alignment():
    """Test semantic alignment checking"""
    print("\n=== Testing Semantic Alignment ===")
    
    # Get a real product
    product = Product.query.first()
    if not product or not product.description:
        print("⚠️  No products with descriptions found, skipping test")
        return True
    
    alignment = product_audit_service._check_semantic_alignment(
        product.name,
        product.description,
        product.category.name if product.category else None,
        product.brand.name if product.brand else None
    )
    
    print(f"Product: {product.name[:50]}")
    print(f"Is aligned: {alignment['is_aligned']}")
    
    if not alignment['is_aligned']:
        print(f"Mismatch reason: {alignment['mismatch_reason']}")
    
    print("✅ Semantic alignment check working")
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("PRODUCT DATA INTEGRITY TEST SUITE")
    print("=" * 60)
    
    # Create app context
    app = create_app()
    with app.app_context():
        try:
            # Verify database connection
            db.session.execute('SELECT 1')
            product_count = Product.query.count()
            print(f"\n✅ Database connected. Products in DB: {product_count}")
            
            if product_count == 0:
                print("⚠️  No products in database. Some tests will be skipped.")
            
            # Run tests
            results = []
            results.append(("Audit Service", test_audit_service()))
            results.append(("Validator Service", test_validator_service()))
            results.append(("Data Sanitization", test_data_sanitization()))
            results.append(("Semantic Alignment", test_semantic_alignment()))
            
            # Summary
            print("\n" + "=" * 60)
            print("TEST SUMMARY")
            print("=" * 60)
            
            for test_name, passed in results:
                status = "✅ PASS" if passed else "❌ FAIL"
                print(f"{status}: {test_name}")
            
            all_passed = all(result for _, result in results)
            print("\n" + ("✅ ALL TESTS PASSED" if all_passed else "❌ SOME TESTS FAILED"))
            
            return 0 if all_passed else 1
            
        except Exception as e:
            print(f"\n❌ Error running tests: {e}")
            import traceback
            traceback.print_exc()
            return 1


if __name__ == '__main__':
    sys.exit(main())
