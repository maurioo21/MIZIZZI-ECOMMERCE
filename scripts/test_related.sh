#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKEND_URL="http://localhost:5000"
SLUG="7pieces-automatic-buckle-belt-business-casual-for-men"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 1: Get Product Details by Slug${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "URL: $BACKEND_URL/api/product-details/by-slug/$SLUG"
echo ""

# Get product by slug
PRODUCT_RESPONSE=$(curl -s "$BACKEND_URL/api/product-details/by-slug/$SLUG")
echo "Response:"
echo "$PRODUCT_RESPONSE" | jq '.' 2>/dev/null || echo "$PRODUCT_RESPONSE"
echo ""

# Extract product ID
PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | jq -r '.data.id' 2>/dev/null)
PRODUCT_NAME=$(echo "$PRODUCT_RESPONSE" | jq -r '.data.name' 2>/dev/null)
PRODUCT_CATEGORY=$(echo "$PRODUCT_RESPONSE" | jq -r '.data.category_id' 2>/dev/null)

if [ -z "$PRODUCT_ID" ] || [ "$PRODUCT_ID" == "null" ]; then
  echo -e "${RED}[ERROR] Could not extract product ID${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Successfully fetched product${NC}"
echo "  - ID: $PRODUCT_ID"
echo "  - Name: $PRODUCT_NAME"
echo "  - Category ID: $PRODUCT_CATEGORY"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 2: Get Related Products${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "URL: $BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12"
echo ""

# Get related products
RELATED_RESPONSE=$(curl -s "$BACKEND_URL/api/product-details/$PRODUCT_ID/related?limit=12")
echo "Response:"
echo "$RELATED_RESPONSE" | jq '.' 2>/dev/null || echo "$RELATED_RESPONSE"
echo ""

# Parse results
SUCCESS=$(echo "$RELATED_RESPONSE" | jq -r '.success' 2>/dev/null)
RELATED_COUNT=$(echo "$RELATED_RESPONSE" | jq -r '.related | length' 2>/dev/null)
TOTAL=$(echo "$RELATED_RESPONSE" | jq -r '.total' 2>/dev/null)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Success: $SUCCESS"
echo "Related Products Returned: $RELATED_COUNT"
echo "Total Available: $TOTAL"
echo ""

if [ "$RELATED_COUNT" != "0" ] && [ "$RELATED_COUNT" != "null" ]; then
  echo -e "${GREEN}✓ Related products endpoint is working!${NC}"
  echo ""
  echo "First 3 Related Products:"
  echo "$RELATED_RESPONSE" | jq '.related[0:3]' 2>/dev/null || echo "Could not parse"
  echo ""
  
  # Check image structure of first product
  echo -e "${BLUE}Image Structure of First Product:${NC}"
  echo "$RELATED_RESPONSE" | jq '.related[0].images[0]' 2>/dev/null || echo "No images found"
else
  echo -e "${RED}✗ No related products returned${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
