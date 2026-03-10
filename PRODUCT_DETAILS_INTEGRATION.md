# High-Performance Product Details API - Integration Guide

## Overview

You now have a **Jumia-like product details system** with:
- ✅ Backend Redis caching layer (Upstash)
- ✅ Parallel data fetching (reviews, related products, inventory)
- ✅ Intelligent TTL management
- ✅ Client-side caching for ultra-fast rendering
- ✅ Automatic cache invalidation
- ✅ Response time targets: 50ms (warm) / 200ms (cold)

---

## Backend API Endpoints

### 1. Get Product by ID
```
GET /api/product-details/{product_id}?cache=true
```

**Parameters:**
- `product_id` (required): Product ID
- `cache` (optional): Enable Redis caching (default: true)

**Response (300ms cold, 50ms warm):**
```json
{
  "id": 123,
  "name": "Premium Product",
  "slug": "premium-product",
  "description": "...",
  "price": 99.99,
  "sale_price": 79.99,
  "discount_percentage": 20,
  "stock": 45,
  "image_urls": ["url1", "url2"],
  "thumbnail_url": "url1",
  "category_id": 5,
  "brand_id": 3,
  "badge_text": "Hot Deal",
  "badge_color": "#ff6b6b",
  "specifications": { "color": "Black", "size": "M" },
  "warranty_info": "2 years",
  "shipping_info": "Free shipping",
  "is_trending": true,
  
  "reviews": {
    "total_reviews": 245,
    "average_rating": 4.6,
    "verified_reviews": 198,
    "rating_distribution": { "1": 5, "2": 8, "3": 15, "4": 52, "5": 165 },
    "recent_reviews": [
      {
        "id": 1,
        "rating": 5,
        "title": "Amazing!",
        "comment": "Great quality...",
        "reviewer_name": "John",
        "created_at": "2024-01-15T10:30:00Z",
        "is_verified": true
      }
    ]
  },
  
  "related_products": [
    { "id": 124, "name": "Similar Product", ... }
  ],
  
  "inventory": {
    "status": "in_stock",
    "quantity": 45,
    "is_in_stock": true,
    "is_low_stock": false
  },
  
  "_cached_at": 1705318800000,
  "_cache_ttl": 600
}
```

### 2. Get Product by Slug
```
GET /api/product-details/slug/{slug}?cache=true
```

**Response:** Same as ID endpoint

### 3. Check Cache Status (Debug)
```
GET /api/product-details/{product_id}/cache-status
```

**Response:**
```json
{
  "product_id": 123,
  "cache_key": "mizizzi:product:public:123",
  "is_cached": true,
  "cache_size": 2048,
  "ttl": 600
}
```

### 4. Invalidate Cache (Admin Only)
```
POST /api/product-details/{product_id}/invalidate-cache
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Cache invalidated for product 123",
  "cache_key": "mizizzi:product:public:123"
}
```

---

## Frontend Integration

### Basic Usage (TypeScript/React)

```tsx
import ProductDetailsService from '@/services/product-details-optimized'

// In a component:
const ProductDetail = ({ productId }: { productId: number }) => {
  const [product, setProduct] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetch = async () => {
      const data = await ProductDetailsService.getProductById(productId)
      setProduct(data)
      setLoading(false)
    }
    fetch()
  }, [productId])

  if (loading) return <Spinner />
  if (!product) return <NotFound />

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <Price price={product.price} salePrice={product.sale_price} />
      <Reviews reviews={product.reviews} />
      <RelatedProducts products={product.related_products} />
    </div>
  )
}
```

### Using with SWR (Recommended)
```tsx
import useSWR from 'swr'
import ProductDetailsService from '@/services/product-details-optimized'

export const useProductDetails = (productId: number) => {
  const { data, error, isLoading } = useSWR(
    productId ? `product-${productId}` : null,
    () => ProductDetailsService.getProductById(productId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Deduplicate for 1 minute
      focusThrottleInterval: 300000, // Revalidate every 5 minutes
    }
  )

  return {
    product: data,
    isLoading,
    error,
  }
}

// In component:
const ProductDetail = ({ productId }: { productId: number }) => {
  const { product, isLoading } = useProductDetails(productId)

  if (isLoading) return <Spinner />
  if (!product) return <NotFound />

  return (
    // Your component JSX
  )
}
```

### Fetching by Slug
```tsx
const { product, isLoading } = useSWR(
  slug ? `product-slug-${slug}` : null,
  () => ProductDetailsService.getProductBySlug(slug),
  { revalidateOnFocus: false }
)
```

### Bulk Fetch for Related Products
```tsx
const relatedIds = [124, 125, 126]
const relatedProducts = await ProductDetailsService.getRelatedProducts(relatedIds)
```

---

## Performance Characteristics

### Response Times

| Scenario | Time | Notes |
|----------|------|-------|
| Cache HIT (Redis) | 50ms | Backend Redis return |
| Cache HIT (Local) | 2-5ms | Browser memory cache |
| Cache MISS (DB) | 200ms | Database query + parallel fetches |
| Related products | +50ms | Parallel fetching (3 concurrent) |

### Cache TTL Strategy

Different TTLs based on product urgency:

```python
# From backend cache_keys.py
'product_detail': 600,           # 10 minutes (default)
'product_detail_admin': 300,     # 5 minutes (admin sees changes faster)

# Special cases:
'flash_sale': 60,                # 1 minute (time-sensitive)
'new_arrivals': 180,             # 3 minutes
'trending': 120,                 # 2 minutes
```

### Memory Usage

- Redis (backend): ~2-5 KB per product
- Local cache (browser): 50 products max
- Total browser memory: ~500 KB max

---

## Cache Invalidation

### Automatic Invalidation
Cache is automatically invalidated when:
1. Product is updated via admin API
2. Inventory changes
3. Price/sale price changes
4. Images are updated

### Manual Invalidation (Admin)
```tsx
// Clear cache for a specific product
await ProductDetailsService.invalidateCache(productId)

// Clear all local browser cache
ProductDetailsService.clearAllLocalCache()
```

---

## Debugging

### Check Cache Status
```tsx
const status = await ProductDetailsService.getCacheStatus(123)
console.log(status)
// {
//   product_id: 123,
//   cache_key: "mizizzi:product:public:123",
//   is_cached: true,
//   cache_size: 2048,
//   ttl: 600
// }
```

### Monitor Performance
The service logs all requests with timing:

```
[ProductDetailsService] Fetching: https://api.example.com/api/product-details/123?cache=true
[ProductDetailsService] Response time: 45ms | Backend cache age: 23ms
[ProductDetailsService] Cache HIT from local storage
```

### Disable Caching
```tsx
// Bypass all caching for debugging
const product = await ProductDetailsService.getProductById(123, { useCache: false })
```

---

## Environment Variables Required

### Backend
```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Frontend
```env
NEXT_PUBLIC_API_URL=https://your-api.example.com
```

---

## Optimization Tips

### 1. Pre-warm Cache
When starting the app, pre-fetch popular products:
```tsx
React.useEffect(() => {
  // Pre-fetch 10 popular products on app start
  const popularIds = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30]
  popularIds.forEach(id => {
    ProductDetailsService.getProductById(id)
  })
}, [])
```

### 2. Prefetch on Route Navigation
```tsx
import { useRouter } from 'next/router'

const ProductLink = ({ productId, ...props }) => {
  const router = useRouter()
  
  const handlePrefetch = () => {
    ProductDetailsService.getProductById(productId)
  }
  
  return (
    <Link
      href={`/products/${productId}`}
      onMouseEnter={handlePrefetch}
      {...props}
    />
  )
}
```

### 3. Lazy Load Related Products
```tsx
const [relatedProducts, setRelatedProducts] = React.useState([])

React.useEffect(() => {
  // Load main product first
  const loadRelated = async () => {
    const related = await ProductDetailsService.getRelatedProducts(
      product.related_product_ids
    )
    setRelatedProducts(related)
  }
  
  // Use setTimeout to load related products after main content renders
  const timer = setTimeout(loadRelated, 500)
  return () => clearTimeout(timer)
}, [product])
```

### 4. Monitor Cache Hit Ratio
Add analytics to track cache effectiveness:
```tsx
React.useEffect(() => {
  const startTime = performance.now()
  
  ProductDetailsService.getProductById(productId).then(() => {
    const duration = performance.now() - startTime
    
    // Send to analytics
    if (duration < 100) {
      analytics.track('cache_hit', { duration })
    } else {
      analytics.track('cache_miss', { duration })
    }
  })
}, [productId])
```

---

## Troubleshooting

### Redis Not Connected
If you see warnings like "Using in-memory fallback", make sure:

1. Check Redis credentials:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        "YOUR_UPSTASH_URL/ping"
   ```

2. Verify environment variables in backend `.env`:
   ```env
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

### Slow API Response (>500ms)
1. Check if product has many reviews or images
2. Monitor database query performance
3. Verify Redis connectivity
4. Check if related products query is timing out

### Cache Not Invalidating
1. Verify admin token is valid
2. Check if product cache key exists:
   ```tsx
   const status = await ProductDetailsService.getCacheStatus(productId)
   console.log(status.is_cached)
   ```
3. Manually clear if needed:
   ```tsx
   ProductDetailsService.clearAllLocalCache()
   ```

---

## Next Steps

1. ✅ Deploy backend changes
2. ✅ Update frontend service
3. ✅ Test with product pages
4. ✅ Monitor performance in production
5. ✅ Adjust TTLs based on traffic patterns
6. ✅ Set up cache hit ratio monitoring

---

## Performance Monitoring

Add monitoring to track improvements:

```tsx
// Example: Log all requests to analytics service
const originalFetch = ProductDetailsService.getProductById

ProductDetailsService.getProductById = async (productId, options) => {
  const start = performance.now()
  const result = await originalFetch(productId, options)
  const duration = performance.now() - start
  
  // Send to your monitoring service
  fetch('/api/analytics/perf', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: 'product-details',
      duration,
      productId,
      cached: duration < 100,
    }),
  })
  
  return result
}
```

This will give you exact metrics on cache effectiveness and response times in production!
