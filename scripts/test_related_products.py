#!/usr/bin/env python3
"""
Test the backend's /api/product-details/<id>/related endpoint
"""
import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:5000"
PRODUCT_ID = 72  # Test with a known product ID

def test_related_products():
    """Test the related products endpoint"""
    print("=" * 80)
    print("Testing Backend Related Products Endpoint")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Product ID: {PRODUCT_ID}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()

    # Test 1: Basic request
    print("TEST 1: Fetching related products (limit=12)")
    print("-" * 80)
    try:
        url = f"{BACKEND_URL}/api/product-details/{PRODUCT_ID}/related?limit=12"
        print(f"URL: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Time: {response.elapsed.total_seconds():.2f}s")
        
        if response.ok:
            data = response.json()
            print(f"\nResponse Structure:")
            print(f"  - success: {data.get('success')}")
            print(f"  - total: {data.get('total')}")
            print(f"  - related products count: {len(data.get('related', []))}")
            
            if data.get('related'):
                print(f"\nFirst Related Product:")
                first = data['related'][0]
                print(f"  - ID: {first.get('id')}")
                print(f"  - Name: {first.get('name')}")
                print(f"  - Price: {first.get('price')}")
                print(f"  - Images: {len(first.get('images', []))} images")
                print(f"  - Has images field: {'images' in first}")
                print(f"  - Has image_urls field: {'image_urls' in first}")
                print(f"  - Has thumbnail_url: {'thumbnail_url' in first}")
                
                # Check image structure
                if first.get('images'):
                    print(f"\n  First image structure:")
                    first_image = first['images'][0]
                    print(f"    - Keys: {list(first_image.keys())}")
                    if 'urls' in first_image:
                        print(f"    - URLs keys: {list(first_image['urls'].keys())}")
            
            print(f"\nFull Response:")
            print(json.dumps(data, indent=2))
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    print("\n")

    # Test 2: Different limits
    print("TEST 2: Testing different limits")
    print("-" * 80)
    for limit in [5, 12, 20]:
        try:
            url = f"{BACKEND_URL}/api/product-details/{PRODUCT_ID}/related?limit={limit}"
            response = requests.get(url, timeout=10)
            if response.ok:
                data = response.json()
                count = len(data.get('related', []))
                print(f"Limit {limit}: Got {count} products (status: {response.status_code})")
            else:
                print(f"Limit {limit}: Error {response.status_code}")
        except Exception as e:
            print(f"Limit {limit}: Exception - {e}")

    print("\n")

    # Test 3: Test image URLs from related products
    print("TEST 3: Checking image URLs in related products")
    print("-" * 80)
    try:
        url = f"{BACKEND_URL}/api/product-details/{PRODUCT_ID}/related?limit=3"
        response = requests.get(url, timeout=10)
        if response.ok:
            data = response.json()
            for i, product in enumerate(data.get('related', [])[:3]):
                print(f"\nProduct {i+1}: {product.get('name')}")
                
                # Check images array
                if product.get('images'):
                    print(f"  Images count: {len(product['images'])}")
                    for j, img in enumerate(product['images'][:2]):  # Show first 2 images
                        print(f"    Image {j+1}:")
                        print(f"      - ID: {img.get('id')}")
                        print(f"      - Is Primary: {img.get('is_primary')}")
                        if img.get('urls'):
                            print(f"      - Has large URL: {'large' in img['urls']}")
                            print(f"      - Has original URL: {'original' in img['urls']}")
                            if img['urls'].get('large'):
                                print(f"      - Large URL (first 80 chars): {img['urls']['large'][:80]}...")
                else:
                    print(f"  No images array")
                
                # Check fallback fields
                if product.get('thumbnail_url'):
                    print(f"  Has thumbnail_url: {product['thumbnail_url'][:80]}...")
                if product.get('image_urls'):
                    print(f"  Has image_urls (type: {type(product['image_urls']).__name__})")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 80)
    print("Tests completed!")
    print("=" * 80)

if __name__ == "__main__":
    test_related_products()
