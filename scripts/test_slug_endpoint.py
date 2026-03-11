#!/usr/bin/env python3
"""
Test script for the new backend slug-based product endpoint.
Tests the /api/product-details/by-slug/<slug> endpoint.
"""

import requests
import json
import sys

# Configuration
BACKEND_URL = "http://localhost:5000"
SLUG = "7pieces-automatic-buckle-belt-business-casual-for-men"

def test_slug_endpoint():
    """Test the slug-based product endpoint."""
    
    print("=" * 60)
    print("Testing Backend Slug-Based Product Endpoint")
    print("=" * 60)
    print()
    
    # Test URL
    url = f"{BACKEND_URL}/api/product-details/by-slug/{SLUG}"
    
    print(f"📍 Endpoint URL: {url}")
    print(f"🏷️  Product Slug: {SLUG}")
    print()
    
    try:
        print("🔄 Sending request...")
        response = requests.get(
            url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            timeout=10
        )
        
        print(f"✅ Status Code: {response.status_code}")
        print(f"📦 Response Headers:")
        for key, value in response.headers.items():
            print(f"   {key}: {value}")
        print()
        
        # Parse JSON response
        try:
            data = response.json()
            print("📊 Response Body (formatted):")
            print(json.dumps(data, indent=2))
            print()
            
            # Extract key info
            if data.get('success'):
                product_data = data.get('data', {})
                print("✨ Product Information:")
                print(f"   ID: {product_data.get('id')}")
                print(f"   Name: {product_data.get('name')}")
                print(f"   Slug: {product_data.get('slug')}")
                print(f"   Price: ${product_data.get('price')}")
                print(f"   Stock: {product_data.get('stock_quantity')}")
                print(f"   Rating: {product_data.get('average_rating')}/5")
                
                cache_info = data.get('_cache', {})
                print()
                print("💾 Cache Information:")
                print(f"   Status: {cache_info.get('status')}")
                print(f"   Key: {cache_info.get('key')}")
                print(f"   Timestamp: {cache_info.get('timestamp')}")
            else:
                print(f"❌ Error: {data.get('error')}")
                
        except json.JSONDecodeError:
            print("❌ Failed to parse JSON response")
            print("Raw response:", response.text)
            return False
        
        print()
        print("=" * 60)
        
        if response.status_code == 200:
            print("✅ TEST PASSED: Slug endpoint is working!")
            return True
        elif response.status_code == 404:
            print("⚠️  TEST FAILED: Product not found (404)")
            return False
        else:
            print(f"⚠️  TEST FAILED: Unexpected status code {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Unable to connect to backend")
        print(f"   Make sure the backend is running at {BACKEND_URL}")
        return False
    except requests.exceptions.Timeout:
        print("❌ Timeout: Request took too long")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_slug_endpoint()
    sys.exit(0 if success else 1)
