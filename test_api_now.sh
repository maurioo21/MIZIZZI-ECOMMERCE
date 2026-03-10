#!/bin/bash

echo "Testing Product Details API Endpoints"
echo "======================================"
echo ""
echo "Make sure your backend is running at http://localhost:5000"
echo ""

# Test 1: Get product by ID
echo "Test 1: GET /api/product-details/1"
echo "-----------------------------------"
curl -s http://localhost:5000/api/product-details/1 | jq '.' 2>/dev/null || echo "Error: Could not reach API"
echo ""

# Test 2: Check cache status
echo "Test 2: GET /api/product-details/1/cache-status"
echo "-----------------------------------------------"
curl -s http://localhost:5000/api/product-details/1/cache-status | jq '.' 2>/dev/null || echo "Not found"
echo ""

# Test 3: Get by slug
echo "Test 3: GET /api/product-details/slug/example-product"
echo "----------------------------------------------------"
curl -s http://localhost:5000/api/product-details/slug/example-product | jq '.' 2>/dev/null || echo "Not found"
echo ""

# Test 4: Response time test
echo "Test 4: First call response time (should be 200-400ms)"
echo "----------------------------------------------------"
curl -w "Response Time: %{time_total}s\n" -s http://localhost:5000/api/product-details/1 > /dev/null
echo ""

echo "Test 5: Second call response time (should be 20-50ms - cached)"
echo "-----------------------------------------------------------"
curl -w "Response Time: %{time_total}s\n" -s http://localhost:5000/api/product-details/1 > /dev/null
echo ""

echo "All tests completed!"
