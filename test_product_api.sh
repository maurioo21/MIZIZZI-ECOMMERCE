#!/bin/bash

# Product Details API - Local Testing Script
# Usage: bash test_product_api.sh

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
    echo "  python -m flask run"
    exit 1
fi
echo "✓ Backend is running"
echo ""

# Test basic endpoint
echo "Step 2: Testing GET /api/product-details/$PRODUCT_ID"
echo "Command: curl -s $BASE_URL/api/product-details/$PRODUCT_ID | jq ."
echo "---"
RESPONSE=$(curl -s "$BASE_URL/api/product-details/$PRODUCT_ID")

if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
    echo "✓ Valid JSON response"
    echo ""
    echo "Response Summary:"
    echo "  - Has data: $(echo "$RESPONSE" | jq 'has("data")')"
    echo "  - Cache hit: $(echo "$RESPONSE" | jq '.cache_hit')"
    echo "  - Response time: $(echo "$RESPONSE" | jq '.response_time_ms')ms"
    echo ""
    
    if [ "$(echo "$RESPONSE" | jq -r '.success')" = "true" ]; then
        echo "Product Details:"
        echo "$RESPONSE" | jq '.data | {id, name, price, sale_price, stock, category_id}'
    else
        echo "ERROR: $(echo "$RESPONSE" | jq -r '.error')"
    fi
else
    echo "ERROR: Invalid JSON response"
    echo "$RESPONSE"
fi
echo ""

# Test cache status
echo "Step 3: Testing Cache Status"
echo "Command: curl -s $BASE_URL/api/product-details/$PRODUCT_ID/cache-status | jq ."
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

# Performance test
echo "Step 4: Performance Comparison"
echo "---"
echo "First call (cache miss):"
START=$(date +%s%N)
curl -s "$BASE_URL/api/product-details/$PRODUCT_ID" > /dev/null
END=$(date +%s%N)
TIME1=$((($END - $START) / 1000000))
echo "  Time: ${TIME1}ms"

sleep 1

echo "Second call (should be cached):"
START=$(date +%s%N)
curl -s "$BASE_URL/api/product-details/$PRODUCT_ID" > /dev/null
END=$(date +%s%N)
TIME2=$((($END - $START) / 1000000))
echo "  Time: ${TIME2}ms"

if [ $TIME2 -lt $TIME1 ]; then
    SPEEDUP=$((($TIME1 / $TIME2)))
    echo "✓ Cache working! ${SPEEDUP}x faster on second call"
else
    echo "⚠ Cache may not be working (similar times)"
fi
echo ""

# Test multiple products
echo "Step 5: Testing Multiple Products"
echo "---"
for i in 1 2 3; do
    RESULT=$(curl -s "$BASE_URL/api/product-details/$i")
    if echo "$RESULT" | jq . > /dev/null 2>&1; then
        NAME=$(echo "$RESULT" | jq -r '.data.name // "Error"')
        TIME=$(echo "$RESULT" | jq -r '.response_time_ms // "N/A"')
        CACHE=$(echo "$RESULT" | jq -r '.cache_hit // "N/A"')
        echo "Product $i: $NAME (${TIME}ms, cache_hit: $CACHE)"
    fi
done
echo ""

# Redis check (optional)
echo "Step 6: Checking Redis Connection"
echo "---"
if command -v redis-cli &> /dev/null; then
    if redis-cli PING > /dev/null 2>&1; then
        echo "✓ Redis is connected"
        COUNT=$(redis-cli KEYS "product:*" | wc -l)
        echo "  Cached products: $COUNT"
    else
        echo "⚠ Redis is not responding"
    fi
else
    echo "ℹ redis-cli not found (skipped)"
fi
echo ""

echo "================================================"
echo "Testing Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Check that response times decreased on second call"
echo "2. Verify cache_hit changes from false to true"
echo "3. Test with curl commands from CURL_TESTING_GUIDE.md"
echo "4. Monitor backend logs for any errors"
echo ""
