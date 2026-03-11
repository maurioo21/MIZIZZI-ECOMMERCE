import type { Product } from "@/types"
import { API_BASE_URL } from "../config"

// Default seller information
const defaultSeller = {
  id: 1,
  name: "Mizizzi Store",
  rating: 4.8,
  verified: true,
  store_name: "Mizizzi Official Store",
  logo_url: "/logo.png",
}

interface ProductDetailsResponse {
  success: boolean
  data: Product
  _cache?: {
    cache_key: string
    cached_at: string
    expires_at: string
    ttl_seconds: number
  }
}

/**
 * Server-side function to fetch complete product details from backend
 * This is the single source of truth for product data
 * Uses server-side caching with ISR (Incremental Static Regeneration)
 */
export async function getProductDetails(productId: string | number): Promise<Product | null> {
  try {
    const id = String(productId).trim()

    if (!id) {
      console.error("[v0] getProductDetails: Invalid product ID")
      return null
    }

    // Try the product-details endpoint first (new dedicated endpoint)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

    try {
      const detailsEndpoint = `${API_BASE_URL}/api/product-details/${id}`
      
      const response = await fetch(detailsEndpoint, {
        method: "GET",
        signal: controller.signal,
        next: {
          revalidate: 300, // Cache for 5 minutes on the server
          tags: [`product-${id}`, "products"], // Tags for on-demand revalidation
        },
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`[v0] getProductDetails: HTTP ${response.status} from ${detailsEndpoint}`)
        return null
      }

      const responseData = (await response.json()) as ProductDetailsResponse | Product

      // Extract product data (handle both wrapped and unwrapped responses)
      const product = "data" in responseData ? responseData.data : responseData

      if (!product || !product.id) {
        console.error("[v0] getProductDetails: Invalid product data structure")
        return null
      }

      // Normalize prices to numbers
      const normalizedProduct: Product = {
        ...product,
        price: typeof product.price === "string" ? Number.parseFloat(product.price) : product.price || 0,
        sale_price: product.sale_price
          ? typeof product.sale_price === "string"
            ? Number.parseFloat(product.sale_price)
            : product.sale_price
          : null,
        seller: product.seller || defaultSeller,
        product_type: (product.product_type ?? "regular") as Product["product_type"],
        reviews: Array.isArray(product.reviews) ? product.reviews : [],
        images: Array.isArray(product.images)
          ? product.images
          : product.image_urls
            ? Array.isArray(product.image_urls)
              ? product.image_urls
              : [product.image_urls]
            : [],
      }

      console.log(`[v0] getProductDetails: Successfully fetched product ${id} with name: ${normalizedProduct.name}`)

      return normalizedProduct
    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(`[v0] getProductDetails: Request timeout for product ${id}`)
      } else {
        console.error(`[v0] getProductDetails: Fetch failed for ${id}:`, fetchError)
      }
      
      return null
    }
  } catch (error) {
    console.error("[v0] getProductDetails: Critical error:", error)
    return null
  }
}

/**
 * Get product details by slug (for URL-based routing)
 * Since backend only supports numeric IDs, extract the numeric ID from slug
 * Example: "7pieces-automatic-buckle-belt-business-casual-for-men" -> 7
 */
export async function getProductDetailsBySlug(slug: string): Promise<Product | null> {
  try {
    const trimmedSlug = slug.trim()

    // If it's already numeric, use directly
    if (/^\d+$/.test(trimmedSlug)) {
      return getProductDetails(trimmedSlug)
    }

    // Extract numeric prefix from slug (e.g., "7pieces-..." -> "7")
    const numericMatch = trimmedSlug.match(/^(\d+)/)
    if (numericMatch) {
      const productId = numericMatch[1]
      console.log(`[v0] getProductDetailsBySlug: Extracted ID ${productId} from slug ${trimmedSlug}`)
      return getProductDetails(productId)
    }

    // If no numeric ID found, log error
    console.error(`[v0] getProductDetailsBySlug: Could not extract numeric ID from slug: ${trimmedSlug}`)
    return null
  } catch (error) {
    console.error("[v0] getProductDetailsBySlug: Critical error:", error)
    return null
  }
}

/**
 * Validate product data integrity
 */
export function validateProductDetails(product: Product | null): boolean {
  if (!product) return false
  return !!(product.id && product.name && typeof product.price === "number")
}
