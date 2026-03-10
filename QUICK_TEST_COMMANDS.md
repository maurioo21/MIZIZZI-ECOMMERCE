# Quick Test Commands - Copy & Paste Ready

## Pre-Flight Checks

```bash
# Check backend
curl http://localhost:5000/health

# Check Redis
redis-cli PING

# Show databases
redis-cli INFO stats
```

## Test Commands (Use These!)

### 1. Get Product by ID
```bash
curl "http://localhost:5000/api/product-details/1" | jq .
```

### 2. Get Product by Slug
```bash
curl "http://localhost:5000/api/product-details/slug/your-product-slug" | jq .
```

### 3. Check Cache
```bash
curl "http://localhost:5000/api/product-details/1/cache-status" | jq .
```

### 4. Performance Test - First Call
```bash
curl -w "Time: %{time_total}s\n" -o /dev/null -s "http://localhost:5000/api/product-details/1"
```

### 5. Performance Test - Second Call (Should be faster)
```bash
curl -w "Time: %{time_total}s\n" -o /dev/null -s "http://localhost:5000/api/product-details/1"
```

### 6. Test Multiple Products
```bash
for i in 1 2 3 4 5; do
  echo "Product $i:"
  curl -s "http://localhost:5000/api/product-details/$i" | jq '.data.name, .cache_hit, .response_time_ms'
done
```

### 7. Cache All Products
```bash
for i in {1..20}; do
  curl -s "http://localhost:5000/api/product-details/$i" > /dev/null
done
echo "Cached products:"
redis-cli KEYS "product:*" | wc -l
```

### 8. Invalidate Cache (Admin)
```bash
curl -X POST "http://localhost:5000/api/product-details/1/invalidate-cache" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 9. Full Test Suite
```bash
bash test_product_api.sh
```

## Expected Behavior

| Call | cache_hit | response_time_ms | Status |
|------|-----------|-----------------|--------|
| 1st | false | 150-300 | DB fetch |
| 2nd | true | 20-60 | Redis |
| 3rd | true | 15-50 | Redis |
| After 10min | false | 150-300 | TTL expired |

## Extract Specific Fields

```bash
# Just the product name
curl -s "http://localhost:5000/api/product-details/1" | jq '.data.name'

# Price and sale price
curl -s "http://localhost:5000/api/product-details/1" | jq '.data | {price, sale_price}'

# Reviews
curl -s "http://localhost:5000/api/product-details/1" | jq '.data.reviews'

# Related products
curl -s "http://localhost:5000/api/product-details/1" | jq '.data.related_products'

# Cache info
curl -s "http://localhost:5000/api/product-details/1" | jq '{cache_hit, response_time_ms}'
```

## Redis Inspection

```bash
# List all cached products
redis-cli KEYS "product:*"

# Get cached product JSON
redis-cli GET "product:1"

# Check cache TTL
redis-cli TTL "product:1"

# Clear all cache
redis-cli FLUSHDB

# Monitor cache in real-time
redis-cli MONITOR
```

## Start Services

```bash
# Terminal 1: Backend
cd backend
python -m flask run

# Terminal 2: Redis
redis-server

# Terminal 3: Testing
bash test_product_api.sh
```

## Save These as Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias test-prod-api='curl -s "http://localhost:5000/api/product-details/1" | jq .'
alias test-cache='curl -s "http://localhost:5000/api/product-details/1/cache-status" | jq .'
alias test-perf='for i in 1 2 3; do echo "Call $i:"; curl -w "Time: %{time_total}s\n" -o /dev/null -s "http://localhost:5000/api/product-details/1"; done'
alias redis-keys='redis-cli KEYS "product:*" | wc -l'
```

Then use:
```bash
test-prod-api
test-cache
test-perf
redis-keys
```

## Troubleshooting

```bash
# Backend not responding?
curl -v http://localhost:5000/health

# Redis not connected?
redis-cli PING

# Wrong port?
netstat -tuln | grep 5000

# Check backend logs
# Look in the terminal where you started Flask
```

## Files Reference

- `TESTING_LOCALHOST.md` - Full testing guide
- `CURL_TESTING_GUIDE.md` - Detailed curl commands
- `test_product_api.sh` - Automated test script
- `HOW_IT_WORKS.md` - System explanation
- `QUICK_START.md` - 5-minute setup
