#!/usr/bin/env python3
"""
Test script to verify the backend slug endpoint is working correctly.
Tests both the slug lookup and displays product information.
"""

import requests
import json
import sys
from datetime import datetime

def test_slug_endpoint():
    """Test the product details by slug endpoint"""
    
    backend_url = "http://localhost:8000"
    slug = "7pieces-automatic-buckle-belt-business-casual-for-men"
    endpoint = f"{backend_url}/api/product-details/by-slug/{slug}"
    
    print("=" * 70)
    print("TESTING PRODUCT DETAILS BY SLUG ENDPOINT")
    print("=" * 70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Endpoint: GET {endpoint}")
    print()
    
    try:
        print("📤 Sending request...")
        response = requests.get(
            endpoint,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            timeout=10
        )
        
        print(f"✅ Response Status: {response.status_code}")
        print()
        
        # Pretty print the response
        try:
            data = response.json()
            print("📋 Response Data:")
            print(json.dumps(data, indent=2))
            print()
            
            # Extract key information
            if data.get('success'):
                product = data.get('data', {})
                print("✨ Product Information:")
                print(f"  ID: {product.get('id')}")
                print(f"  Name: {product.get('name')}")
                print(f"  Slug: {product.get('slug')}")
                print(f"  Price: {product.get('price')}")
                print(f"  Stock: {product.get('stock_quantity')}")
                print(f"  Category: {product.get('category', {}).get('name')}")
                print(f"  Brand: {product.get('brand', {}).get('name')}")
                print()
                
                # Cache info
                cache_info = data.get('_cache', {})
                print("💾 Cache Status:")
                print(f"  Status: {cache_info.get('status')}")
                print(f"  Key: {cache_info.get('key')}")
                print()
                
            else:
                print(f"❌ Error: {data.get('error')}")
                print(f"Message: {data.get('message')}")
                print()
                
        except json.JSONDecodeError:
            print("⚠️  Response is not valid JSON")
            print("Response Text:")
            print(response.text)
            print()
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to backend")
        print(f"   Make sure the backend is running on {backend_url}")
        print()
        sys.exit(1)
        
    except requests.exceptions.Timeout:
        print("❌ Timeout Error: Request took too long")
        print()
        sys.exit(1)
        
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        print()
        sys.exit(1)
    
    print("=" * 70)
    print("Test complete!")
    print("=" * 70)

if __name__ == "__main__":
    # Check if requests is available
    try:
        import requests
    except ImportError:
        print("❌ Error: 'requests' library not found")
        print("Install it with: pip install requests")
        sys.exit(1)
    
    test_slug_endpoint()
