# Testing Product Details API on Localhost

## Prerequisites

Before testing, ensure you have:
1. Backend running on `localhost:5000`
2. Redis running (local or Upstash)
3. Database populated with products
4. curl installed (comes with most systems)
5. jq installed for JSON formatting (optional but recommended)

## Installation Check

### Check if curl is available
```bash
curl --version
```

### Check if jq is available (optional)
```bash
jq --version
```

If jq is not installed:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Windows (using chocolatey)
choco install jq
```

## Starting Backend

### Option 1: Local Development
```bash
cd backend
python -m flask run
# Backend will be at http://localhost:5000
```

### Option 2: Using Environment Variables
```bash
cd backend
export FLASK_APP=app.py
export FLASK_ENV=development
python -m flask run --port 5000
```

### Option 3: With Gunicorn (Production-like)
```bash
cd backend
gunicorn -w 4 -b 127.0.0.1:5000 "app:create_app()"
```

## Redis Setup

### Option 1: Local Redis
```bash
# Start Redis (macOS)
brew services start redis

# Or run directly
redis-server
```

### Option 2: Docker Redis
```bash
docker run -d -p 6379:6379 redis:latest
```

### Option 3: Upstash (Cloud)
- Already configured in your environment
- Ensure REDIS_URL environment variable is set

## Step-by-Step Testing

### Step 1: Verify Backend is Running
```bash
curl -s http://localhost:5000/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-10T19:00:00Z"
}
```

If you get "Connection refused", the backend is not running.

### Step 2: Test Product Fetch - First Call (Cache Miss)
```bash
curl -i -X GET "http://localhost:5000/api/product-details/1" \
  -H "Content-Type: application/json"
```

Look for:
- `HTTP/1.1 200 OK` - Success
- `cache_hit: false` - First call, not cached
- `response_time_ms: 150-300` - Time taken

Full response example:
```bash
curl -s -X GET "http://localhost:5000/api/product-details/1" | jq .
```

Expected JSON:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Product Name",
    "price": 9999.00,
    "sale_price": 7999.00,
    "stock": 50,
    "description": "Product description...",
    "image_urls": ["url1", "url2", "url3"],
    "category_id": 1,
    "rating": 4.5,
    "reviews": [
      {
        "id": 1,
        "title": "Great product",
        "rating": 5,
        "helpful_count": 10
      }
    ],
    "related_products": [
      {
        "id": 2,
        "name": "Related Product",
        "price": 5999.00,
        "thumbnail_url": "url"
      }
    ],
    "inventory": {
      "available_quantity": 50,
      "is_in_stock": true,
      "is_low_stock": false,
      "stock_status": "in_stock"
    }
  },
  "cache_hit": false,
  "response_time_ms": 245,
  "timestamp": "2024-03-10T19:00:00Z"
}
```

### Step 3: Test Product Fetch - Second Call (Cache Hit)
```bash
curl -s -X GET "http://localhost:5000/api/product-details/1" | jq .
```

Look for:
- `cache_hit: true` - Cached from Redis
- `response_time_ms: 20-60` - Much faster
- Same data as first call

### Step 4: Test By Slug
```bash
curl -s -X GET "http://localhost:5000/api/product-details/slug/my-product-slug" | jq .
```

Replace `my-product-slug` with actual product slug from your database.

### Step 5: Check Cache Status
```bash
curl -s -X GET "http://localhost:5000/api/product-details/1/cache-status" | jq .
```

Expected response:
```json
{
  "product_id": 1,
  "cached": true,
  "cache_key": "product:1",
  "ttl_seconds": 455,
  "created_at": "2024-03-10T19:00:00Z"
}
```

### Step 6: Monitor Real-Time Performance

Run multiple requests and observe timing:

```bash
# Test request #1
echo "Request 1 (cache miss):"
time curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit, .response_time_ms'

# Test request #2
echo "Request 2 (cache hit):"
time curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit, .response_time_ms'

# Test request #3
echo "Request 3 (cache hit):"
time curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit, .response_time_ms'
```

Expected output:
```
Request 1 (cache miss):
false
245

Request 2 (cache hit):
true
35

Request 3 (cache hit):
true
28
```

## Performance Testing

### Measure Response Times
```bash
# Single request timing
curl -w "Total time: %{time_total}s\nConnect time: %{time_connect}s\nTransfer time: %{time_starttransfer}s\n" \
  -o /dev/null -s \
  "http://localhost:5000/api/product-details/1"
```

### Concurrent Requests (Simulating Load)
```bash
# Send 10 requests concurrently
for i in {1..10}; do
  curl -s "http://localhost:5000/api/product-details/$i" | jq '.cache_hit' &
done
wait

# Send 50 requests sequentially to same product
for i in {1..50}; do
  curl -w "%{time_total}\n" -o /dev/null -s "http://localhost:5000/api/product-details/1"
done
```

### Load Test with Apache Bench
```bash
# Install ab (ApacheBench)
# macOS
brew install httpd

# Then run test
ab -n 100 -c 10 "http://localhost:5000/api/product-details/1"
```

Expected results:
- Requests per second: 50-200+
- Average response time: 20-100ms
- No failed requests

## Debugging

### Issue: 404 Not Found
```bash
# Check if endpoint exists
curl -v "http://localhost:5000/api/product-details/1"

# Look for 404 in response headers
# If you see 404, the blueprint may not be registered
```

**Solution**:
- Verify blueprint in `backend/app/__init__.py`
- Check if product ID exists: `SELECT id FROM products WHERE id = 1;`

### Issue: 500 Internal Server Error
```bash
# See detailed error
curl -s "http://localhost:5000/api/product-details/1" | jq .

# Check backend logs (in the Flask terminal)
# Look for stack trace and error message
```

**Solution**:
- Check database connection
- Verify all required columns exist in Product model
- Check if Redis is connected (not required but improves performance)

### Issue: Slow Response Even on Cache Hit
```bash
# Check if cache is actually being used
curl -s "http://localhost:5000/api/product-details/1/cache-status" | jq '.cached, .ttl_seconds'

# If cached=false, cache might not be working
```

**Solution**:
- Restart backend
- Check Redis connection
- Clear Redis cache: `redis-cli FLUSHDB`

### View Backend Logs
In the terminal where you started Flask, you'll see logs like:
```
[v0] Cache miss - fetching product 1 from database
[v0] Response time: 245ms
[v0] Cache hit - returning from Redis
[v0] Response time: 35ms
```

## Using Test Script

### Run automatic test
```bash
bash test_product_api.sh

# Test specific product ID
bash test_product_api.sh 5
```

### What the script does:
1. Checks if backend is running
2. Fetches product details
3. Checks cache status
4. Compares first vs second call times
5. Tests multiple products
6. Checks Redis connection

## Redis Verification

### Check if Redis has cached data
```bash
# Start Redis CLI
redis-cli

# Check all product cache keys
> KEYS product:*

# Get specific product from cache
> GET product:1

# Check time to live (TTL)
> TTL product:1

# Exit
> exit
```

### Clear Redis cache if needed
```bash
redis-cli
> FLUSHDB  # Clear all cache
> exit
```

## Testing Frontend Integration

Once backend is working, test frontend service:

```javascript
// In browser console
const service = new ProductDetailsService();

// Test 1: Fetch product
service.getProductById(1).then(data => {
  console.log('Product:', data);
});

// Test 2: Check cache
service.getProductById(1).then(data => {
  console.log('Second call (should be faster):', data);
});

// Test 3: Get by slug
service.getProductBySlug('my-product-slug').then(data => {
  console.log('Product by slug:', data);
});
```

## Common Test Scenarios

### Scenario 1: Fresh Start
```bash
# 1. Clear cache
redis-cli FLUSHDB

# 2. Request product (cache miss)
curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit'
# Output: false

# 3. Request same product (cache hit)
curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit'
# Output: true
```

### Scenario 2: Cache Expiration
```bash
# 1. Get product (cached)
curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit'
# Output: true

# 2. Wait for TTL to expire (default 600s)
sleep 605

# 3. Request again (cache miss)
curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit'
# Output: false (new fetch from database)
```

### Scenario 3: Concurrent Requests
```bash
# Send 20 concurrent requests
for i in {1..20}; do
  curl -s "http://localhost:5000/api/product-details/1" &
done
wait

# All should succeed without errors
```

## Performance Benchmarks

Expected response times on localhost:

| Scenario | Expected Time | Notes |
|----------|---------------|-------|
| First call (cold cache) | 150-300ms | Database query + serialization |
| Cached call (warm) | 20-50ms | Redis hit |
| 10 concurrent calls | 30-100ms | Thread pool parallelization |
| 100 consecutive calls | 25-40ms avg | Cache consistently hits |

## Troubleshooting Checklist

- [ ] Backend is running (`curl http://localhost:5000/health`)
- [ ] Database has products (`SELECT COUNT(*) FROM products`)
- [ ] Redis is running (`redis-cli PING` returns "PONG")
- [ ] Product ID 1 exists in database
- [ ] No errors in backend logs
- [ ] Response is valid JSON
- [ ] Cache hit changes from false to true
- [ ] Response times decrease on second call

## Next Steps

1. Run all tests above
2. Verify cache is working (response time decreases)
3. Check Redis has cached data
4. Deploy to frontend using `product-details-optimized.ts`
5. Monitor production performance
