#!/usr/bin/env python3
"""
Simple curl test for related products endpoint - quick verification
"""
import subprocess
import json
import time

BASE_URL = "http://localhost:5000"

def run_curl(url, timeout=15):
    """Run curl command and return response"""
    cmd = [
        'curl',
        '-s',
        '-X', 'GET',
        url,
        '-H', 'Content-Type: application/json',
        '-w', '\n%{http_code}'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        lines = result.stdout.strip().split('\n')
        http_code = lines[-1]
        body = '\n'.join(lines[:-1])
        return http_code, body
    except subprocess.TimeoutExpired:
        return None, "TIMEOUT"
    except Exception as e:
        return None, str(e)

print("=" * 80)
print("Testing Related Products Endpoint")
print("=" * 80)
print()

# Step 1: Get product by slug
print("Step 1: Getting product by slug...")
slug = "7pieces-automatic-buckle-belt-business-casual-for-men"
url = f"{BASE_URL}/api/product-details/by-slug/{slug}"
print(f"URL: {url}")

http_code, response = run_curl(url)
print(f"HTTP Status: {http_code}")

if http_code == "200":
    try:
        data = json.loads(response)
        product_id = data.get('data', {}).get('id')
        print(f"✓ Product ID: {product_id}")
        print()
        
        # Step 2: Get related products
        print("Step 2: Testing related products endpoint...")
        url = f"{BASE_URL}/api/product-details/{product_id}/related?limit=12"
        print(f"URL: {url}")
        
        http_code, response = run_curl(url)
        print(f"HTTP Status: {http_code}")
        
        if http_code == "200":
            try:
                data = json.loads(response)
                related_count = len(data.get('related', []))
                total = data.get('total', 0)
                success = data.get('success', False)
                
                print(f"✓ Success: {success}")
                print(f"✓ Related Products: {related_count}")
                print(f"✓ Total Available: {total}")
                print()
                
                if related_count > 0:
                    print("First Related Product:")
                    first = data['related'][0]
                    print(f"  - ID: {first.get('id')}")
                    print(f"  - Name: {first.get('name')}")
                    print(f"  - Price: {first.get('price')}")
                    print(f"  - Images: {len(first.get('images', []))}")
                    
                    if first.get('images'):
                        img = first['images'][0]
                        print(f"\n  First Image:")
                        print(f"    - ID: {img.get('id')}")
                        print(f"    - URLs: {list(img.get('urls', {}).keys())}")
                    
                    print("\n✅ ENDPOINT WORKING!")
                else:
                    print("⚠ No related products returned")
                    print("\nResponse:", json.dumps(data, indent=2)[:500])
            except json.JSONDecodeError:
                print(f"✗ Invalid JSON response: {response[:200]}")
        else:
            print(f"✗ Error: {response[:200]}")
    except json.JSONDecodeError:
        print(f"✗ Invalid JSON response: {response[:200]}")
else:
    print(f"✗ Error: {response[:200]}")

print()
print("=" * 80)
print("Test Complete")
print("=" * 80)
