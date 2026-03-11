import type { Product } from "@/types"
import { API_BASE_URL } from "@/lib/config"

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
 * Fetches directly from backend API_BASE_URL
 */
export async function getProductDetails(productId: string | number): Promise<Product | null> {
  try {
    const id = String(productId).trim()

    if (!id) {
      console.error("[v0] getProductDetails: Invalid product ID")
      return null
    }

    const backendUrl = `${API_BASE_URL}/api/product-details/${id}`
    console.log(`[v0] getProductDetails: Fetching from backend: ${backendUrl}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(backendUrl, {
        method: "GET",
        signal: controller.signal,
        next: {
          revalidate: 300,
          tags: [`product-${id}`, "products"],
        },
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`[v0] getProductDetails: Backend HTTP ${response.status} for product ${id}`)
        return null
      }

      const responseData = (await response.json()) as ProductDetailsResponse | Product

      const product = "data" in responseData ? responseData.data : responseData

      if (!product || !product.id) {
        console.error("[v0] getProductDetails: Invalid product data structure")
        return null
      }

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

      console.log(`[v0] getProductDetails: Success - ${normalizedProduct.name}`)
      return normalizedProduct
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(`[v0] getProductDetails: Timeout for product ${id}`)
      } else {
        console.error(`[v0] getProductDetails: Fetch failed:`, fetchError instanceof Error ? fetchError.message : String(fetchError))
      }

      return null
    }
  } catch (error) {
    console.error("[v0] getProductDetails: Critical error:", error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Get product details by slug
 * Extracts numeric ID from slug prefix and fetches product
 */
export async function getProductDetailsBySlug(slug: string): Promise<Product | null> {
  try {
    const trimmedSlug = slug.trim()

    if (/^\d+$/.test(trimmedSlug)) {
      console.log(`[v0] getProductDetailsBySlug: Using numeric ID ${trimmedSlug}`)
      return getProductDetails(trimmedSlug)
    }

    const numericMatch = trimmedSlug.match(/^(\d+)/)
    if (numericMatch) {
      const productId = numericMatch[1]
      console.log(`[v0] getProductDetailsBySlug: Extracted ID ${productId} from slug`)
      return getProductDetails(productId)
    }

    console.error(`[v0] getProductDetailsBySlug: No numeric ID in slug: ${trimmedSlug}`)
    return null
  } catch (error) {
    console.error("[v0] getProductDetailsBySlug: Error:", error instanceof Error ? error.message : String(error))
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
