# Product Details Component - Usage Examples

## Basic Usage

```typescript
// File: app/products/[id]/page.tsx
import { ProductDetails } from "@/components/products/product-details"

export default async function ProductPage({ params }) {
  const { id } = await params
  
  return (
    <main className="min-h-screen bg-white">
      <header className="py-4 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold">Product Details</h1>
        </div>
      </header>
      
      <ProductDetails productId={id} />
      
      <footer className="py-4 border-t mt-12">
        <p className="text-center text-gray-600">© 2024 Mizizzi</p>
      </footer>
    </main>
  )
}
```

## With Metadata

```typescript
import { ProductDetails } from "@/components/products/product-details"
import { productService } from "@/services/product"

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params
  
  // Fetch product for SEO metadata
  const product = await productService.getProductDetails(id)
  
  if (!product) {
    return {
      title: "Product Not Found",
      description: "The product you're looking for doesn't exist",
    }
  }
  
  return {
    title: `${product.name} | Mizizzi Store`,
    description: product.short_description || product.description?.substring(0, 160),
    keywords: [product.name, product.category?.name, product.brand?.name].filter(Boolean),
    openGraph: {
      title: product.name,
      description: product.short_description || product.name,
      type: "product",
      url: `https://mizizzi.com/products/${id}`,
      images: product.images[0]?.urls?.large
        ? [{ url: product.images[0].urls.large }]
        : [],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params
  
  return (
    <main>
      <ProductDetails productId={id} />
    </main>
  )
}
```

## With Related Products Section

```typescript
import { ProductDetails } from "@/components/products/product-details"
import { RelatedProducts } from "@/components/products/related-products"

export default async function ProductPage({ params }) {
  const { id } = await params
  
  return (
    <main>
      <ProductDetails productId={id} />
      
      {/* Add related products section below */}
      <section className="py-12 border-t">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8">Related Products</h2>
          <RelatedProducts productId={id} />
        </div>
      </section>
    </main>
  )
}
```

## With Reviews Section

```typescript
import { ProductDetails } from "@/components/products/product-details"
import { ReviewSection } from "@/components/reviews/review-section"

export default async function ProductPage({ params }) {
  const { id } = await params
  
  return (
    <main>
      <ProductDetails productId={id} />
      
      {/* Add reviews section below */}
      <section className="py-12 border-t">
        <div className="max-w-7xl mx-auto px-4">
          <ReviewSection productId={id} />
        </div>
      </section>
    </main>
  )
}
```

## Accessing Product Data Directly (Advanced)

```typescript
import { productService } from "@/services/product"
import {
  getProductDisplayPrice,
  getProductDiscount,
  isProductInStock,
} from "@/types/product-details"

// In a server component or API route
async function getProductInfo(id: string) {
  const product = await productService.getProductDetails(id)
  
  if (!product) {
    return null
  }
  
  return {
    name: product.name,
    price: getProductDisplayPrice(product),
    discount: getProductDiscount(product),
    inStock: isProductInStock(product),
    variants: product.variants?.length || 0,
    reviews: product.ratings?.total_reviews || 0,
  }
}
```

## With Breadcrumbs

```typescript
import { ProductDetails } from "@/components/products/product-details"
import Link from "next/link"

export default async function ProductPage({ params }) {
  const { id } = await params
  
  return (
    <main>
      {/* Breadcrumbs */}
      <nav className="py-3 px-4 bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto flex gap-2 text-sm">
          <Link href="/" className="text-blue-600 hover:underline">
            Home
          </Link>
          <span className="text-gray-400">/</span>
          <Link href="/products" className="text-blue-600 hover:underline">
            Products
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Product Details</span>
        </div>
      </nav>
      
      <ProductDetails productId={id} />
    </main>
  )
}
```

## Conditional Rendering Based on Availability

```typescript
import { ProductDetails } from "@/components/products/product-details"
import { productService } from "@/services/product"

export default async function ProductPage({ params }) {
  const { id } = await params
  const product = await productService.getProductDetails(id)
  
  if (!product) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
        <p className="text-gray-600 mb-8">
          The product you're looking for doesn't exist
        </p>
        <a href="/products" className="text-blue-600 hover:underline">
          Browse all products
        </a>
      </main>
    )
  }
  
  return (
    <main>
      <ProductDetails productId={id} />
      
      {product.is_new && (
        <div className="bg-blue-50 py-4 border-b text-center">
          <span className="text-blue-700 font-semibold">✨ New Product - Just Added!</span>
        </div>
      )}
      
      {product.is_flash_sale && (
        <div className="bg-red-50 py-4 border-b text-center">
          <span className="text-red-700 font-semibold">⚡ Flash Sale Active!</span>
        </div>
      )}
    </main>
  )
}
```

## Using with Different ID Formats

```typescript
import { ProductDetails } from "@/components/products/product-details"

// Works with both string and number IDs
export default async function ProductPage({ params }) {
  const { id } = await params
  
  // All these work:
  return <ProductDetails productId={id} />           // String "76"
  return <ProductDetails productId={76} />           // Number 76
  return <ProductDetails productId={parseInt(id)} /> // Parsed number
}
```

## Error Boundary Wrapper

```typescript
import { ProductDetails } from "@/components/products/product-details"
import { ErrorBoundary } from "@/components/error-boundary"

export default async function ProductPage({ params }) {
  const { id } = await params
  
  return (
    <ErrorBoundary fallback={<ProductError />}>
      <ProductDetails productId={id} />
    </ErrorBoundary>
  )
}

function ProductError() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="text-gray-600 mb-8">
        We encountered an error loading the product
      </p>
      <a href="/products" className="text-blue-600 hover:underline">
        Back to products
      </a>
    </div>
  )
}
```

## In a Dynamic Segment with Catch-All

```typescript
import { ProductDetails } from "@/components/products/product-details"

// For route: /p/[...slug] where slug could be ["name-76"] or ["76"]
export default async function ProductPage({ params }) {
  const { slug } = await params
  
  // Extract ID from slug
  const id = slug?.[slug.length - 1] // Get last segment, usually the ID
  
  if (!id) {
    return <div>Invalid product URL</div>
  }
  
  return <ProductDetails productId={id} />
}
```

## Server Component with Client Component

```typescript
// Page Server Component
import { ProductDetailsWrapper } from "@/components/products/product-details-wrapper"

export default async function ProductPage({ params }) {
  const { id } = await params
  
  // Fetch product metadata server-side for performance
  const metadata = await fetchProductMetadata(id)
  
  return (
    <main>
      {/* Pass metadata to client component if needed */}
      <ProductDetailsWrapper productId={id} initialMetadata={metadata} />
    </main>
  )
}

// Client Component Wrapper
"use client"
import { ProductDetails } from "@/components/products/product-details"

export function ProductDetailsWrapper({ productId, initialMetadata }) {
  return <ProductDetails productId={productId} />
}
```

## With Analytics Tracking

```typescript
import { ProductDetails } from "@/components/products/product-details"
import { trackPageView } from "@/lib/analytics"

export default async function ProductPage({ params }) {
  const { id } = await params
  
  // Track page view server-side
  await trackPageView({
    page: "product_details",
    product_id: id,
    timestamp: new Date(),
  })
  
  return (
    <main>
      <ProductDetails productId={id} />
    </main>
  )
}
```

## Common Patterns

### 1. Force Cache Refresh
```typescript
// In a server action or API route
import { productService } from "@/services/product"

export async function refreshProductCache(id: string) {
  // Bypass cache and fetch fresh data
  const product = await productService.getProductDetails(id, {
    forceRefresh: true,
  })
  return product
}
```

### 2. Preload Product Data
```typescript
import { productService } from "@/services/product"
import { ReactNode } from "react"

export async function ProductPageLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { id: string }
}) {
  // Preload the product data
  // This ensures data is fetched as early as possible
  await productService.getProductDetails(params.id)
  
  return children
}
```

### 3. Cache Status Badge
```typescript
import { productService } from "@/services/product"

export async function ProductWithCacheInfo({ id }) {
  const startTime = Date.now()
  const product = await productService.getProductDetails(id)
  const fetchTime = Date.now() - startTime
  
  const cacheStatus = fetchTime < 50 ? "cached" : "fresh"
  
  return (
    <div>
      <ProductDetails productId={id} />
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-500 mt-4">
          Fetch time: {fetchTime}ms ({cacheStatus})
        </div>
      )}
    </div>
  )
}
```

### 4. Conditional Features Based on Product Type
```typescript
import { ProductDetails } from "@/components/products/product-details"
import { productService } from "@/services/product"

export default async function ProductPage({ params }) {
  const { id } = await params
  const product = await productService.getProductDetails(id)
  
  return (
    <main>
      <ProductDetails productId={id} />
      
      {product?.is_preorder && (
        <div className="mt-8 p-4 bg-amber-50 rounded-lg">
          <h3 className="font-semibold mb-2">Pre-Order Information</h3>
          <p className="text-sm text-gray-700">
            This is a pre-order item. Expected release: {product.preorder_release_date}
          </p>
        </div>
      )}
      
      {product?.is_flash_sale && (
        <div className="mt-8 p-4 bg-red-50 rounded-lg">
          <h3 className="font-semibold mb-2">Flash Sale Active!</h3>
          <p className="text-sm text-gray-700">
            Limited time offer. Get {product.pricing?.discount_percentage}% off now!
          </p>
        </div>
      )}
    </main>
  )
}
```

---

## Tips & Best Practices

1. **Always provide productId** - Component requires it
2. **Use with metadata generation** - Include SEO metadata for better rankings
3. **Add breadcrumbs** - Help users understand navigation
4. **Include related products** - Increase cross-selling
5. **Add reviews section** - Build trust with social proof
6. **Handle 404s gracefully** - Provide navigation back
7. **Use error boundaries** - Catch unexpected errors
8. **Track analytics** - Monitor product page performance
9. **Test mobile** - Most users browse products on mobile
10. **Cache wisely** - 5-minute cache is good for most cases

---

## Troubleshooting Examples

### Product Shows as Loading Forever
```typescript
// Check if productId is being passed correctly
<ProductDetails productId={id} /> // Good
<ProductDetails productId={undefined} /> // Bad - will show error

// Verify id is string or number
console.log(typeof id) // Should be "string" or "number"
```

### Images Not Loading
```typescript
// Make sure backend returns full URLs in images[].urls.large
// Check network tab in DevTools
// Verify CORS headers if loading from external domain
```

### Cart Button Always Disabled
```typescript
// Check backend returns stock.is_in_stock: true
// Verify stock.quantity > 0
// Check product loaded (not still loading)
```

---

That covers all common usage patterns! Start with the **Basic Usage** section and add features as needed.
