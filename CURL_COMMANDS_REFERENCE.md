# Copy-Paste Curl Commands for Testing

## Setup (Do First)

```bash
# Terminal 1: Start Backend
cd backend
python run.py
```

```bash
# Terminal 2: Stay in project root
cd .. # if needed
```

---

## Test Commands (Copy & Paste)

### 1. Get Product 1 (First Time - Cache Miss)
```bash
curl http://localhost:5000/api/product-details/1 | jq .
```

### 2. Get Product 1 Again (Cache Hit - Should be Faster)
```bash
curl http://localhost:5000/api/product-details/1 | jq .
```

### 3. Check if Cached
```bash
curl http://localhost:5000/api/product-details/1 | jq '.cache_hit'
```

### 4. See Response Time
```bash
curl -w "\nTotal time: %{time_total}s\n" -s http://localhost:5000/api/product-details/1 | jq '.data.name'
```

### 5. Get Different Product
```bash
curl http://localhost:5000/api/product-details/2 | jq '.data | {name, price, sale_price}'
```

### 6. Get Product by Slug
```bash
curl http://localhost:5000/api/product-details/slug/example-product | jq .
```

### 7. Check Cache Status
```bash
curl http://localhost:5000/api/product-details/1/cache-status | jq .
```

### 8. Time Multiple Calls
```bash
echo "Call 1:" && time curl -s http://localhost:5000/api/product-details/1 > /dev/null && \
echo "Call 2:" && time curl -s http://localhost:5000/api/product-details/1 > /dev/null && \
echo "Call 3:" && time curl -s http://localhost:5000/api/product-details/1 > /dev/null
```

### 9. Get Just Product Name
```bash
curl -s http://localhost:5000/api/product-details/1 | jq '.data.name'
```

### 10. Get All Product Names (1-5)
```bash
for i in {1..5}; do curl -s http://localhost:5000/api/product-details/$i | jq -r '.data.name'; done
```

### 11. Test Non-Existent Product
```bash
curl http://localhost:5000/api/product-details/999999 | jq .
```

### 12. View Full Product Response (Pretty Printed)
```bash
curl -s http://localhost:5000/api/product-details/1 | jq '.' | less
```

---

## What to Expect

### Working Correctly:
```
First call:  ~250ms, cache_hit: false ✓
Second call: ~45ms,  cache_hit: true  ✓
Third call:  ~40ms,  cache_hit: true  ✓
```

### Success Response:
```json
{
  "success": true,
  "cache_hit": false,
  "response_time_ms": 245,
  "data": {
    "id": 1,
    "name": "Product Name",
    "price": 9999,
    "sale_price": 7999,
    "description": "Product description",
    "in_stock": true,
    "rating": 4.5,
    "stock": 100,
    ...
  }
}
```

---

## If Something Goes Wrong

### Error: "Connection refused"
```bash
# Backend not running, start it:
cd backend && python run.py
```

### Error: "Cannot find product"
```bash
# Try different product ID:
curl http://localhost:5000/api/product-details/2
curl http://localhost:5000/api/product-details/100
```

### Cache always false
```bash
# Check Redis connection:
curl http://localhost:5000/api/product-details/1/cache-status | jq .
```

---

## One-Liner Full Test

```bash
echo "=== Product Details API Test ===" && \
echo "Test 1: First call (cache miss)" && \
curl -w "Time: %{time_total}s\n" -s http://localhost:5000/api/product-details/1 | jq '{cache_hit: .cache_hit, name: .data.name}' && \
echo "" && \
echo "Test 2: Second call (cache hit)" && \
curl -w "Time: %{time_total}s\n" -s http://localhost:5000/api/product-details/1 | jq '{cache_hit: .cache_hit, name: .data.name}' && \
echo "" && \
echo "Test 3: Different product" && \
curl -s http://localhost:5000/api/product-details/2 | jq '{id: .data.id, name: .data.name}' && \
echo "" && \
echo "All tests complete!"
```

---

## Tips

- Install `jq` for pretty JSON: `brew install jq` (macOS) or `apt-get install jq` (Linux)
- Use `-s` flag to suppress progress: `curl -s <url>`
- Use `-w` to show response time: `curl -w "Time: %{time_total}s\n"`
- Pipe to `jq` to filter JSON: `curl -s <url> | jq '.data.name'`
- Run `time` command to measure curl execution time

---

## Product IDs to Test

Replace `1` with any of these:
- `1` - Usually exists on all systems
- `2`, `3`, `4`, `5` - Common test products
- `100`, `1000` - Random IDs (may not exist)

Start with ID `1` if unsure.

---

## Performance Baseline

Typical times for a fresh API:

| Scenario | Time | Status |
|----------|------|--------|
| First call | 200-400ms | Cache miss (database) |
| 2nd call | 30-100ms | Cache hit (Redis) |
| 3rd call | 20-50ms | Cached (Redis) |
| 10th call | 15-40ms | Fully cached |

If times are much slower, check database connection.
If cache_hit stays false, check Redis connection.
