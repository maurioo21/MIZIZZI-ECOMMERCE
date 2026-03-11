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

    // Use /api/products/{id} endpoint - the main working products endpoint
    const backendUrl = `${API_BASE_URL}/api/products/${id}`
    console.log(`[v0] getProductDetails: Fetching from ${backendUrl}`)

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

      console.log(`[v0] getProductDetails: Response status ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[v0] getProductDetails: HTTP ${response.status}`, {
          errorBody: errorText.substring(0, 200)
        })
        return null
      }

      const responseDataRaw = await response.json()
      const responseData = responseDataRaw as ProductDetailsResponse | Product | unknown

      const hasData = responseData && typeof responseData === "object" && "data" in (responseData as any)
      const hasId = !hasData && responseData && typeof responseData === "object" && "id" in (responseData as any)

      const product = hasData ? (responseData as ProductDetailsResponse).data : (responseData as Product)

      if (!product || !(product as any).id) {
        console.error("[v0] getProductDetails: Invalid product structure")
        return null
      }

      // Normalize images into an array of objects
      let imagesArray: Array<{ url: string } | any> = []
      if (Array.isArray((product as any).images)) {
        imagesArray = (product as any).images.map((img: any) => (typeof img === "string" ? { url: img } : img)).filter(Boolean)
      } else if ((product as any).image_urls) {
        const imageUrls = (product as any).image_urls
        if (Array.isArray(imageUrls)) {
          imagesArray = imageUrls.map((u: any) => (typeof u === "string" ? { url: u } : u)).filter(Boolean)
        } else if (typeof imageUrls === "string") {
          imagesArray = [{ url: imageUrls }]
        }
      }

      const normalizedProduct: Product = {
        ...(product as any),
        price: typeof (product as any).price === "string" ? Number.parseFloat((product as any).price) : (product as any).price || 0,
        sale_price: (product as any).sale_price
          ? typeof (product as any).sale_price === "string"
            ? Number.parseFloat((product as any).sale_price)
            : (product as any).sale_price
          : null,
        seller: (product as any).seller || defaultSeller,
        product_type: ((product as any).product_type ?? "regular") as Product["product_type"],
        reviews: Array.isArray((product as any).reviews) ? (product as any).reviews : [],
        images: imagesArray as { url: string }[],
      }

      console.log(`[v0] getProductDetails: Success - ${normalizedProduct.name}`)
      return normalizedProduct
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(`[v0] getProductDetails: Request timeout`)
      } else {
        console.error(`[v0] getProductDetails: Fetch failed`, {
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        })
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
