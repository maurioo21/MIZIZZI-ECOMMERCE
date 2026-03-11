#!/bin/bash

# Test Backend Related Products Endpoint with Slug
BACKEND_URL="https://mizizzi-ecommerce-1.onrender.com"  # Use deployed backend
SLUG="7pieces-automatic-buckle-belt-business-casual-for-men"
TIMEOUT="30"  # Increased timeout for remote API calls

echo "=========================================="
echo "Testing Product Details by Slug"
echo "=========================================="
echo "Backend URL: $BACKEND_URL"
echo "Slug: $SLUG"
echo ""

# Test 1: Get product details by slug
echo "Test 1: GET /api/product-details/by-slug/$SLUG"
echo "Command: curl -X GET \"$BACKEND_URL/api/product-details/by-slug/$SLUG\""
echo ""

PRODUCT_RESPONSE=$(curl -s -m $TIMEOUT -X GET "$BACKEND_URL/api/product-details/by-slug/$SLUG" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

# Separate response and HTTP code
HTTP_CODE="${PRODUCT_RESPONSE##*$'\n'}"
RESPONSE_BODY=$(echo "$PRODUCT_RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

# Extract product ID
PRODUCT_ID=$(echo "$RESPONSE_BODY" | jq -r '.data.id' 2>/dev/null)

if [ -z "$PRODUCT_ID" ] || [ "$PRODUCT_ID" == "null" ]; then
  echo "[ERROR] Could not extract product ID"
  exit 1
fi

echo "Extracted Product ID: $PRODUCT_ID"
echo ""
echo "=========================================="
echo "Testing Related Products Endpoint"
echo "=========================================="
echo "Product ID: $PRODUCT_ID"
echo ""

# Test 2: Get related products
echo "Test 2: GET /api/product-details/$PRODUCT_ID/related?limit=12"
echo "Command: curl -X GET \"$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12\""
echo ""

RELATED_RESPONSE=$(curl -s -m $TIMEOUT -X GET "$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

# Separate response and HTTP code
HTTP_CODE="${RELATED_RESPONSE##*$'\n'}"
RESPONSE_BODY=$(echo "$RELATED_RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

# Test 3: Parse results
echo "=========================================="
echo "Test Results Summary"
echo "=========================================="

RELATED_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.related | length' 2>/dev/null || echo "0")
TOTAL_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.total' 2>/dev/null || echo "0")
SUCCESS=$(echo "$RESPONSE_BODY" | jq -r '.success' 2>/dev/null || echo "false")

echo "Success: $SUCCESS"
echo "Related Products Returned: $RELATED_COUNT"
echo "Total Available: $TOTAL_COUNT"
echo ""

if [ "$RELATED_COUNT" != "0" ] && [ "$RELATED_COUNT" != "null" ]; then
  echo "[✓] Related products endpoint is working!"
  echo ""
  echo "First Related Product Details:"
  echo "$RESPONSE_BODY" | jq '.related[0]' 2>/dev/null
else
  echo "[✗] No related products returned"
fi

echo ""
echo "=========================================="
echo "Test completed!"
