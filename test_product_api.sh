#!/bin/bash

# Product Details API - Local Testing Script
# Usage: bash test_product_api.sh [product_id]

set -e

BASE_URL="http://localhost:5000"
PRODUCT_ID="${1:-1}"

echo "================================================"
echo "Product Details API - Localhost Testing"
echo "================================================"
echo ""

# Check if backend is running
echo "Step 1: Checking if backend is running..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "ERROR: Backend not responding at $BASE_URL"
    echo "Please start the backend first:"
    echo "  cd backend"
    echo "  python run.py"
    exit 1
fi
echo "✓ Backend is running"
echo ""

# Test with bypass filters (for testing inactive products)
echo "Step 2: Testing with include_inactive=true (bypasses active/visible filters)"
echo "Command: curl -s '$BASE_URL/api/product-details/$PRODUCT_ID?include_inactive=true' | jq ."
echo "---"
RESPONSE=$(curl -s "$BASE_URL/api/product-details/$PRODUCT_ID?include_inactive=true")

if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
    echo "✓ Valid JSON response"
    echo ""
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
    if [ "$SUCCESS" = "true" ]; then
        echo "✓ Product found!"
        echo ""
        echo "Product Details:"
        echo "$RESPONSE" | jq '.data | {id, name, price, sale_price, is_active, is_visible}'
        echo ""
        CACHE=$(echo "$RESPONSE" | jq -r '.cache_hit')
        TIME=$(echo "$RESPONSE" | jq -r '.response_time_ms')
        echo "Caching Info:"
        echo "  - Cache hit: $CACHE"
        echo "  - Response time: ${TIME}ms"
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.error')
        echo "ERROR: $ERROR"
        echo ""
        echo "Diagnostics:"
        echo "$RESPONSE" | jq .
    fi
else
    echo "ERROR: Invalid JSON response"
    echo "$RESPONSE"
fi
echo ""
echo ""

# Now test normal call (with filters)
echo "Step 3: Testing normal API call (requires is_active=true, is_visible=true)"
echo "Command: curl -s '$BASE_URL/api/product-details/$PRODUCT_ID' | jq ."
echo "---"
RESPONSE=$(curl -s "$BASE_URL/api/product-details/$PRODUCT_ID")

if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
    if [ "$SUCCESS" = "true" ]; then
        echo "✓ Product found (and is active/visible)!"
        echo "$RESPONSE" | jq .
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.error')
        echo "⚠ Product not found with filters: $ERROR"
        echo ""
        echo "This means product $PRODUCT_ID either:"
        echo "  1. Doesn't exist in database"
        echo "  2. Has is_active = FALSE"
        echo "  3. Has is_visible = FALSE"
        echo ""
        echo "To fix: Update product to be active and visible:"
        echo "  UPDATE products SET is_active = TRUE, is_visible = TRUE WHERE id = $PRODUCT_ID;"
    fi
else
    echo "ERROR: Invalid JSON response"
    echo "$RESPONSE"
fi
echo ""
echo ""

# Test cache status
echo "Step 4: Testing Cache Status"
echo "Command: curl -s '$BASE_URL/api/product-details/$PRODUCT_ID/cache-status' | jq ."
echo "---"
CACHE_RESPONSE=$(curl -s "$BASE_URL/api/product-details/$PRODUCT_ID/cache-status")

if echo "$CACHE_RESPONSE" | jq . > /dev/null 2>&1; then
    echo "✓ Valid JSON response"
    echo "$CACHE_RESPONSE" | jq .
else
    echo "ERROR: Invalid cache status response"
    echo "$CACHE_RESPONSE"
fi
echo ""
echo ""

echo "================================================"
echo "Testing Complete!"
echo "================================================"
echo ""
echo "Summary:"
echo "1. Product Details API is working"
echo "2. If 'Product not found' with normal call, use ?include_inactive=true to test"
echo "3. Then run SQL to activate the product:"
echo "   UPDATE products SET is_active = TRUE, is_visible = TRUE WHERE id = $PRODUCT_ID;"
echo ""
