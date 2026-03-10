# Product Details API - Curl Testing Guide

## Quick Start - Copy & Paste Commands

### 1. Test Basic Product Fetch by ID
```bash
curl -X GET "http://localhost:5000/api/product-details/1" \
  -H "Content-Type: application/json"
```

Expected response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Product Name",
    "price": 9999,
    "sale_price": 7999,
    "description": "Product description",
    "image_urls": ["url1", "url2"],
    "thumbnail_url": "thumbnail_url",
    "stock": 50,
    "category_id": 1,
    "rating": 4.5,
    "reviews": [...],
    "related_products": [...],
    "inventory": {...}
  },
  "cache_hit": false,
  "response_time_ms": 245
}
```

### 2. Test Product Fetch by Slug
```bash
curl -X GET "http://localhost:5000/api/product-details/slug/my-product-slug" \
  -H "Content-Type: application/json"
```

### 3. Check Cache Status
```bash
curl -X GET "http://localhost:5000/api/product-details/1/cache-status" \
  -H "Content-Type: application/json"
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

### 4. Invalidate Cache (Admin Only)
```bash
curl -X POST "http://localhost:5000/api/product-details/1/invalidate-cache" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response (200 OK):
```json
{
  "success": true,
  "message": "Cache invalidated for product 1"
}
```

## Detailed Testing Commands

### Test 1: First Call (Cache Miss)
```bash
curl -v -X GET "http://localhost:5000/api/product-details/1" \
  -H "Content-Type: application/json" \
  -w "\nTime: %{time_total}s\n"
```

What to look for:
- `cache_hit: false` - First call, database fetch
- `response_time_ms: 150-300ms` - Parallel data fetching
- Response includes all data: product, reviews, related, inventory

### Test 2: Second Call (Cache Hit - Should be instant)
```bash
curl -v -X GET "http://localhost:5000/api/product-details/1" \
  -H "Content-Type: application/json" \
  -w "\nTime: %{time_total}s\n"
```

What to look for:
- `cache_hit: true` - Redis cache hit
- `response_time_ms: 20-50ms` - Much faster
- Same response data as first call

### Test 3: Batch Related Products
```bash
curl -X POST "http://localhost:5000/api/product-details/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "product_ids": [1, 2, 3, 4, 5]
  }'
```

### Test 4: Error Handling - Invalid Product
```bash
curl -X GET "http://localhost:5000/api/product-details/99999" \
  -H "Content-Type: application/json"
```

Expected response (404 Not Found):
```json
{
  "error": "Product not found",
  "status": 404
}
```

### Test 5: Error Handling - Invalid Slug
```bash
curl -X GET "http://localhost:5000/api/product-details/slug/non-existent-slug" \
  -H "Content-Type: application/json"
```

Expected response (404 Not Found):
```json
{
  "error": "Product not found",
  "status": 404
}
```

## Performance Testing

### Measure Response Time
```bash
# Single request
curl -w "Response time: %{time_total}s\n" \
  -o /dev/null -s \
  "http://localhost:5000/api/product-details/1"

# Multiple requests
for i in {1..5}; do
  echo "Request $i:"
  curl -w "Time: %{time_total}s\n" \
    -o /dev/null -s \
    "http://localhost:5000/api/product-details/$i"
done
```

### Monitor Redis Cache
```bash
# Check Redis cache keys (in another terminal)
redis-cli KEYS "product:*"

# Check specific product cache
redis-cli GET "product:1"

# Check cache TTL
redis-cli TTL "product:1"
```

## Testing with jq (For Pretty JSON Output)

### Pretty-print response
```bash
curl -s "http://localhost:5000/api/product-details/1" | jq .
```

### Extract specific fields
```bash
# Get product name only
curl -s "http://localhost:5000/api/product-details/1" | jq '.data.name'

# Get all review titles
curl -s "http://localhost:5000/api/product-details/1" | jq '.data.reviews[].title'

# Check cache hit
curl -s "http://localhost:5000/api/product-details/1" | jq '.cache_hit'
```

## Complete Test Script

Save this as `test_api.sh` and run with `bash test_api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:5000"
PRODUCT_ID=1

echo "=== Product Details API Testing ==="
echo ""

# Test 1: Get product by ID
echo "1. Testing GET /api/product-details/$PRODUCT_ID"
echo "---"
curl -s "$BASE_URL/api/product-details/$PRODUCT_ID" | jq .
echo ""

# Test 2: Cache status
echo "2. Testing Cache Status"
echo "---"
curl -s "$BASE_URL/api/product-details/$PRODUCT_ID/cache-status" | jq .
echo ""

# Test 3: Get by slug
echo "3. Testing GET /api/product-details/slug/my-slug"
echo "---"
curl -s "$BASE_URL/api/product-details/slug/my-slug" | jq .
echo ""

# Test 4: Performance comparison
echo "4. Testing Performance (First call)"
echo "---"
START=$(date +%s%N)
RESPONSE=$(curl -s "$BASE_URL/api/product-details/2")
END=$(date +%s%N)
TIME=$((($END - $START) / 1000000))
echo "Response time: ${TIME}ms"
echo "$RESPONSE" | jq '.cache_hit, .response_time_ms'
echo ""

echo "5. Testing Performance (Cached call)"
echo "---"
START=$(date +%s%N)
RESPONSE=$(curl -s "$BASE_URL/api/product-details/2")
END=$(date +%s%N)
TIME=$((($END - $START) / 1000000))
echo "Response time: ${TIME}ms"
echo "$RESPONSE" | jq '.cache_hit, .response_time_ms'
echo ""

echo "=== Testing Complete ==="
```

## Troubleshooting

### Issue: 404 Not Found
**Solution**: 
- Check if backend is running: `curl http://localhost:5000/health`
- Verify product exists in database
- Check if blueprint is registered in Flask app

```bash
# Verify backend is running
curl -v http://localhost:5000/api/product-details/1
```

### Issue: 500 Internal Server Error
**Solution**:
- Check backend logs for errors
- Verify Redis connection
- Check database connection
- Review JSON request format

```bash
# View detailed error response
curl -s -X GET "http://localhost:5000/api/product-details/1" | jq .
```

### Issue: Slow Response (Not Using Cache)
**Solution**:
- Check cache status: `curl http://localhost:5000/api/product-details/1/cache-status`
- Verify Redis is connected: `redis-cli PING`
- Check if TTL expired: `redis-cli TTL "product:1"`

```bash
# Check Redis cache
redis-cli
> KEYS product:*
> GET product:1
> TTL product:1
```

### Issue: Cache Hit Still Slow
**Solution**:
- Network latency is normal
- Check Redis connection latency
- Verify no other heavy operations running
- Monitor server resources

```bash
# Measure network latency
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s http://localhost:5000/api/product-details/1
done
```

## Expected Response Times

| Scenario | Time | Notes |
|----------|------|-------|
| Cold cache (DB) | 150-300ms | Parallel data fetch |
| Warm cache (Redis) | 20-50ms | Network only |
| Local memory (browser) | 5-10ms | Instant |
| Invalidation | 10-30ms | Cache clear + return |

## Endpoints Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/product-details/{id}` | GET | No | Fetch by product ID |
| `/api/product-details/slug/{slug}` | GET | No | Fetch by slug |
| `/api/product-details/{id}/cache-status` | GET | No | Check cache status |
| `/api/product-details/{id}/invalidate-cache` | POST | Yes | Clear cache (admin) |
| `/api/product-details/bulk` | POST | No | Fetch multiple products |

## Next Steps

1. Start backend: `python -m backend.app` or `flask run`
2. Start Redis: `redis-server` or Upstash cloud
3. Run curl commands above
4. Check response times and cache behavior
5. Monitor logs for any errors
6. Verify frontend integration when ready

