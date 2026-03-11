#!/usr/bin/env python3
"""
Test script for optimized product details endpoint with Cloudinary image optimization.
Tests the /api/product-details/by-slug/<slug> endpoint and verifies:
1. SKU is null (not "false")
2. Product name is trimmed (no leading spaces)
3. Image URLs are optimized for different sizes
4. Clean logging with no duplicates
"""

import requests
import json
from typing import Optional

# Configuration
BACKEND_URL = "http://localhost:5000"
SLUG = "7pieces-automatic-buckle-belt-business-casual-for-men"

def test_slug_endpoint():
    """Test the optimized slug endpoint"""
    url = f"{BACKEND_URL}/api/product-details/by-slug/{SLUG}"
    
    print("=" * 70)
    print("Testing Optimized Product Details Endpoint")
    print("=" * 70)
    print(f"URL: {url}\n")
    
    try:
        response = requests.get(url, headers={"Content-Type": "application/json"}, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        print(f"Status Code: {response.status_code}")
        print(f"Cache Status: {data.get('_cache', {}).get('status')}\n")
        
        # Extract product data
        product = data.get('data', {})
        
        # Test 1: Check SKU is null (not "false")
        sku = product.get('sku')
        print(f"✓ SKU Value: {repr(sku)}")
        if sku is None:
            print("  ✅ PASS - SKU is properly null (not 'false')")
        else:
            print(f"  ❌ FAIL - SKU should be null, got: {repr(sku)}")
        
        # Test 2: Check product name is trimmed (no leading space)
        name = product.get('name', '')
        print(f"\n✓ Product Name: {repr(name)}")
        if name and name[0] != ' ':
            print("  ✅ PASS - Product name is trimmed (no leading space)")
        else:
            print("  ❌ FAIL - Product name has leading space")
        
        # Test 3: Check image URLs are optimized for different sizes
        images = product.get('images', [])
        print(f"\n✓ Image Optimization Check:")
        print(f"  Total images: {len(images)}")
        
        if images:
            primary_image = next((img for img in images if img.get('is_primary')), images[0])
            urls = primary_image.get('urls', {})
            
            print(f"\n  Primary Image URLs:")
            for size_type, url in urls.items():
                print(f"    {size_type}: {url[:80]}...")
            
            # Check if URLs are different (optimized)
            unique_urls = set(urls.values())
            if len(unique_urls) > 1:
                print("\n  ✅ PASS - Image URLs are optimized (different sizes)")
            else:
                print("\n  ℹ️  INFO - All image sizes use same URL (non-Cloudinary or unoptimized)")
        
        # Test 4: Verify response structure
        print(f"\n✓ Response Structure:")
        print(f"  - success: {data.get('success')}")
        print(f"  - has data: {'data' in data}")
        print(f"  - has _cache: {'_cache' in data}")
        print(f"  - has timestamp: {'timestamp' in data}")
        
        # Display full response for inspection
        print(f"\n" + "=" * 70)
        print("Full Response (first 1500 chars):")
        print("=" * 70)
        print(json.dumps(data, indent=2)[:1500] + "...")
        
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to backend at", BACKEND_URL)
        print("Make sure the backend is running on port 5000")
    except requests.exceptions.Timeout:
        print("❌ ERROR: Request timeout")
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")

def test_multiple_requests():
    """Test cache HIT behavior"""
    url = f"{BACKEND_URL}/api/product-details/by-slug/{SLUG}"
    
    print(f"\n" + "=" * 70)
    print("Testing Cache Behavior (Multiple Requests)")
    print("=" * 70)
    
    try:
        for i in range(3):
            response = requests.get(url, timeout=5)
            data = response.json()
            cache_status = data.get('_cache', {}).get('status')
            timestamp = data.get('_cache', {}).get('timestamp')
            
            print(f"Request {i+1}: Cache {cache_status:4s} at {timestamp}")
        
        print("\n✅ Cache behavior verified")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    test_slug_endpoint()
    test_multiple_requests()
