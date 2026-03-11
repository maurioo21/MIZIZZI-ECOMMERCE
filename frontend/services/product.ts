import api from "@/lib/api"
import type { Product, ProductImage, Category, Brand } from "@/types"
import type { ProductDetails, ProductDetailsResponse } from "@/types/product-details"
import { prefetchData } from "@/lib/api"
// Add import for imageCache
import { imageCache } from "@/services/image-cache"
// Only showing the changes needed to integrate with the new batch service
import { imageBatchService } from "@/services/image-batch-service"
import { cloudinaryService } from "@/services/cloudinary-service"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://mizizzi-ecommerce-1.onrender.com"

// Safely extract a product list from diverse response shapes
function extractProducts(payload: any): Product[] {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.products)) return data.products
  if (Array.isArray(data?.data)) return data.data
  return []
}

function mapFrontendParamsToBackend(params: Record<string, any> = {}) {
  const mapped: Record<string, any> = {}

  // pagination
  if (params.page != null) mapped.page = params.page
  if (params.limit != null) mapped.per_page = params.limit

  // filters
  if (params.category_id != null) mapped.category_id = params.category_id
  if (params.brand_id != null) mapped.brand_id = params.brand_id
  if (params.min_price != null) mapped.min_price = params.min_price
  if (params.max_price != null) mapped.max_price = params.max_price
  if (params.search != null || params.q != null) mapped.search = params.search ?? params.q

  // flags: normalize to backend names
  if (params.featured != null) mapped.is_featured = params.featured
  if (params.new != null) mapped.is_new = params.new
  if (params.sale != null) mapped.is_sale = params.sale
  if (params.flash_sale != null) mapped.is_flash_sale = params.flash_sale
  if (params.luxury_deal != null) mapped.is_luxury_deal = params.luxury_deal
  if (params.daily_find != null) mapped.is_daily_find = params.daily_find
  if (params.top_pick != null) mapped.is_top_pick = params.top_pick
  if (params.trending != null) mapped.is_trending = params.trending
  if (params.new_arrival != null) mapped.is_new_arrival = params.new_arrival

  // sorting
  // map UI "sortBy" to backend sort_by/sort_order
  const sortBy = params.sortBy || params.sort_by
  if (sortBy) {
    switch (sortBy) {
      case "price-asc":
        mapped.sort_by = "price"
        mapped.sort_order = "asc"
        break
      case "price-desc":
        mapped.sort_by = "price"
        mapped.sort_order = "desc"
        break
      case "newest":
        mapped.sort_by = "created_at"
        mapped.sort_order = "desc"
        break
      default:
        // allow direct passthrough if already backend-compatible
        mapped.sort_by = params.sort_by ?? "created_at"
        mapped.sort_order = params.sort_order ?? "desc"
    }
  }

  // passthrough anything else that looks safe
  for (const [k, v] of Object.entries(params)) {
    if (mapped[k] === undefined) mapped[k] = v
  }

  return mapped
}

function coerceImageUrls(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === "string").map((u) => u.trim()).filter(Boolean)
  if (typeof raw === "string") {
    const s = raw.trim()
    if (!s) return []
    // handle JSON-encoded arrays e.g. '["a","b"]'
    if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith('"') && s.endsWith('"'))) {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) {
          return parsed.filter((u) => typeof u === "string").map((u) => u.trim()).filter(Boolean)
        }
        if (typeof parsed === "string") return [parsed.trim()].filter(Boolean)
      } catch {
        // fall through
      }
    }
    // handle comma-separated lists
    if (s.includes(",") && !s.startsWith("http")) {
      return s
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
    }
    return [s]
  }
  return []
}

function normalizeImageUrl(url: string): string {
  const u = url.trim()
  if (!u) return ""
  if (u.startsWith("blob:")) return ""
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/")) return u

  // Likely a backend-served path (e.g. "api/uploads/..." or "uploads/...")
  if (u.includes("/") || u.includes(".")) {
    return `${API_BASE_URL}/${u.replace(/^\/+/, "")}`
  }

  // Likely a Cloudinary public_id
  const optimized = cloudinaryService.generateOptimizedUrl(u)
  return optimized === "/placeholder.svg" ? u : optimized
}

function normalizeProductImages(product: Product): Product {
  const imageUrls = coerceImageUrls((product as any).image_urls)
  const imagesField = Array.isArray((product as any).images) ? (product as any).images : []
  const imagesUrlsFromImagesField = imagesField
    .map((img: any) => (typeof img?.url === "string" ? img.url : typeof img?.image_url === "string" ? img.image_url : ""))
    .filter(Boolean)

  const merged = [...imageUrls, ...imagesUrlsFromImagesField]
    .map(normalizeImageUrl)
    .filter(Boolean)

  const thumbnail =
    typeof (product as any).thumbnail_url === "string" ? normalizeImageUrl((product as any).thumbnail_url) : undefined

  return {
    ...product,
    image_urls: merged.length > 0 ? merged : [],
    thumbnail_url: thumbnail || (merged[0] ?? product.thumbnail_url ?? null),
  }
}

// Cache maps with timestamps for expiration
const productCache = new Map<string, { data: Product[]; timestamp: number }>()
const productImagesCache = new Map<string, { data: ProductImage[]; timestamp: number }>()
const productDetailsCache = new Map<string, { data: ProductDetails; timestamp: number }>()
const categoriesCache = new Map<string, { data: Category[]; timestamp: number }>()
const brandsCache = new Map<string, { data: Brand[]; timestamp: number }>()
const productReviewsCache = new Map<string, { data: any[]; timestamp: number }>() // Separate cache for reviews

// Cache durations
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes for products
const CATEGORIES_CACHE_DURATION = 30 * 60 * 1000 // 30 minutes for categories
const BRANDS_CACHE_DURATION = 30 * 60 * 1000 // 30 minutes for brands

// Default seller information
const defaultSeller = {
  id: 1,
  name: "Mizizzi Store",
  rating: 4.8,
  verified: true,
  store_name: "Mizizzi Official Store",
  logo_url: "/logo.png",
}

export const productService = {
  /**
   * Get products with optional filtering parameters
   * @param params Optional query parameters for filtering
   * @returns Promise resolving to an array of products
   */
  async getProducts(params = {}): Promise<Product[]> {
    try {
      console.log("API call: getProducts with params:", params)

      // Normalize query parameters
      const queryParams: Record<string, any> = { ...params }

      // Generate cache key based on params
      const cacheKey = `products-${JSON.stringify(params)}`
      const now = Date.now()
      const cachedItem = productCache.get(cacheKey)

      // Return cached data if available and not expired
      if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
        console.log(`Using cached products data for params: ${JSON.stringify(params)}`)
        // Fix: Return an array of products, not a single product
        return cachedItem.data
      }

      const backendParams = mapFrontendParamsToBackend(params)
      const url = `${API_BASE_URL}/api/products/` // trailing slash avoids 308

      let response: any
      try {
        response = await api.get(url, { params: backendParams })
      } catch (error: any) {
        if (error.message === "Network Error" || error.code === "ERR_NETWORK") {
          console.warn("[v0] Products fetch failed due to network error, returning empty array")
          return []
        }
        throw error
      }

      console.log("API response:", (response as any)?.data ?? response)
      let products: Product[] = extractProducts(response)

      if (queryParams.flash_sale === true || queryParams.is_flash_sale === true) {
        products = products.filter((p) => p.is_flash_sale)
      }
      if (queryParams.luxury_deal === true || queryParams.is_luxury_deal === true) {
        products = products.filter((p) => p.is_luxury_deal)
      }
      if (queryParams.daily_find === true || queryParams.is_daily_find === true) {
        products = products.filter((p) => p.is_daily_find)
      }
      if (queryParams.top_pick === true || queryParams.is_top_pick === true) {
        products = products.filter((p) => p.is_top_pick)
      }
      if (queryParams.trending === true || queryParams.is_trending === true) {
        products = products.filter((p) => p.is_trending)
      }
      if (queryParams.new_arrival === true || queryParams.is_new_arrival === true) {
        // Check both is_new_arrival and new_arrival (fallback) and handle potential 0/1 values
        products = products.filter((p) => !!p.is_new_arrival || !!(p as any).new_arrival)
      }
      if (queryParams.featured === true || queryParams.is_featured === true) {
        products = products.filter((p) => p.is_featured)
      }

      // Normalize and enhance products
      const enhancedProducts = await Promise.all(
        products.map(async (product) => {
          // Normalize price data
          product = this.normalizeProductPrices(product)

          // Normalize/repair image_urls into a consistent, display-ready array
          product = normalizeProductImages(product)

          // Add product type for easier filtering and display
          product.product_type = product.is_flash_sale
            ? "flash_sale"
            : product.is_luxury_deal
              ? "luxury"
              : ("regular" as "flash_sale" | "luxury" | "regular")

          // Fetch product images if they're not already included
          if ((!product.image_urls || product.image_urls.length === 0) && product.id) {
            try {
              const images = await this.getProductImages(product.id.toString())
              if (images && images.length > 0) {
                product.image_urls = images.map((img) => img.url)

                // Set thumbnail_url to the primary image if it exists
                const primaryImage = images.find((img) => img.is_primary)
                if (primaryImage) {
                  product.thumbnail_url = primaryImage.url
                } else if (images[0]) {
                  product.thumbnail_url = images[0].url
                }
              }
            } catch (error) {
              console.error(`Error fetching images for product ${product.id}:`, error)
            }
          }

          // Re-normalize after image fetch (handles relative paths, etc.)
          product = normalizeProductImages(product)

          return {
            ...product,
            seller: product.seller || defaultSeller,
          }
        }),
      )

      // Fix: Cache the array of products, not a single product
      productCache.set(cacheKey, {
        data: enhancedProducts,
        timestamp: now,
      })

      // Note: Image prefetching disabled to prevent base64 LQIP generation
      // Images load on-demand client-side instead

      return enhancedProducts
    } catch (error) {
      console.error("Error fetching products:", error)
      return []
    }
  },

  /**
   * Get products by category slug
   * @param categorySlug The category slug
   * @returns Promise resolving to an array of products
   */
  async getProductsByCategory(categorySlug: string): Promise<Product[]> {
    try {
      console.log(`[v0] API call: getProductsByCategory for slug: ${categorySlug}`)

      // Check cache first
      const cacheKey = `products-category-${categorySlug}`
      const now = Date.now()
      const cachedItem = productCache.get(cacheKey)

      if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
        console.log(`[v0] Using cached products for category ${categorySlug} - count: ${cachedItem.data.length}`)
        return cachedItem.data
      }

      let categoryId: number | null = null

      // If caller passes a numeric category "slug" (actually an ID), use it directly
      const isNumericId = /^\d+$/.test(categorySlug)
      if (isNumericId) {
        categoryId = Number(categorySlug)
        console.log(`[v0] Using numeric category ID: ${categoryId}`)
      } else {
        // Get category by slug to find the ID
        try {
          const categoryResponse = await api.get(`${API_BASE_URL}/api/categories/slug/${categorySlug}`)
          const categoryData = categoryResponse?.data
          if (categoryData && categoryData.id) {
            categoryId = categoryData.id
            console.log(`[v0] Found category ID ${categoryId} for slug: ${categorySlug}`)
          } else {
            console.error(`[v0] Category not found for slug: ${categorySlug}`)
            return []
          }
        } catch (error) {
          console.error(`[v0] Error fetching category by slug ${categorySlug}:`, error)
          return []
        }
      }

      if (!categoryId) {
        console.error(`[v0] No valid category ID found for slug: ${categorySlug}`)
        return []
      }

      // Now fetch products using the category ID
      const url = `${API_BASE_URL}/api/products/`
      const mappedParams = mapFrontendParamsToBackend({ category_id: categoryId })
      console.log(`[v0] Fetching products with params:`, { categoryId, mappedParams })
      
      const response = await api.get(url, {
        params: mappedParams,
      })
      console.log(`[v0] API response for category products (ID: ${categoryId}):`, (response as any)?.data ?? response)
      const products: Product[] = extractProducts(response)

      console.log(`[v0] Found ${products.length} products for category ${categorySlug} (ID: ${categoryId})`)

      // Enhance products with images and normalize data
      const enhancedProducts = await Promise.all(
        products.map(async (product) => {
          // Normalize price data
          product = this.normalizeProductPrices(product)

          // Normalize/repair image_urls into a consistent, display-ready array
          product = normalizeProductImages(product)

          // Fetch product images if they're not already included
          if ((!product.image_urls || product.image_urls.length === 0) && product.id) {
            try {
              const images = await this.getProductImages(product.id.toString())
              if (images && images.length > 0) {
                product.image_urls = images.map((img) => img.url)

                // Set thumbnail_url to the primary image if it exists
                const primaryImage = images.find((img) => img.is_primary)
                if (primaryImage) {
                  product.thumbnail_url = primaryImage.url
                } else if (images[0]) {
                  product.thumbnail_url = images[0].url
                }
              }
            } catch (error) {
              console.error(`Error fetching images for product ${product.id}:`, error)
            }
          }

          // Re-normalize after image fetch (handles relative paths, etc.)
          product = normalizeProductImages(product)

          return {
            ...product,
            seller: product.seller || defaultSeller,
          }
        }),
      )

      productCache.set(cacheKey, {
        data: enhancedProducts,
        timestamp: now,
      })

      // Note: Image prefetching disabled to prevent base64 LQIP generation
      // Images load on-demand client-side instead

      return enhancedProducts
    } catch (error) {
      console.error(`Error fetching products by category ${categorySlug}:`, error)
      return []
    }
  },

  /**
   * Get a single product by ID
   * @param id The product ID
   * @returns Promise resolving to a product or null
   */
  async getProduct(id: string): Promise<Product | null> {
    try {
      if (!id || id === "undefined" || id === "null") {
        console.error(`[v0] Invalid product ID provided: ${id}`)
        return null
      }

      const cacheBustTimestamp =
        typeof window !== "undefined" ? sessionStorage.getItem(`product_${id}_cache_bust`) : null

      // Check cache first
      const cacheKey = `product-${id}`
      const now = Date.now()
      const cachedItem = productCache.get(cacheKey)

      const shouldSkipCache = cacheBustTimestamp && now - Number.parseInt(cacheBustTimestamp) < 10000 // 10 seconds

      if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION && !shouldSkipCache) {
        console.log(`Using cached product data for id ${id}`)
        return cachedItem.data[0] // Return the first product from the array
      }

      console.log(`Fetching product with id ${id} from API`)

      productCache.delete(cacheKey)

      // Use the full URL with API_BASE_URL from environment
      // const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

      // Make sure we have a complete URL
      const url = `${API_BASE_URL}/api/products/${id}`
      console.log(`Making request to: ${url}`)

      const response = await api.get(url)
      let product = response.data

      // Ensure the product has valid data
      if (product) {
        // Normalize price data
        product = this.normalizeProductPrices(product)

        // Ensure variants have valid prices
        if (product.variants && Array.isArray(product.variants)) {
          product.variants = product.variants.map((variant: any) => {
            if (typeof variant.price === "string") {
              variant.price = Number.parseFloat(variant.price) || 0
            }

            if (typeof variant.price !== "number" || isNaN(variant.price) || variant.price < 0) {
              console.warn(`Invalid price for variant in product ${id}, using product price`)
              variant.price = product.price
            }
            return variant
          })
        }

        // Fetch product images if they're not already included
        if (!product.image_urls || product.image_urls.length === 0) {
          try {
            const images = await this.getProductImages(id)
            if (images && images.length > 0) {
              product.image_urls = images.map((img) => img.url)

              // Set thumbnail_url to the primary image if it exists
              const primaryImage = images.find((img) => img.is_primary)
              if (primaryImage) {
                product.thumbnail_url = primaryImage.url
              } else if (images[0]) {
                product.thumbnail_url = images[0].url
              }
            }
          } catch (error) {
            console.error(`Error fetching images for product ${id}:`, error)
          }
        }

        product = {
          ...product,
          seller: product.seller || defaultSeller,
        }

        // Cache the result with timestamp
        productCache.set(cacheKey, {
          data: [product], // Cache as an array
          timestamp: now,
        })

        // Prefetch related products in the background
        if (product.category_id) {
          prefetchData(`${API_BASE_URL}/api/products`, {
            category_id: product.category_id,
            limit: 8,
          })
        }
      }

      return product
    } catch (error) {
      console.error(`Error fetching product with id ${id}:`, error)
      return null
    }
  },

  /**
   * Get product details with new backend structure
   * @param id The product ID or slug
   * @returns Promise resolving to ProductDetails or null
   */
  async getProductDetails(id: string | number): Promise<ProductDetails | null> {
    try {
      const productId = String(id)
      if (!productId || productId === "undefined" || productId === "null") {
        console.error(`[v0] Invalid product ID: ${productId}`)
        return null
      }

      // Check cache first
      const cacheKey = `product-details-${productId}`
      const now = Date.now()
      const cachedItem = productDetailsCache.get(cacheKey)

      if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
        console.log(`[v0] Using cached product details for id ${productId}`)
        return cachedItem.data
      }

      const url = `${API_BASE_URL}/api/product-details/${productId}`
      console.log(`[v0] Fetching product details from: ${url}`)

      const response = await api.get<ProductDetailsResponse>(url)

      // Handle both new response format and legacy format
      let productDetails: ProductDetails | null = null

      if (response.data && typeof response.data === "object") {
        // Check if it's the new wrapped format with _cache and data
        if ("data" in response.data && "success" in response.data) {
          const wrappedResponse = response.data as ProductDetailsResponse
          productDetails = wrappedResponse.data
        } else {
          // Try to use it directly as ProductDetails
          productDetails = response.data as ProductDetails
        }
      }

      if (!productDetails) {
        console.error(`[v0] No product details data returned for id ${productId}`)
        return null
      }

      // Validate critical fields
      if (!productDetails.pricing || !productDetails.stock || !productDetails.ratings) {
        console.warn(`[v0] Product ${productId} missing critical nested fields`)
      }

      // Cache the result
      productDetailsCache.set(cacheKey, {
        data: productDetails,
        timestamp: now,
      })

      return productDetails
    } catch (error: any) {
      console.error(`[v0] Error fetching product details for id ${id}:`