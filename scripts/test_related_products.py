#!/usr/bin/env python3
"""
Test the backend's /api/product-details/<id>/related endpoint
"""
import requests
import json
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:5000"
SLUG = "7pieces-automatic-buckle-belt-business-casual-for-men"

def test_product_by_slug():
    """Test getting product details by slug"""
    print("=" * 80)
    print("Test 1: Product Details by Slug")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Slug: {SLUG}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    try:
        url = f"{BACKEND_URL}/api/product-details/by-slug/{SLUG}"
        print(f"URL: {url}")
        print()
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Time: {response.elapsed.total_seconds():.2f}s")
        print()
        
        if response.ok:
            data = response.json()
            print("Response Structure:")
            print(f"  - success: {data.get('success')}")
            print(f"  - timestamp: {data.get('timestamp')}")
            print(f"  - cache status: {data.get('_cache', {}).get('status')}")
            
            product = data.get('data', {})
            if product:
                print(f"\nProduct Details:")
                print(f"  - ID: {product.get('id')}")
                print(f"  - Name: {product.get('name')}")
                print(f"  - Price: {product.get('price')}")
                print(f"  - Slug: {product.get('slug')}")
                print(f"  - Images count: {len(product.get('images', []))}")
                print(f"  - Stock: {product.get('stock')}")
                
                return product.get('id'), product
        else:
            print(f"Error: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def test_related_products(product_id, limit=12):
    """Test getting related products"""
    print("\n" + "=" * 80)
    print("Test 2: Related Products")
    print("=" * 80)
    print(f"Product ID: {product_id}")
    print(f"Limit: {limit}")
    print()
    
    try:
        url = f"{BACKEND_URL}/api/product-details/{product_id}/related?limit={limit}"
        print(f"URL: {url}")
        print()
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Time: {response.elapsed.total_seconds():.2f}s")
        print()
        
        if response.ok:
            data = response.json()
            print("Response Structure:")
            print(f"  - success: {data.get('success')}")
            print(f"  - total: {data.get('total')}")
            print(f"  - related count: {len(data.get('related', []))}")
            
            if data.get('related'):
                print(f"\nFirst Related Product:")
                first = data['related'][0]
                print(f"  - ID: {first.get('id')}")
                print(f"  - Name: {first.get('name')}")
                print(f"  - Price: {first.get('price')}")
                print(f"  - Slug: {first.get('slug')}")
                print(f"  - Images count: {len(first.get('images', []))}")
                
                # Check image structure
                if first.get('images'):
                    print(f"\n  Image Structure (First Image):")
                    img = first['images'][0]
                    print(f"    - ID: {img.get('id')}")
                    print(f"    - Is Primary: {img.get('is_primary')}")
                    print(f"    - URLs available: {list(img.get('urls', {}).keys())}")
                    
                    urls = img.get('urls', {})
                    for size in ['thumbnail', 'medium', 'large', 'original']:
                        if urls.get(size):
                            print(f"    - {size.upper()}: {urls[size][:60]}...")
                
                print(f"\n✓ Success! Found {len(data.get('related', []))} related products")
                return True
            else:
                print(f"\n⚠ No related products returned")
                return False
        else:
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_image_handling(product_id):
    """Test different limit values to see image consistency"""
    print("\n" + "=" * 80)
    print("Test 3: Image Handling in Related Products")
    print("=" * 80)
    print()
    
    try:
        for limit in [3, 12]:
            url = f"{BACKEND_URL}/api/product-details/{product_id}/related?limit={limit}"
            response = requests.get(url, timeout=10)
            
            if response.ok:
                data = response.json()
                print(f"Limit {limit}:")
                print(f"  - Status: {response.status_code}")
                print(f"  - Products returned: {len(data.get('related', []))}")
                print(f"  - Total available: {data.get('total', 0)}")
                
                # Check if all products have images
                products_with_images = 0
                for p in data.get('related', []):
                    if p.get('images') and len(p.get('images', [])) > 0:
                        products_with_images += 1
                
                print(f"  - Products with images: {products_with_images}/{len(data.get('related', []))}")
                print()
    except Exception as e:
        print(f"Error: {e}")

def main():
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 78 + "║")
    print("║" + "Backend Related Products Endpoint Test".center(78) + "║")
    print("║" + " " * 78 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    
    # Test 1: Get product by slug
    product_id, product_data = test_product_by_slug()
    
    if not product_id:
        print("\n[✗] Could not fetch product details. Exiting.")
        return
    
    # Test 2: Get related products
    success = test_related_products(product_id)
    
    if success:
        # Test 3: Image handling
        test_image_handling(product_id)
    
    print("\n" + "=" * 80)
    print("All tests completed!")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()

