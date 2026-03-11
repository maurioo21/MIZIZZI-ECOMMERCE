#!/bin/bash

# Test script for the new slug-based product endpoint

# Configuration
BACKEND_URL="http://localhost:5000"
SLUG="7pieces-automatic-buckle-belt-business-casual-for-men"

echo "========================================"
echo "Testing Backend Slug Endpoint"
echo "========================================"
echo ""

# Test 1: Fetch product by slug
echo "Test 1: Fetching product by slug..."
echo "URL: $BACKEND_URL/api/product-details/by-slug/$SLUG"
echo ""

curl -X GET \
  "$BACKEND_URL/api/product-details/by-slug/$SLUG" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -v

echo ""
echo ""
echo "========================================"
echo "Test Complete"
echo "========================================"
