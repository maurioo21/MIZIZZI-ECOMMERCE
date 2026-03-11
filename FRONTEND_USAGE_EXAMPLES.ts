import type { ProductDetails } from "@/types/product-details"
import { productService } from "@/services/product"
import { formatPrice } from "@/lib/utils"

/**
 * USAGE EXAMPLES - How to use the new ProductDetails endpoint
 * 
 * File: FRONTEND_USAGE_EXAMPLES.ts
 * This shows real-world examples of using the new backend integration
 */

// ============================================================================
// EXAMPLE 1: Fetch product details in a page
// ============================================================================

export async function getProductDetailsPage(productId: string) {
  try {
    // Fetch using the new typed service method
    const productDetails = await productService.getProductDetails(productId)

    if (!productDetails) {
      return { error: "Product not found", statusCode: 404 }
    }

    return {
      product: productDetails,
      statusCode: 200,
    }
  } catch (error) {
    console.error("Error fetching product details:", error)
    return { error: "Failed to load product", statusCode: 500 }
  }
}

// ============================================================================
// EXAMPLE 2: Display pricing information
// ============================================================================

export function renderPricingSection(product: ProductDetails): {
  currentPrice: string
  originalPrice: string | null
  discountPercentage: number
  shouldShowDiscount: boolean
} {
  const { pricing } = product

  const shouldShowDiscount =
    pricing.discount_percentage > 0 &&
    pricing.original_price > pricing.current_price

  return {
    currentPrice: formatPrice(pricing.current_price, pricing.currency),
    originalPrice: shouldShowDiscount
      ? formatPrice(pricing.original_price, pricing.currency)
      : null,
    discountPercentage: pricing.discount_percentage,
    shouldShowDiscount,
  }
}

// Usage in component:
// const pricing = renderPricingSection(product)
// <p>{pricing.currentPrice}</p>
// {pricing.shouldShowDiscount && (
//   <p className="line-through">{pricing.originalPrice}</p>
//   <span className="badge">{pricing.discountPercentage}% OFF</span>
// )}

// ============================================================================
// EXAMPLE 3: Display stock information
// ============================================================================

export function renderStockSection(product: ProductDetails): {
  isInStock: boolean
  stockMessage: string
  canAddToCart: boolean
  stockColor: string
} {
  const { stock } = product
  const inStock = stock.is_in_stock && stock.quantity > 0

  let stockMessage = "Out of stock"
  let stockColor = "error"

  if (inStock) {
    if (stock.quantity > 10) {
      stockMessage = `${stock.quantity} in stock`
      stockColor = "success"
    } else if (stock.quantity > 0) {
      stockMessage = `Only ${stock.quantity} left`
      stockColor = "warning"
    }
  }

  return {
    isInStock: inStock,
    stockMessage,
    canAddToCart: inStock,
    stockColor,
  }
}

// ============================================================================
// EXAMPLE 4: Extract image URLs for gallery
// ============================================================================

export function extractGalleryImages(product: ProductDetails): {
  thumbnails: string[]
  mainImages: string[]
  zoomImages: string[]
  primaryImage: string
} {
  const { images } = product

  if (!Array.isArray(images) || images.length === 0) {
    return {
      thumbnails: ["/generic-product-display.png"],
      mainImages: ["/generic-product-display.png"],
      zoomImages: ["/generic-product-display.png"],
      primaryImage: "/generic-product-display.png",
    }
  }

  const primaryImage =
    images.find((img) => img.is_primary)?.urls.large ||
    images[0]?.urls.large ||
    "/generic-product-display.png"

  return {
    thumbnails: images.map((img) => img.urls.thumbnail),
    mainImages: images.map((img) => img.urls.large),
    zoomImages: images.map((img) => img.urls.original),
    primaryImage,
  }
}

// ============================================================================
// EXAMPLE 5: Handle ratings and reviews
// ============================================================================

export function renderRatingsSection(product: ProductDetails): {
  averageRating: number
  totalReviews: number
  distribution: Record<string, number>
  hasReviews: boolean
} {
  const { ratings } = product

  return {
    averageRating: ratings.average || 0,
    totalReviews: ratings.total_reviews,
    distribution: ratings.distribution,
    hasReviews: ratings.total_reviews > 0,
  }
}

// ============================================================================
// EXAMPLE 6: Prepare data for cart
// ============================================================================

export function prepareCartItem(
  product: ProductDetails,
  quantity: number,
  selectedVariantId?: number,
) {
  const variant = selectedVariantId
    ? product.variants.find((v) => v.id === selectedVariantId)
    : null

  const price = variant?.price ?? product.pricing.current_price

  return {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    quantity,
    price,
    currency: product.pricing.currency,
    image: product.images[0]?.urls.thumbnail ?? "/generic-product-display.png",
    sku: product.sku,
    variant: variant
      ? { id: variant.id, name: variant.name, value: variant.value }
      : null,
  }
}

// ============================================================================
// EXAMPLE 7: Check if product can be added to cart
// ============================================================================

export function canAddToCart(
  product: ProductDetails,
  quantity: number,
  selectedVariantId?: number,
): { canAdd: boolean; reason?: string } {
  // Check if in stock
  if (!product.stock.is_in_stock) {
    return { canAdd: false, reason: "Product out of stock" }
  }

  // Check quantity
  if (quantity > product.stock.quantity) {
    return {
      canAdd: false,
      reason: `Only ${product.stock.quantity} available`,
    }
  }

  // Check variant if selected
  if (selectedVariantId) {
    const variant = product.variants.find((v) => v.id === selectedVariantId)
    if (!variant) {
      return { canAdd: false, reason: "Selected variant not available" }
    }
    if (variant.stock < quantity) {
      return {
        canAdd: false,
        reason: `Only ${variant.stock} of this variant available`,
      }
    }
  }

  return { canAdd: true }
}

// ============================================================================
// EXAMPLE 8: Share product information
// ============================================================================

export function prepareShareData(product: ProductDetails): {
  title: string
  description: string
  imageUrl: string
  price: string
  url: string
} {
  const primaryImage =
    product.images.find((img) => img.is_primary)?.urls.large ||
    product.images[0]?.urls.large

  return {
    title: product.name,
    description:
      product.short_description || 
      product.description.replace(/<[^>]*>/g, "").substring(0, 160),
    imageUrl: primaryImage || "/generic-product-display.png",
    price: formatPrice(product.pricing.current_price, product.pricing.currency),
    url: `${typeof window !== "undefined" ? window.location.origin : ""}/products/${product.slug}`,
  }
}

// ============================================================================
// EXAMPLE 9: Build WhatsApp message
// ============================================================================

export function buildWhatsAppMessage(product: ProductDetails): string {
  const price = formatPrice(
    product.pricing.current_price,
    product.pricing.currency,
  )

  const message = `I'm interested in *${product.name}*\n\nPrice: ${price}\n\nCan you provide more details?`

  return encodeURIComponent(message)
}

// Usage in component:
// const whatsappUrl = `https://wa.me/254XXXXXXXXX?text=${buildWhatsAppMessage(product)}`

// ============================================================================
// EXAMPLE 10: Handle product variants
// ============================================================================

export function getVariantOptions(
  product: ProductDetails,
): {
  variantsByName: Record<string, ProductDetails["variants"]>
  uniqueNames: string[]
} {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    return { variantsByName: {}, uniqueNames: [] }
  }

  const variantsByName: Record<string, ProductDetails["variants"]> = {}

  product.variants.forEach((variant) => {
    if (!variantsByName[variant.name]) {
      variantsByName[variant.name] = []
    }
    variantsByName[variant.name].push(variant)
  })

  return {
    variantsByName,
    uniqueNames: Object.keys(variantsByName),
  }
}

// ============================================================================
// EXAMPLE 11: Render description safely
// ============================================================================

export function renderDescription(product: ProductDetails): React.ReactNode {
  if (!product.description) return null

  // Description is already sanitized by backend, but we can render it safely
  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: product.description }}
    />
  )
}

// ============================================================================
// EXAMPLE 12: Format brand information
// ============================================================================

export function renderBrandInfo(product: ProductDetails): {
  brandName: string
  brandSlug: string
  categoryName: string
  categorySlug: string
} {
  return {
    brandName: product.brand.name,
    brandSlug: product.brand.slug,
    categoryName: product.category.name,
    categorySlug: product.category.slug,
  }
}

// ============================================================================
// EXAMPLE 13: Get timestamp information
// ============================================================================

export function getProductTimestamps(product: ProductDetails): {
  createdDate: string
  updatedDate: string
  isNew: boolean
} {
  const created = new Date(product.timestamps.created)
  const updated = new Date(product.timestamps.updated)
  const now = new Date()
  const daysSinceCreated =
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)

  return {
    createdDate: created.toLocaleDateString(),
    updatedDate: updated.toLocaleDateString(),
    isNew: daysSinceCreated < 7, // Products less than 7 days old are "new"
  }
}

// ============================================================================
// ERROR HANDLING EXAMPLES
// ============================================================================

export async function safeGetProductDetails(productId: string) {
  try {
    const product = await productService.getProductDetails(productId)

    if (!product) {
      throw new Error("Product not found")
    }

    // Validate critical fields
    if (!product.pricing || !product.stock || !product.ratings) {
      console.warn("Product missing critical nested fields")
    }

    // Validate required arrays
    if (!Array.isArray(product.images)) {
      console.warn("Product images array invalid")
    }

    if (!Array.isArray(product.reviews)) {
      console.warn("Product reviews array invalid")
    }

    return {
      success: true,
      data: product,
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Product not found") {
        return {
          success: false,
          error: "Product not found",
          statusCode: 404,
        }
      }
    }

    console.error("Unexpected error fetching product:", error)
    return {
      success: false,
      error: "Failed to load product details",
      statusCode: 500,
    }
  }
}
