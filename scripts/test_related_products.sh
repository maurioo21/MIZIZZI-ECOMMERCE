#!/bin/bash

# Test the /api/product-details/<id>/related endpoint
BACKEND_URL="http://localhost:5000"
PRODUCT_ID="72"  # Test with a known product ID

echo "Testing Backend Related Products Endpoint"
echo "=========================================="
echo "Backend URL: $BACKEND_URL"
echo "Product ID: $PRODUCT_ID"
echo ""

# Test 1: Fetch related products for a specific product
echo "Test 1: GET /api/product-details/$PRODUCT_ID/related"
echo "Command: curl -X GET \"$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12\""
echo ""
curl -X GET "$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v

echo ""
echo ""

# Test 2: Pretty print the response
echo "Test 2: Pretty printed response"
echo "==============================="
curl -s -X GET "$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "jq not available, showing raw response:"

curl -s -X GET "$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12" \
  -H "Content-Type: application/json"

echo ""
echo ""

# Test 3: Test with different limit
echo "Test 3: Testing with different limit (limit=5)"
echo "=============================================="
curl -s -X GET "$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=5" \
  -H "Content-Type: application/json" | jq '.related | length' 2>/dev/null || curl -s -X GET "$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=5"

echo ""
echo "Tests completed!"
