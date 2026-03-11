# Product Details API - cURL Testing Guide

## Backend API Endpoints

Your product details backend is running at: `http://localhost:5000/api/product-details`

### 1. Get Full Product Details
Test fetching complete product information with Redis caching:

```bash
# Get product details by ID (replace PRODUCT_ID with actual ID)
curl -X GET "http://localhost:5000/api/product-details/1" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -v

# With cache metrics
curl -X GET "http://localhost:5000/api/product-details/1?include_cache_info=true" \
  -H "Content-Type: application/json" \
  -v
```

Expected Response (First Request - Cache Miss):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Product Name",
    "description": "Product description...",
    "price": 9999,
    "original_price": 12000,
    "discount_percentage": 17,
    "sku": "SKU123",
    "category": {
      "id": 1,
      "name": "Category Name",
      "slug": "category-slug"
    },
    "images": [
      {
        "id": 1,
        "url": "cloudinary_url",
        "alt": "Product image",
        "is_primary": true
      }
    ],
    "inventory": {
      "available_quantity": 50,
      "is_in_stock": true
    },
    "ratings": {
      "average_rating": 4.5,
      "total_reviews": 120
    },
    "variants": [
      {
        "id": 1,
        "color": "Red",
        "size": "M"
      }
    ]
  },
  "timestamp": "2026-03-11T04:38:49.123456",
  "cache_hit": false,
  "response_time_ms": 145
}
```

Expected Response (Second Request - Cache Hit):
```json
{
  "success": true,
  "data": { /* same as above */ },
  "timestamp": "2026-03-11T04:38:50.123456",
  "cache_hit": true,
  "response_time_ms": 8
}
```

### 2. Get Optimized Product Images (Cloudinary)
Fetch product images with automatic Cloudinary optimization:

```bash
# Get all product images with Cloudinary URLs
curl -X GET "http://localhost:5000/api/product-details/1/images" \
  -H "Content-Type: application/json" \
  -v

# Get specific image size (thumbnail, medium, large)
curl -X GET "http://localhost:5000/api/product-details/1/images?size=large" \
  -H "Content-Type: application/json" \
  -v
```

Expected Response:
```json
{
  "success": true,
  "product_id": 1,
  "images": [
    {
      "id": 1,
      "original_url": "local_url",
      "cloudinary_url": "https://res.cloudinary.com/.../image.jpg",
      "sizes": {
        "thumbnail": "https://res.cloudinary.com/.../c_fill,w_100,h_100/image.jpg",
        "medium": "https://res.cloudinary.com/.../c_fill,w_500,h_500/image.jpg",
        "large": "https://res.cloudinary.com/.../c_fill,w_1200,h_1200/image.jpg"
      },
      "alt": "Product image",
      "is_primary": true
    }
  ],
  "total": 3,
  "cache_hit": true,
  "response_time_ms": 5
}
```

### 3. Get Real-time Product Inventory
Fetch current stock levels (not cached):

```bash
# Get real-time inventory (always fresh, not cached)
curl -X GET "http://localhost:5000/api/product-details/1/inventory" \
  -H "Content-Type: application/json" \
  -v
```

Expected Response:
```json
{
  "success": true,
  "product_id": 1,
  "inventory": {
    "available_quantity": 50,
    "is_in_stock": true,
    "status": "in_stock"
  },
  "timestamp": "2026-03-11T04:38:49.123456",
  "cached": false
}
```

### 4. Get Related Products (Cached per Category)
Fetch related products from the same category:

```bash
# Get related products (cached for 10 minutes)
curl -X GET "http://localhost:5000/api/product-details/1/related?limit=6" \
  -H "Content-Type: application/json" \
  -v

# With pagination
curl -X GET "http://localhost:5000/api/product-details/1/related?limit=6&page=1" \
  -H "Content-Type: application/json" \
  -v
```

Expected Response:
```json
{
  "success": true,
  "product_id": 1,
  "related_products": [
    {
      "id": 2,
      "name": "Related Product 1",
      "price": 5999,
      "discount_percentage": 10,
      "thumbnail": "cloudinary_url",
      "rating": 4.2,
      "reviews": 85
    }
  ],
  "total": 15,
  "limit": 6,
  "page": 1,
  "cache_hit": true,
  "response_time_ms": 12
}
```

### 5. Cache Management Endpoints

```bash
# Check cache status for a product
curl -X GET "http://localhost:5000/api/product-details/cache-status/1" \
  -H "Content-Type: application/json" \
  -v

# Invalidate product cache
curl -X POST "http://localhost:5000/api/product-details/cache-invalidate" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1
  }' \
  -v

# Clear all related products cache for a category
curl -X POST "http://localhost:5000/api/product-details/cache-invalidate-category" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": 1
  }' \
  -v
```

## Performance Expectations

### Cache Hit Performance:
- **First request (cache miss):** 120-200ms (database query + serialization)
- **Subsequent requests (cache hit):** 5-15ms (Redis retrieval + deserialization)
- **Cache improvement:** 90-95% faster on cache hits

### Cache TTLs:
- Product Details: 15 minutes
- Product Images: 30 minutes
- Related Products: 10 minutes
- Real-time Inventory: No caching (always fresh)

## Testing Cache Effectiveness

### Test 1: Verify Cache Hit
```bash
# First request - will show cache_hit: false
time curl -s http://localhost:5000/api/product-details/1 | jq '.cache_hit'

# Second request immediately after - will show cache_hit: true
time curl -s http://localhost:5000/api/product-details/1 | jq '.cache_hit'
```

### Test 2: Monitor Cache Performance
```bash
# Run 10 requests and measure response times
for i in {1..10}; do
  echo "Request $i:"
  curl -s http://localhost:5000/api/product-details/1 | jq '.response_time_ms'
done
```

### Test 3: Test Image Optimization
```bash
# Verify Cloudinary URLs are being generated
curl -s http://localhost:5000/api/product-details/1/images | jq '.images[0].cloudinary_url'

# Check multiple sizes are available
curl -s http://localhost:5000/api/product-details/1/images | jq '.images[0].sizes'
```

### Test 4: Inventory Freshness
```bash
# Inventory should never be cached - always fresh
for i in {1..3}; do
  echo "Request $i (inventory always fresh):"
  curl -s http://localhost:5000/api/product-details/1/inventory | jq '.cached'
done
```

## Troubleshooting

### Getting 404 Errors
```bash
# Verify the blueprint is registered
curl -X GET http://localhost:5000/api/product-details/health
# Should return: {"status": "ok", "message": "Product Details API is running"}
```

### Check if Blueprint Loaded
```bash
# Look for this in backend logs:
# INFO ⚠️ product_details_bp → /api/product-details
```

### Test Redis Connection
```bash
# The cache endpoints will fail if Redis is not available
curl -s http://localhost:5000/api/product-details/1/images | jq '.error'
```

### View Detailed Timing Information
```bash
# Get full response with timing
curl -w "\nResponse time: %{time_total}s\n" \
  http://localhost:5000/api/product-details/1 | jq .
```

## API Response Codes

- `200 OK`: Successful request
- `304 Not Modified`: Content hasn't changed (cache validation)
- `404 Not Found`: Product or resource doesn't exist
- `500 Internal Server Error`: Server or database error
- `503 Service Unavailable`: Redis cache unavailable (falls back to database)

## Next Steps

1. **Monitor in Production:**
   ```bash
   curl -s http://localhost:5000/api/product-details/cache-stats | jq .
   ```

2. **Set up Cache Invalidation Webhooks:**
   The admin panel should trigger cache invalidation when products are updated

3. **Track Performance Metrics:**
   - Monitor average response times
   - Track cache hit rates
   - Monitor Cloudinary bandwidth savings
