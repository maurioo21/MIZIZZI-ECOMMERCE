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
      const detailsEndpoint = `${API_BASE_URL}/api/products/${id}`
      
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
 */
export async function getProductDetailsBySlug(slug: string): Promise<Product | null> {
  try {
    const encodedSlug = encodeURIComponent(slug.trim())
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
      const slugEndpoint = `${API_BASE_URL}/api/products/slug/${encodedSlug}`

      const response = await fetch(slugEndpoint, {
        method: "GET",
        signal: controller.signal,
        next: {
          revalidate: 300,
          tags: [`product-slug-${slug}`, "products"],
        },
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`[v0] getProductDetailsBySlug: HTTP ${response.status} for slug ${slug}`)
        return null
      }

      const responseData = (await response.json()) as ProductDetailsResponse | Product

      const product = "data" in responseData ? responseData.data : responseData

      if (!product || !product.id) {
        console.error(`[v0] getProductDetailsBySlug: Invalid data for slug ${slug}`)
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

      console.log(`[v0] getProductDetailsBySlug: Successfully fetched slug ${slug}`)

      return normalizedProduct
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(`[v0] getProductDetailsBySlug: Request timeout for slug ${slug}`)
      } else {
        console.error(`[v0] getProductDetailsBySlug: Fetch failed:`, fetchError)
      }
      return null
    }
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
