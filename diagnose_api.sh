#!/bin/bash

echo "🔍 PRODUCT DETAILS API DIAGNOSTIC TEST"
echo "========================================"
echo ""

BASE_URL="http://localhost:5000"

echo "1️⃣  Testing API Connection..."
curl -s "$BASE_URL/api/product-details/1" | jq . && echo "✅ API is responding" || echo "❌ API not responding"
echo ""

echo "2️⃣  Checking available products..."
curl -s "$BASE_URL/api/products?limit=5" | jq '.data[] | {id, name, is_active, is_visible}' 2>/dev/null || echo "❌ Cannot fetch products"
echo ""

echo "3️⃣  Testing with a different product ID..."
echo "Testing ID: 2"
curl -s "$BASE_URL/api/product-details/2" | jq '.data | {id, name, price}' 2>/dev/null || echo "❌ Cannot fetch product 2"
echo ""

echo "4️⃣  Check cache status..."
curl -s "$BASE_URL/api/product-details/1/cache-status" | jq . 2>/dev/null || echo "❌ Cannot check cache"
echo ""

echo "📋 DIAGNOSTICS COMPLETE"
echo "Next Steps:"
echo "  - If no products returned, add test products to the database"
echo "  - If products exist but not found, check is_active and is_visible fields"
echo "  - Look for products where both is_active=1 and is_visible=1"
