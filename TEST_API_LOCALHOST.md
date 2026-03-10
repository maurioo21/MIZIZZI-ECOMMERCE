# Testing Product Details API on Localhost

## Quick Start (30 seconds)

### Step 1: Start Backend (Terminal 1)
```bash
cd backend
python run.py
# You should see: "Running on http://localhost:5000"
```

### Step 2: Test API (Terminal 2)
```bash
# First call (cache miss)
curl http://localhost:5000/api/product-details/1

# Second call (cache hit - should be faster!)
curl http://localhost:5000/api/product-details/1
```

## Expected Output

### First Call (Cache Miss)
```json
{
  "success": true,
  "cache_hit": false,
  "response_time_ms": 250,
  "data": {
    "id": 1,
    "name": "Product Name",
    "price": 9999,
    "sale_price": 7999,
    "description": "...",
    "in_stock": true,
    "rating": 4.5,
    "reviews": [...],
    "related_products": [...],
    ...
  }
}
```

### Second Call (Cache Hit)
```json
{
  "success": true,
  "cache_hit": true,      // <-- Changed from false
  "response_time_ms": 45,  // <-- Much faster!
  "data": {
    ...same data...
  }
}
```

## All Test Commands

### 1. Check Backend is Running
```bash
curl http://localhost:5000/
```

### 2. Get Product by ID
```bash
# Get product 1
curl http://localhost:5000/api/product-details/1

# Get product 5
curl http://localhost:5000/api/product-details/5

# Pretty print with jq (install jq first)
curl http://localhost:5000/api/product-details/1 | jq .
```

### 3. Get Product by Slug
```bash
curl http://localhost:5000/api/product-details/slug/your-product-slug
```

### 4. Check Cache Status
```bash
curl http://localhost:5000/api/product-details/1/cache-status
```

Output shows:
- `cached`: true/false
- `cache_duration`: seconds
- `ttl_remaining`: seconds left before expiry

### 5. Performance Testing (Response Times)

#### See response time:
```bash
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:5000/api/product-details/1
```

#### Time multiple calls:
```bash
# First call
time curl -s http://localhost:5000/api/product-details/1 > /dev/null

# Second call (should be faster)
time curl -s http://localhost:5000/api/product-details/1 > /dev/null
```

### 6. Extract Specific Fields
```bash
# Get just the product name and price
curl -s http://localhost:5000/api/product-details/1 | jq '.data | {name, price, sale_price}'

# Get reviews only
curl -s http://localhost:5000/api/product-details/1 | jq '.data.reviews'

# Get related products
curl -s http://localhost:5000/api/product-details/1 | jq '.data.related_products'
```

### 7. Test Multiple Products
```bash
# Get products 1-5 and show their names
for id in {1..5}; do
  echo "Product $id:"
  curl -s http://localhost:5000/api/product-details/$id | jq '.data.name'
done
```

### 8. Full Test Script
```bash
# Make the script executable
chmod +x test_api_full.sh

# Run all tests
./test_api_full.sh
```

## Performance Metrics to Expect

| Test | Expected | Notes |
|------|----------|-------|
| First call | 150-300ms | Fresh from database |
| Second call | 20-50ms | From Redis cache |
| Third+ calls | 15-40ms | Cached responses |
| Cache hit | true/false | Shows cache status |
| Response size | 2-10KB | Includes reviews + related |

## Debugging

### API returns error
```bash
# Check backend logs in Terminal 1 for errors
# Common issues:
# - Database not connected: Check DATABASE_URL env var
# - Redis not running: Check REDIS_URL env var
# - Product doesn't exist: Use product ID that exists in DB
```

### Response times not improving
```bash
# Check cache status
curl http://localhost:5000/api/product-details/1/cache-status | jq .

# Output should show cached: true after first call
```

### No reviews or related products
```bash
# These are fetched in parallel, check database contains data
# Use cache-status endpoint to see any errors
curl http://localhost:5000/api/product-details/1/cache-status | jq '.errors'
```

### "Connection refused" error
```bash
# Backend not running, start it:
cd backend
python run.py

# Or check port 5000 is available:
lsof -i :5000
```

## Testing Checklist

- [ ] Backend starts without errors
- [ ] `curl http://localhost:5000/api/product-details/1` returns JSON
- [ ] First call shows `"cache_hit": false`
- [ ] Second call shows `"cache_hit": true`
- [ ] Second call is faster than first
- [ ] Response includes product name, price, reviews
- [ ] Different product IDs return different data
- [ ] Non-existent product returns appropriate error
- [ ] Cache status endpoint works
- [ ] Response times: first <300ms, second <50ms

## Complete Test Flow

```bash
# Terminal 1: Start backend
cd backend
python run.py

# Terminal 2: Run tests
cd .. # back to project root

# Test 1: First product (cache miss)
echo "Test 1: First call (cache miss)"
curl -s http://localhost:5000/api/product-details/1 | jq '.cache_hit'
# Expected: false

# Test 2: Same product (cache hit)
echo "Test 2: Second call (cache hit)"
curl -s http://localhost:5000/api/product-details/1 | jq '.cache_hit'
# Expected: true

# Test 3: Different product
echo "Test 3: Different product"
curl -s http://localhost:5000/api/product-details/2 | jq '.data.name'

# Test 4: Check performance
echo "Test 4: Response times"
echo "First call:"
time curl -s http://localhost:5000/api/product-details/3 > /dev/null
echo "Second call:"
time curl -s http://localhost:5000/api/product-details/3 > /dev/null

# Test 5: All tests pass
echo "All tests complete!"
```

## Troubleshooting Guide

### Issue: "connection refused"
**Solution**: Backend not running
```bash
cd backend
python run.py
```

### Issue: cache_hit always false
**Solution**: Redis not connected
```bash
# Check Redis is running (Upstash credentials in env vars)
# Check REDIS_URL is set correctly
env | grep REDIS
```

### Issue: "Product not found"
**Solution**: Product ID doesn't exist in database
```bash
# Use a product ID that exists, e.g., from admin panel
curl http://localhost:5000/api/product-details/1
```

### Issue: No reviews or related products
**Solution**: Database empty or parallel fetch failed
```bash
# Check cache-status for errors
curl http://localhost:5000/api/product-details/1/cache-status | jq '.errors'
```

### Issue: Slow response times (always >200ms)
**Solution**: Database queries taking too long
```bash
# Check database connection and query performance
# Review backend logs for slow query warnings
```

## Success Indicators

When working correctly, you should see:

1. ✓ First call: 150-300ms, cache_hit: false
2. ✓ Second call: 20-50ms, cache_hit: true
3. ✓ Product data includes all fields (name, price, reviews, etc.)
4. ✓ Cache status shows Redis connection active
5. ✓ Multiple concurrent requests handled smoothly

## Next Steps

Once tests pass:
1. Update frontend to use `/api/product-details/{id}` endpoint
2. Migrate existing product pages to new service
3. Monitor cache hit ratio in production
4. Set up performance alerts
5. Review MIGRATION_GUIDE.md for frontend integration
