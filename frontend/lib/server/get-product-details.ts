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
 * Fetches directly from backend API_BASE_URL with timeout and retry logic
 */
export async function getProductDetails(productId: string | number, retryCount = 0): Promise<Product | null> {
  try {
    const id = String(productId).trim()

    if (!id) {
      console.error("[v0] getProductDetails: Invalid product ID")
      return null
    }

    // Use /api/product-details/{id} endpoint - the backend's dedicated product details endpoint
    const backendUrl = `${API_BASE_URL}/api/product-details/${id}`

    const controller = new AbortController()
    // Increased timeout to 30 seconds for slow backends, with retry logic for up to 2 attempts
    const timeoutMs = 30000

    try {
      console.log(`[v0] getProductDetails: Fetching product ${id} (attempt ${retryCount + 1})`)
      
      const response = await Promise.race([
        fetch(backendUrl, {
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
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Fetch timeout")), timeoutMs)
        ),
      ])

      if (!response.ok) {
        console.error(`[v0] getProductDetails: HTTP ${response.status} for product ${id}`)
        return null
      }

      const responseData = (await response.json()) as ProductDetailsResponse

      // Backend returns { success: true, data: {...}, _cache: {...} }
      if (!responseData.success || !responseData.data) {
        console.error("[v0] getProductDetails: Invalid response structure", { success: responseData.success })
        return null
      }

      const product = responseData.data

      if (!product.id) {
        console.error("[v0] getProductDetails: Product has no ID")
        return null
      }

      // Normalize the response to match frontend Product type
      // Backend returns pricing.current_price, images with urls object, etc.
      const pricing = (product as any).pricing || {}
      const stock = (product as any).stock || {}
      const images = (product as any).images || []

      const normalizedProduct: Product = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        short_description: (product as any).short_description,
        
        // Pricing: backend sends current_price and original_price
        price: pricing.current_price || parseFloat((product as any).price) || 0,
        sale_price: pricing.sale_price || pricing.current_price || null,
        
        // Stock
        stock_quantity: stock.quantity || 0,
        is_in_stock: stock.is_in_stock ?? true,
        
        // Brand
        brand: (product as any).brand || defaultSeller,
        
        // Category
        category_id: (product as any).category?.id,
        category: (product as any).category,
        
        // SKU
        sku: product.sku,
        
        // Images: backend returns array of objects with urls { original, large, medium, thumbnail }
        images: images.map((img: any) => ({
          url: img.urls?.original || img.urls?.large || img.url || "",
          alt_text: img.alt_text || "",
          is_primary: img.is_primary || false,
        })),
        
        // Ratings and reviews
        ratings: (product as any).ratings || { average: 0, total_reviews: 0 },
        reviews: (product as any).reviews || [],
        
        // Other fields
        seller: (product as any).brand || defaultSeller,
        product_type: "regular" as const,
        variants: (product as any).variants || [],
      }

      console.log(`[v0] getProductDetails: Success - ${normalizedProduct.name}`)
      return normalizedProduct
    } catch (fetchError) {
      controller.abort()

      const isTimeout = fetchError instanceof Error && (fetchError.name === "AbortError" || fetchError.message === "Fetch timeout")
      
      if (isTimeout && retryCount < 1) {
        console.warn(`[v0] getProductDetails: Timeout on attempt ${retryCount + 1}, retrying...`)
        // Retry once on timeout
        return getProductDetails(productId, retryCount + 1)
      }

      if (isTimeout) {
        console.error(`[v0] getProductDetails: Request timeout after ${retryCount + 1} attempts`)
      } else {
        console.error(`[v0] getProductDetails: Fetch failed:`, fetchError instanceof Error ? fetchError.message : String(fetchError))
      }

      return null
    }
  } catch (error) {
    console.error("[v0] getProductDetails: Critical error", {
      message: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * Get product details by slug
 * Extracts numeric ID from slug (format: brand-id-description or id-description)
 * Examples: "itel-43-qled..." -> extracts 43, "7-pieces-..." -> extracts 7
 */
export async function getProductDetailsBySlug(slug: string): Promise<Product | null> {
  try {
    const trimmedSlug = slug.trim()

    // If slug is purely numeric, use directly
    if (/^\d+$/.test(trimmedSlug)) {
      console.log(`[v0] getProductDetailsBySlug: Pure numeric slug, fetching ID: ${trimmedSlug}`)
      return getProductDetails(trimmedSlug)
    }

    // Try to extract numeric ID from slug
    // First, look for pattern: starts with digits OR has digits after first dash
    // Examples: "7pieces-..." -> 7, "itel-43-qled-..." -> 43
    
    // Method 1: Extract first sequence of digits (handles "7pieces-..." format)
    const firstDigitMatch = trimmedSlug.match(/^(\d+)/)
    if (firstDigitMatch) {
      const productId = firstDigitMatch[1]
      console.log(`[v0] getProductDetailsBySlug: Found ID at start: ${productId}`)
      return getProductDetails(productId)
    }

    // Method 2: Extract digits after first dash (handles "itel-43-qled-..." format)
    const dashDigitMatch = trimmedSlug.match(/-(\d+)(?:-|$)/)
    if (dashDigitMatch) {
      const productId = dashDigitMatch[1]
      console.log(`[v0] getProductDetailsBySlug: Found ID after dash: ${productId}`)
      return getProductDetails(productId)
    }

    // Method 3: Extract any sequence of consecutive digits (fallback)
    const anyDigitMatch = trimmedSlug.match(/\d+/)
    if (anyDigitMatch) {
      const productId = anyDigitMatch[0]
      console.log(`[v0] getProductDetailsBySlug: Found ID from any digits: ${productId}`)
      return getProductDetails(productId)
    }

    console.error(`[v0] getProductDetailsBySlug: No numeric ID found in slug: ${trimmedSlug}`)
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
