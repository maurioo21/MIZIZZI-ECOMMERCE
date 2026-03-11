# Integration Guide - Using New Product Details Component

## Quick Start

The new product details component is designed to work with the `/api/products/:id` endpoint.

### Update Your Route

**File:** `frontend/app/products/[id]/page.tsx`

```typescript
import { ProductDetails } from "@/components/products/product-details"

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params

  return (
    <main className="min-h-screen">
      <ProductDetails productId={id} />
    </main>
  )
}

// Optional: Set metadata for SEO
export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params
  // You can fetch product data here for SEO if needed
  return {
    title: "Product Details | Mizizzi",
    description: "View product details",
  }
}
```

### Or Use as Page Layout

**File:** `frontend/app/products/[id]/layout.tsx`

```typescript
import { ReactNode } from "react"

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
    </>
  )
}
```

## Endpoint Contract

The component expects `/api/products/:id` to return:

```typescript
{
  "success": true,
  "data": {
    "id": "76",
    "name": "Product Name",
    "slug": "product-slug",
    "sku": "SKU123",
    "description": "Full description...",
    "short_description": "Short desc",
    "brand": {
      "id": "1",
      "name": "Brand Name",
      "slug": "brand-slug",
      "logo_url": "https://..."
    },
    "category": {
      "id": "5",
      "name": "Category Name",
      "slug": "category-slug",
      "parent_id": null
    },
    "pricing": {
      "original_price": 100,
      "current_price": 75,
      "sale_price": 75,
      "discount_percentage": 25
    },
    "stock": {
      "quantity": 28,
      "is_in_stock": true,
      "is_low_stock": false,
      "stock_status": "in_stock",
      "last_updated": "2024-03-11T10:00:00Z"
    },
    "ratings": {
      "average": 4.5,
      "total_reviews": 120,
      "distribution": {
        "five": 80,
        "four": 30,
        "three": 8,
        "two": 2,
        "one": 0
      }
    },
    "images": [
      {
        "id": "img-1",
        "product_id": "76",
        "filename": "product-1.jpg",
        "is_primary": true,
        "sort_order": 0,
        "urls": {
          "thumbnail": "https://cdn/.../thumb.jpg",
          "medium": "https://cdn/.../medium.jpg",
          "large": "https://cdn/.../large.jpg",
          "original": "https://cdn/.../original.jpg"
        },
        "created_at": "2024-03-11T10:00:00Z",
        "updated_at": "2024-03-11T10:00:00Z"
      }
    ],
    "variants": [
      {
        "id": "var-1",
        "product_id": "76",
        "name": "Red - Size M",
        "sku": "SKU-RED-M",
        "color": "Red",
        "size": "M",
        "price": 75,
        "stock": 10,
        "is_available": true,
        "created_at": "2024-03-11T10:00:00Z",
        "updated_at": "2024-03-11T10:00:00Z"
      }
    ],
    "reviews": [
      {
        "id": "rev-1",
        "product_id": "76",
        "user_id": "user-1",
        "user_name": "John Doe",
        "rating": 5,
        "title": "Excellent product",
        "content": "Very satisfied with this purchase",
        "verified_purchase": true,
        "helpful_count": 10,
        "created_at": "2024-03-11T10:00:00Z",
        "updated_at": "2024-03-11T10:00:00Z"
      }
    ],
    "timestamps": {
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-03-11T10:00:00Z",
      "published_at": "2024-01-15T10:00:00Z"
    },
    "is_featured": true,
    "is_new": false,
    "is_sale": true,
    "is_flash_sale": false,
    "is_luxury_deal": false,
    "is_trending": true,
    "is_top_pick": true,
    "is_daily_find": false,
    "is_new_arrival": false,
    "badge_text": "Best Seller",
    "badge_color": "#FF6B6B",
    "specifications": {
      "weight": "250g",
      "dimensions": "10x10x5cm"
    },
    "warranty_info": "1 year warranty",
    "shipping_info": "Ships within 2-3 business days",
    "weight": 0.25,
    "dimensions": {
      "length": 10,
      "width": 10,
      "height": 5
    },
    "video_url": null,
    "condition": "new",
    "is_preorder": false,
    "preorder_release_date": null,
    "preorder_message": null
  }
}
```

## Environment Variables Required

```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Component Props

```typescript
interface ProductDetailsProps {
  productId: string | number
}
```

**Usage:**
```typescript
<ProductDetails productId={id} />
```

## What's Included

✓ Product image gallery with thumbnails  
✓ Pricing with discount display  
✓ Stock availability status  
✓ Star rating and review count  
✓ Variant selection dropdown  
✓ Quantity selector (+/-)  
✓ Add to cart button  
✓ Wishlist toggle  
✓ WhatsApp share button  
✓ Native share button  
✓ Delivery info  
✓ Returns policy  
✓ Payment security badge  
✓ Full product description  
✓ Mobile responsive  
✓ Loading states  
✓ Error handling  

## What's NOT Included (by design)

✗ Comments/Q&A section (separate component)  
✗ Similar products carousel (separate component)  
✗ User reviews section (separate component)  
✗ Ratings histogram (use reviews data)  
✗ Related products (separate component)  
✗ Size/color swatches beyond variant selector  

These can be added as separate components above/below ProductDetails.

## Styling

The component uses:
- Tailwind CSS for styling
- shadcn/ui utilities
- Lucide React icons
- Framer Motion for animations
- Next.js Image component

Default styling includes:
- Brand color (#8B1538) for primary actions
- Responsive grid layout
- Mobile-first design
- Smooth animations

## Customization

### Change Brand Color
Find this in the component:
```typescript
const BRAND_COLOR = "#8B1538"
```

Change to your brand color.

### Disable Animations
Remove Framer Motion motion components and use plain divs.

### Change Cart Context
If using different cart context, update import:
```typescript
import { useCart } from "@/your/custom/cart-context"
```

### Custom Share Message
Modify `handleWhatsApp()`:
```typescript
const message = `Custom message about ${product.name}`
```

## Testing

### Manual Tests
1. Navigate to `/products/76`
2. Verify product loads with all details
3. Test quantity selector (min 1, max = stock)
4. Test add to cart
5. Test wishlist toggle
6. Test WhatsApp button
7. Test share button
8. Test gallery navigation
9. Resize window for mobile
10. Test with missing product (/products/invalid-id)

### Automated Tests
```typescript
import { render, screen, fireEvent } from "@testing-library/react"
import { ProductDetails } from "./product-details"

describe("ProductDetails", () => {
  it("renders product details", async () => {
    render(<ProductDetails productId="76" />)
    expect(await screen.findByRole("heading")).toBeInTheDocument()
  })
})
```

## Troubleshooting

**Q: Images not loading**  
A: Check `/api/products/:id` returns valid image URLs in `images[].urls`

**Q: Prices showing as 0**  
A: Verify backend returns `pricing.current_price` and `pricing.original_price`

**Q: Stock showing as out of stock**  
A: Check `stock.quantity > 0` and `stock.is_in_stock` flag

**Q: Cart button disabled**  
A: Product is out of stock (inStock = false) or loading

**Q: Variant selector empty**  
A: Backend didn't return `variants` array or it's empty

**Q: WhatsApp not working**  
A: Check window.location.href includes correct product URL

## Related Documentation

- Backend API: See `/backend/routes/products/...`
- Types: See `/frontend/types/product-details.ts`
- Service: See `/frontend/services/product.ts`
- Types: See `/frontend/types/index.ts`
