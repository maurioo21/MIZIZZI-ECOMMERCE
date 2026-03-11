#!/bin/bash

# Test backend slug endpoint with curl

echo "Testing Product Details by Slug Endpoint"
echo "=========================================="
echo ""

BACKEND_URL="http://localhost:8000"
SLUG="7pieces-automatic-buckle-belt-business-casual-for-men"

echo "📍 Endpoint: GET $BACKEND_URL/api/product-details/by-slug/$SLUG"
echo ""

echo "🔍 Testing slug endpoint..."
echo ""

curl -v -X GET "$BACKEND_URL/api/product-details/by-slug/$SLUG" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"

echo ""
echo ""
echo "=========================================="
echo "Test complete!"
