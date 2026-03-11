#!/usr/bin/env python3
"""
Test the backend's /api/product-details/<id>/related endpoint using curl
"""
import subprocess
import json
import sys

BACKEND_URL = "http://localhost:5000"
SLUG = "7pieces-automatic-buckle-belt-business-casual-for-men"

def run_curl(url, description=""):
    """Execute a curl command and return the formatted response"""
    print(f"\n{'='*80}")
    if description:
        print(f"{description}")
    print(f"{'='*80}")
    print(f"URL: {url}")
    print()
    
    cmd = [
        "curl",
        "-s",
        "-X", "GET",
        url,
        "-H", "Content-Type: application/json"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            print(f"[ERROR] curl failed: {result.stderr}")
            return None
        
        # Try to parse as JSON and pretty print
        try:
            data = json.loads(result.stdout)
            print(json.dumps(data, indent=2))
            return data
        except json.JSONDecodeError:
            print(result.stdout)
            return None
            
    except subprocess.TimeoutExpired:
        print("[ERROR] Request timed out")
        return None
    except Exception as e:
        print(f"[ERROR] {e}")
        return None

def main():
    print("\n" + "╔" + "="*78 + "╗")
    print("║" + " "*78 + "║")
    print("║" + "Backend Related Products Endpoint Test (curl)".center(78) + "║")
    print("║" + " "*78 + "║")
    print("╚" + "="*78 + "╝")
    
    # Test 1: Get product by slug
    print("\nTest 1: Fetch Product Details by Slug")
    url1 = f"{BACKEND_URL}/api/product-details/by-slug/{SLUG}"
    product_data = run_curl(url1, "Getting product details to extract ID")
    
    if not product_data or not product_data.get('data'):
        print("\n[ERROR] Could not fetch product details")
        return
    
    product_id = product_data['data'].get('id')
    product_name = product_data['data'].get('name')
    
    print(f"\n[SUCCESS] Product found:")
    print(f"  - ID: {product_id}")
    print(f"  - Name: {product_name}")
    print(f"  - Images: {len(product_data['data'].get('images', []))} available")
    
    # Test 2: Get related products
    print("\n\nTest 2: Fetch Related Products")
    url2 = f"{BACKEND_URL}/api/product-details/{product_id}/related?limit=12"
    related_data = run_curl(url2, f"Getting related products for product ID {product_id}")
    
    if related_data and related_data.get('success'):
        print(f"\n[SUCCESS] Related products endpoint working!")
        print(f"  - Total related: {related_data.get('total', 0)}")
        print(f"  - Returned: {len(related_data.get('related', []))}")
        
        # Check image structure
        if related_data.get('related'):
            print(f"\n[INFO] First related product structure:")
            first = related_data['related'][0]
            print(f"  - ID: {first.get('id')}")
            print(f"  - Name: {first.get('name')}")
            print(f"  - Price: {first.get('price')}")
            print(f"  - Sale Price: {first.get('sale_price')}")
            print(f"  - Images count: {len(first.get('images', []))}")
            
            if first.get('images'):
                img = first['images'][0]
                print(f"\n  Image structure:")
                print(f"    - ID: {img.get('id')}")
                print(f"    - URLs available: {list(img.get('urls', {}).keys())}")
                
                urls = img.get('urls', {})
                for size in ['thumbnail', 'medium', 'large', 'original']:
                    if urls.get(size):
                        url_preview = urls[size][:70] + "..." if len(urls[size]) > 70 else urls[size]
                        print(f"    - {size}: {url_preview}")
    else:
        print(f"\n[ERROR] Related products endpoint failed")
        if related_data:
            print(f"  Error: {related_data.get('error')}")
    
    # Test 3: Test different limits
    print("\n\nTest 3: Testing Different Limits")
    print("="*80)
    
    for limit in [3, 6, 12]:
        url = f"{BACKEND_URL}/api/product-details/{product_id}/related?limit={limit}"
        print(f"\nTesting with limit={limit}:")
        print(f"URL: {url}")
        
        cmd = [
            "curl",
            "-s",
            "-X", "GET",
            url,
            "-H", "Content-Type: application/json"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            data = json.loads(result.stdout) if result.returncode == 0 else {}
            
            print(f"  Status: {data.get('success', False)}")
            print(f"  Total available: {data.get('total', 0)}")
            print(f"  Returned: {len(data.get('related', []))}")
        except Exception as e:
            print(f"  [ERROR] {e}")
    
    print("\n" + "="*80)
    print("Test completed!")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
