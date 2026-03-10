# Product Image Hover Implementation Guide

## Overview
ProductCard component has been enhanced with smooth image hovering across all homepage sections (Flash Sales, Luxury Deals, Top Picks, Trending, Daily Deals, Featured Products, All Products).

## How It Works

### Desktop Behavior
1. **Primary Image**: Displays by default (opacity: 1)
2. **On Hover**: Secondary image fades in with smooth 500ms transition (opacity: 1)
3. **Image Count**: Shows "1/X" or "2/X" indicator on hover (e.g., "1/3", "2/3")
4. **Scale Animation**: Subtle zoom effect (scale-105) on both images during hover
5. **No Layout Shift**: Card size and aspect ratio remain constant

### Mobile Behavior
- No hover effects (first image always visible)
- Image count indicator hidden on mobile for clean UX
- Touch interactions not affected

## Technical Implementation

### Key Features
- **Overlaid Images**: Secondary image positioned absolutely over primary, opacity-based fade
- **Smooth Transitions**: 500ms duration with ease-in-out timing
- **Image Preloading**: Secondary images preload on mount to reduce lag
- **Fallback Handling**: Shows primary image if secondary doesn't exist
- **No Code Duplication**: Single ProductCard component used everywhere

### Product Data Requirements
For image hover to work, products need `image_urls` array with multiple items:
```json
{
  "id": 1,
  "name": "Product Name",
  "image_urls": [
    "https://example.com/image1.jpg",  // Primary image
    "https://example.com/image2.jpg",  // Secondary image (shown on hover)
    "https://example.com/image3.jpg"   // Additional images (not used in hover)
  ],
  "thumbnail_url": "..." // Fallback if image_urls empty
}
```

## Testing Image Hover

### Step 1: Add Multiple Images to Products
Edit a product via admin panel and upload multiple images:
1. Go to `/admin/products/{id}/edit`
2. Upload 2 or more images
3. Both images should appear in the product card on homepage

### Step 2: Verify in Browser
1. Load homepage
2. Hover over a product card with 2+ images
3. You should see:
   - Smooth fade transition from image 1 to image 2
   - Image count indicator: "2/2" or "2/3"
   - Subtle zoom effect on both images

### Step 3: Test Across Sections
The implementation works in all these homepage sections:
- Flash Sales (`FlashSalesClient`)
- Luxury Deals (`LuxuryDealsClient`)
- Top Picks (`TopPicksClient`)
- Trending (`TrendingProducts`)
- Daily Deals/Finds
- Featured Products
- All Products grid

## Troubleshooting

### Issue: Hover effect not appearing
**Solution**: Product likely has only 1 image in `image_urls` array. Add a second image via admin panel.

### Issue: Images not loading
**Solution**: Check that image URLs are valid and accessible:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Check if image requests are 200 OK
4. Verify URLs return actual images (not 404s)

### Issue: Hover effect stutters
**Solution**: Images are preloading asynchronously. First hover might be slower. Subsequent hovers are smooth.

## Customization Options

### To disable hover on certain products:
Modify ProductCard to accept an optional `disableImageHover` prop

### To change transition speed:
Update the `duration-500` class to:
- `duration-300` for faster
- `duration-700` for slower

### To disable image count indicator:
Comment out the "Image Count Indicator" section in ProductCard

## Files Modified
- `/frontend/components/products/product-card.tsx` - Main component with image hover logic

## Performance Notes
- Uses Next.js Image component for optimization
- Lazy loads secondary images (not priority)
- Preloads secondary images on mount to reduce hover lag
- No impact on Core Web Vitals (smooth transitions use GPU acceleration)
- Mobile devices completely bypass hover logic for better performance
