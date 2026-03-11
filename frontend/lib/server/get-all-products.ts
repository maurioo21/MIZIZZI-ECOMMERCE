import type { Product } from "@/types"
import { productService } from "@/services/product"
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

function extractProducts(payload: any): Product[] {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.products)) return data.products
  if (Array.isArray(data?.data)) return data.data
  return []
}

function normalizeProductPrices(product: Product): Product {
  // Backend returns nested pricing object: pricing.current_price, pricing.original_price
  // Or flat structure: price, sale_price
  const pricing = (product as any).pricing
  
  let price: number
  let salePrice: number | null

  if (pricing && typeof pricing === "object") {
    // Backend structure: pricing.current_price and pricing.original_price
    price = typeof pricing.original_price === "string" 
      ? Number.parseFloat(pricing.original_price) 
      : pricing.original_price || 0
    
    salePrice = pricing.current_price && pricing.current_price !== pricing.original_price
      ? typeof pricing.current_price === "string"
        ? Number.parseFloat(pricing.current_price)
        : pricing.current_price
      : null
  } else {
    // Flat structure: price, sale_price
    price = typeof product.price === "string" ? Number.parseFloat(product.price) || 0 : product.price || 0
    salePrice = typeof product.sale_price === "string" ? Number.parseFloat(product.sale_price) || null : product.sale_price || null
  }

  return {
    ...product,
    price: price || 0,
    sale_price: salePrice || null,
  }
}

/**
 * Server-side function to fetch all products with pagination
 * This runs on the server before the page is sent to the browser
 * Uses caching with ISR (Incremental Static Regeneration)
 */
export async function getAllProducts(limit = 12, page = 1): Promise<Product[]> {
  try {
    // Try the local API endpoint first (running on the same Next.js server)
    const localEndpoint = `/api/products?per_page=${limit}&page=${page}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}${localEndpoint}`, {
        signal: controller.signal,
        next: {
          revalidate: 60, // Cache for 60 seconds on the server
          tags: ["all-products"], // Tag for on-demand revalidation
        },
        headers: {
          "Content-Type": "application/json",
        },
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        let products = extractProducts(data)

        if (products.length > 0) {
          // Normalize products - NO image fetching here, just normalize prices
          const normalizedProducts: Product[] = products.map((product: any) => {
            const p = normalizeProductPrices(product)
            return {
              ...p,
              seller: p.seller || defaultSeller,
              product_type: (p.product_type ?? "regular") as Product["product_type"],
            } as Product
          })

            // Non-blocking: Prefetch images in background without waiting
            // DISABLED: This causes 40+ individual API calls that block page render
            // Images will be loaded client-side on demand instead
            // setImmediate(() => {
            //   productService.prefetchProductImages(normalizedProducts.map((p) => p.id.toString()))
            // })

          return normalizedProducts
        }
      }
    } catch (err) {
      console.error("[v0] getAllProducts: Local API failed:", err)
      
      // Fallback to external API
      try {
        const productsEndpoint = `${API_BASE_URL}/api/products/?per_page=${limit}&page=${page}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(productsEndpoint, {
          signal: controller.signal,
          next: {
            revalidate: 60,
            tags: ["all-products"],
          },
          headers: {
            "Content-Type": "application/json",
          },
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          let products = extractProducts(data)

          if (products.length > 0) {
            const normalizedProducts: Product[] = products.map((product: any) => {
              const p = normalizeProductPrices(product)
              return {
                ...p,
                seller: p.seller || defaultSeller,
                product_type: (p.product_type ?? "regular") as Product["product_type"],
              } as Product
            })

            // Non-blocking: Prefetch images in background without waiting
            // DISABLED: This causes 40+ individual API calls that block page render
            // Images will be loaded client-side on demand instead
            // setImmediate(() => {
            //   productService.prefetchProductImages(normalizedProducts.map((p) => p.id.toString()))
            // })

            return normalizedProducts
          }
        }
      } catch (fallbackErr) {
        console.error("[v0] getAllProducts: External API also failed:", fallbackErr)
      }
    }

    // Fallback to empty array
    return []
  } catch (error) {
    console.error("[v0] getAllProducts: Critical error:", error)
    return []
  }
}

/**
 * Get initial products for home page with pagination info
 */
export async function getAllProductsForHome(limit = 12): Promise<{ products: Product[]; hasMore: boolean }> {
  const products = await getAllProducts(limit, 1)
  return {
    products,
    hasMore: products.length >= limit,
  }
}
