#!/bin/bash

# Test the product details API endpoint
SLUG="vitron-htc3288qs-32-inch-qled-smart-android-tv-qled-smart-tv-android-tv-q-led-black-1yr-wrty"
BACKEND_URL="https://mizizzi-ecommerce-1.onrender.com"

echo "Testing product details endpoint for slug: $SLUG"
echo "Backend: $BACKEND_URL"
echo ""

curl -X GET "$BACKEND_URL/api/product-details/by-slug/$SLUG" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -s | jq '{
    success: .success,
    hasImages: (.data.images != null),
    imagesCount: (.data.images | length),
    firstImage: .data.images[0],
    hasImageUrls: (.data.image_urls != null),
    hasThumbnail: (.data.thumbnail_url != null),
    thumbnail: .data.thumbnail_url
  }'
