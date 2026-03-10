#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Product Details API - Localhost Testing${NC}"
echo -e "${BLUE}========================================${NC}\n"

BASE_URL="http://localhost:5000"
API_PATH="/api/product-details"

# Function to print section headers
print_section() {
    echo -e "\n${YELLOW}>>> $1${NC}"
}

# Function to run curl and show results
run_test() {
    local test_name=$1
    local url=$2
    local description=$3
    
    echo -e "\n${BLUE}Test: $test_name${NC}"
    echo -e "URL: $url"
    echo -e "Description: $description"
    echo -e "${YELLOW}Request:${NC}"
    echo "curl -X GET '$url' -H 'Content-Type: application/json'"
    echo -e "\n${YELLOW}Response:${NC}"
    
    curl -X GET "$url" \
        -H "Content-Type: application/json" \
        -w "\n${YELLOW}Status: %{http_code}${NC}\n" \
        -s | head -c 1000
    
    echo ""
}

# Check if backend is running
print_section "Step 1: Checking if Backend is Running"
echo "Attempting to connect to $BASE_URL..."

if curl -s "$BASE_URL/health" > /dev/null 2>&1 || curl -s "$BASE_URL/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is NOT running${NC}"
    echo -e "${YELLOW}Start backend with: cd backend && python run.py${NC}"
    exit 1
fi

# Test 1: Get product by ID (first call - should be cache miss)
print_section "Step 2: Testing GET /api/product-details/{id} (First Call - Cache Miss)"
run_test "Get Product by ID (1st call)" \
    "$BASE_URL$API_PATH/1" \
    "Fetches product by ID, should query database (150-300ms)"

# Test 2: Get same product by ID (second call - should be cache hit)
print_section "Step 3: Testing Same Product (Second Call - Cache Hit)"
run_test "Get Product by ID (2nd call - Cached)" \
    "$BASE_URL$API_PATH/1" \
    "Same product, should hit Redis cache (20-50ms)"

# Test 3: Get product by different ID
print_section "Step 4: Testing Different Product"
run_test "Get Different Product by ID" \
    "$BASE_URL$API_PATH/2" \
    "Different product ID, new cache entry"

# Test 4: Check cache status
print_section "Step 5: Checking Cache Status"
run_test "Check Cache Status" \
    "$BASE_URL$API_PATH/1/cache-status" \
    "Debug endpoint to see cache metadata"

# Test 5: Get product by slug
print_section "Step 6: Testing GET /api/product-details/slug/{slug}"
run_test "Get Product by Slug" \
    "$BASE_URL$API_PATH/slug/example-product" \
    "Fetches product by slug instead of ID"

# Test 6: Performance comparison
print_section "Step 7: Performance Comparison (Time First 3 Calls)"

echo -e "${YELLOW}Making 3 consecutive calls to same product...${NC}\n"

for i in {1..3}; do
    echo -e "${BLUE}Call $i:${NC}"
    time_output=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL$API_PATH/1")
    echo -e "Response time: ${GREEN}${time_output}s${NC}"
    echo ""
    sleep 0.5
done

# Test 7: Test with actual JSON parsing
print_section "Step 8: Detailed Response Analysis"
echo -e "${YELLOW}Fetching product 1 and extracting key fields...${NC}\n"

response=$(curl -s "$BASE_URL$API_PATH/1")

echo -e "${BLUE}Full Response:${NC}"
echo "$response" | head -c 2000

echo -e "\n\n${BLUE}Key Fields (if jq available):${NC}"
if command -v jq &> /dev/null; then
    echo "$response" | jq '{
        success: .success,
        cache_hit: .cache_hit,
        product_name: .data.name,
        product_price: .data.price,
        sale_price: .data.sale_price,
        in_stock: .data.in_stock,
        reviews_count: (.data.reviews | length)
    }' 2>/dev/null || echo "Could not parse JSON with jq"
else
    echo "jq not installed - run: brew install jq (macOS) or apt-get install jq (Linux)"
fi

# Test 8: Error handling - non-existent product
print_section "Step 9: Error Handling (Non-existent Product)"
run_test "Get Non-Existent Product" \
    "$BASE_URL$API_PATH/999999" \
    "Should return error or empty response"

# Summary
print_section "Testing Summary"
echo -e "${GREEN}✓ Testing complete!${NC}\n"

echo -e "${BLUE}Expected Results:${NC}"
echo "1. First call should take 150-300ms (database query)"
echo "2. Second call should take 20-50ms (Redis cache hit)"
echo "3. cache_hit field should be true on subsequent calls"
echo "4. Product data should include: name, price, reviews, images"
echo "5. Response should have success: true"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. If tests pass: Product API is working correctly!"
echo "2. Check Redis is running if cache_hit is always false"
echo "3. Check database connection if getting null responses"
echo "4. Review TESTING_LOCALHOST.md for detailed troubleshooting"
echo ""

echo -e "${BLUE}========================================${NC}"
