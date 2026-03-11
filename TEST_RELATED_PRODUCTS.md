# Testing Backend Related Products Endpoint

## Overview
Tests for the `/api/product-details/<id>/related` endpoint that fetches related products from the same category.

## Quick Start

### Bash/Curl Test
```bash
# Make the script executable
chmod +x scripts/test_related_products.sh

# Run the test
./scripts/test_related_products.sh
```

### Python Test (Recommended - More Detailed)
```bash
# Install requests if needed
pip install requests

# Run the test
python scripts/test_related_products.py
```

## What's Being Tested

1. **Basic Request**: Fetches 12 related products for product ID 72
2. **Response Structure**: Validates the response includes:
   - `success` flag
   - `total` count
   - `related` array with products

3. **Product Data Structure**: Checks each product has:
   - `id`, `name`, `price`
   - `images` array with Cloudinary URLs
   - Fallback `thumbnail_url` and `image_urls`

4. **Image URLs**: Verifies the Cloudinary image structure:
   - `urls.large` (optimized for display)
   - `urls.original` (full quality)
   - `urls.medium` (balanced)
   - `urls.thumbnail` (thumbnail)

5. **Different Limits**: Tests with limit=5, 12, 20

## Expected Response Structure

```json
{
  "success": true,
  "total": 45,
  "related": [
    {
      "id": 73,
      "name": "Product Name",
      "price": 1000,
      "sale_price": 800,
      "images": [
        {
          "id": 1,
          "alt_text": "Product image",
          "is_primary": true,
          "display_order": 0,
          "urls": {
            "thumbnail": "https://res.cloudinary.com/...",
            "medium": "https://res.cloudinary.com/...",
            "large": "https://res.cloudinary.com/...",
            "original": "https://res.cloudinary.com/..."
          }
        }
      ],
      "thumbnail_url": "...",
      "image_urls": [...]
    }
  ]
}
```

## Troubleshooting

If tests fail:

1. **Connection refused**: Make sure backend is running on port 5000
   ```bash
   curl http://localhost:5000/api/products
   ```

2. **Product ID not found**: Change PRODUCT_ID in the test scripts to a valid ID
   - Run: `curl http://localhost:5000/api/products?limit=1` to get a valid ID

3. **Empty related array**: Product may not have similar products in same category
   - Check if product has a category assigned
   - Try with different product IDs

4. **Image URLs missing**: Backend may need to regenerate Cloudinary URLs
   - Check backend logs for serialization errors

## Frontend Integration

The frontend component (`product-details-enhanced.tsx`) now uses this endpoint:

```typescript
const response = await fetch(`/api/product-details/${product.id}/related?limit=12`)
const data = await response.json()
if (data.success && Array.isArray(data.related)) {
  setExploreProducts(data.related)
}
```

The response data flows directly to the product cards for the "Explore Your Interest" section.
