import api from "@/lib/api"
import type { Product, ProductImage, Category, Brand } from "@/types"
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
   * Get product images using the batch service
   * @param productId The product ID
   * @returns Promise resolving to an array of product images
   */
  async getProductImages(productId: string): Promise<ProductImage[]> {
    try {
      // First check if the images are in our cache
      const cacheKey = `product-images-${productId}`
      const cachedItem = productImagesCache.get(cacheKey)
      
      // Check cache without Date.now() - use simpler cache key versioning
      if (cachedItem) {
        // Only log in development and reduce verbosity
        if (process.env.NODE_ENV === "development" && Math.random() < 0.1) {
          console.log(`Using cached product images for product ${productId}`)
        }
        return cachedItem.data
      }

      // Only log in development
      if (process.env.NODE_ENV === "development") {
        console.log(`Fetching images for product ${productId} from API`)
      }

      // Use the batch service instead of direct API call
      // Fetch data BEFORE calling Date.now() to satisfy Next.js 16 requirements
      const images = await imageBatchService.fetchProductImages(productId)

      // Cache the results - now we can safely use Date.now() after fetch
      const now = Date.now()
      productImagesCache.set(cacheKey, {
        data: images,
        timestamp: now,
      })

      // Also cache individual image URLs for quick access
      images.forEach((img) => {
        if (img.id && img.url) {
          imageCache.set(`image-${img.id}`, img.url)
        }
      })

      return images
    } catch (error) {
      console.error(`Error fetching images for product ${productId}:`, error)
      return []
    }
  },

  /**
   * Get a specific product image by ID
   * @param imageId The image ID
   * @returns Promise resolving to a product image or null
   */
  async getProductImage(imageId: string): Promise<ProductImage | null> {
    try {
      // Check if the image URL is already in our cache
      const cachedUrl = imageCache.get(`image-${imageId}`)
      if (cachedUrl) {
        console.log(`Using cached image URL for image ${imageId}`)
        return {
          id: imageId,
          url: cachedUrl,
          is_primary: false, // We don't know from cache, default value
          product_id: "", // We don't know from cache
          filename: "", // Default or unknown filename
          sort_order: 0, // Default sort order
        }
      }

      console.log(`Fetching product image with ID ${imageId}`)
      // const response = await api.get(`/api/product-images/${imageId}`)
      const response = await api.get(`${API_BASE_URL}/api/products/product-images/${imageId}`)

      // Cache the image URL for future use
      if (response.data && response.data.url) {
        imageCache.set(`image-${imageId}`, response.data.url)
      }

      return response.data
    } catch (error) {
      console.error(`Error fetching product image with ID ${imageId}:`, error)
      return null
    }
  },

  /**
   * Invalidate cache for a specific product
   * @param id The product ID
   */
  invalidateProductCache(id: string): void {
    const productCacheKey = `product-${id}`
    const imagesCacheKey = `product-images-${id}`
    productCache.delete(productCacheKey)
    productImagesCache.delete(imagesCacheKey)
    imageBatchService.invalidateCache(id)

    // Iterate over all keys and remove those that start with "products-"
    for (const key of productCache.keys()) {
      if (key.startsWith("products-")) {
        productCache.delete(key)
      }
    }

    console.log(`Cache invalidated for product ${id}, its images, and all product lists`)
  },

  /**
   * Invalidate all product cache
   */
  invalidateAllProductCache(): void {
    productCache.clear()
    productImagesCache.clear()
    imageBatchService.clearCache()
    console.log("All product cache invalidated")
  },

  /**
   * Get a product by slug
   * @param slug The product slug
   * @returns Promise resolving to a product or null
   */
  async getProductBySlug(slug: string): Promise<Product | null> {
    try {
      // Check cache first
      const cacheKey = `product-slug-${slug}`
      const now = Date.now()
      const cachedItem = productCache.get(cacheKey)

      if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
        console.log(`Using cached product data for slug ${slug}`)
        return cachedItem.data[0] // Return the first product from the array
      }

      // Try extracting numeric ID from slug (format: name-id or name-slug-id)
      const slugParts = slug.split("-")
      let extractedId: string | null = null
      
      // Try to find a numeric part in the slug
      for (let i = slugParts.length - 1; i >= 0; i--) {
        if (/^\d+$/.test(slugParts[i])) {
          extractedId = slugParts[i]
          break
        }
      }

      // Try common endpoints (slug-specific first, then fallback to ID if extracted)
      const endpoints: string[] = [
        `${API_BASE_URL}/api/products/slug/${encodeURIComponent(slug)}`,
        `${API_BASE_URL}/api/products/${encodeURIComponent(slug)}`,
      ]

      // Add ID-based endpoint if we extracted an ID
      if (extractedId) {
        endpoints.push(`${API_BASE_URL}/api/products/${extractedId}`)
        console.log(`[v0] Extracted product ID from slug: ${extractedId}`)
      }

      let response: any = null
      let lastError: any = null

      for (const url of endpoints) {
        try {
          response = await api.get(url)
          if (response && response.data) {
            console.log(`[v0] Successfully fetched product from: ${url}`)
            break
          }
        } catch (err: any) {
          lastError = err
          // If 404, try next endpoint
          if (err?.response?.status === 404) {
            console.log(`[v0] Endpoint returned 404, trying fallback: ${url}`)
            continue
          }
          // Network issues -> return null (caller can decide)
          if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
            console.warn(`Network error fetching product by slug ${slug}:`, err)
            return null
          }
          // Re-throw unexpected errors
          throw err
        }
      }

      if (!response) {
        // If last attempt returned 404, treat as not found
        if (lastError?.response?.status === 404) {
          console.log(`[v0] Product not found with slug: ${slug}`)
          return null
        }
        // Otherwise return null as a safe fallback
        return null
      }

      let product = response.data

      // Ensure the product has valid data
      if (product) {
        // Normalize price data
        product = this.normalizeProductPrices(product)

        // Fetch product images if they're not already included
        if (!product.image_urls || product.image_urls.length === 0) {
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

        product = {
          ...product,
          seller: product.seller || defaultSeller,
        }

        // Cache the result with timestamp
        productCache.set(cacheKey, {
          data: [product], // Cache as an array
          timestamp: now,
        })

        // Also cache by ID for future reference
        if (product.id) {
          productCache.set(`product-${product.id}`, {
            data: [product], // Cache as an array
            timestamp: now,
          })
        }
      }

      return product
    } catch (error) {
      console.error(`Error fetching product with slug ${slug}:`, error)
      return null
    }
  },

  /**
   * Get featured products
   * @returns Promise resolving to an array of products
   */
  async getFeaturedProducts(): Promise<Product[]> {
    try {
      console.log("[v0] Fetching featured products using /api/products with filter")
      const response = await api.get(`${API_BASE_URL}/api/products`, {
        params: {
          is_featured: true,
          per_page: 10000
        }
      })
      const items = Array.isArray(response.data) ? response.data : response.data.items || response.data.products || []
      console.log("[v0] Featured products fetched, count:", items.length)
      return Array.isArray(items) ? items : []
    } catch (e: any) {
      if (e.response?.status === 404) {
        return []
      }
      console.error("[v0] Error fetching featured products:", e.message)
      return []
    }
  },

  /**
   * Get new products
   * @returns Promise resolving to an array of products
   */
  async getNewProducts(): Promise<Product[]> {
    try {
      console.log("[v0] Fetching new products using /api/products with filter")
      const response = await api.get(`${API_BASE_URL}/api/products`, {
        params: {
          is_new: true,
          per_page: 10000
        }
      })
      const items = Array.isArray(response.data) ? response.data : response.data.items || response.data.products || []
      console.log("[v0] New products fetched, count:", items.length)
      return Array.isArray(items) ? items : []
    } catch (e: any) {
      if (e.response?.status === 404) {
        return []
      }
      console.error("[v0] Error fetching new products:", e.message)
      return []
    }
  },

  /**
   * Get sale products
   * @returns Promise resolving to an array of products
   */
  async getSaleProducts(): Promise<Product[]> {
    try {
      console.log("[v0] Fetching sale products using /api/products with filter")
      const response = await api.get(`${API_BASE_URL}/api/products`, {
        params: {
          is_sale: true,
          per_page: 10000
        }
      })
      const items = Array.isArray(response.data) ? response.data : response.data.items || response.data.products || []
      console.log("[v0] Sale products fetched, count:", items.length)
      return Array.isArray(items) ? items : []
    } catch (e: any) {
      if (e.response?.status === 404) {
        return []
      }
      console.error("[v0] Error fetching sale products:", e.message)
      return []
    }
  },

  /**
   * Get flash sale products
   * @returns Promise resolving to an array of products
   */
  async getFlashSaleProducts(): Promise<Product[]> {
    return this.getProducts({ flash_sale: true })
  },

  /**
   * Get luxury deal products
   * @returns Promise resolving to an array of products
   */
  async getLuxuryDealProducts(): Promise<Product[]> {
    return this.getProducts({ luxury_deal: true })
  },

  /**
   * Get daily find products
   * @param limit Number of products to return
   * @returns Promise resolving to an array of products
   */
  async getDailyFindProducts(limit = 12): Promise<Product[]> {
    return this.getProducts({ daily_find: true, limit })
  },

  /**
   * Get top pick products
   * @returns Promise resolving to an array of products
   */
  async getTopPicks(limit = 12): Promise<Product[]> {
    return this.getProducts({ top_pick: true, limit })
  },

  /**
   * Get trending products
   * @param limit Number of products to return
   * @returns Promise resolving to an array of products
   */
  async getTrendingProducts(limit = 12): Promise<Product[]> {
    return this.getProducts({ trending: true, limit })
  },

  /**
   * Get new arrival products
   * @param limit Number of products to return
   * @returns Promise resolving to an array of products
   */
  async getNewArrivalProducts(limit = 12): Promise<Product[]> {
    // Fetch more items initially to handle cases where backend filtering might be partial
    // or when we need to filter client-side from a larger pool
    const products = await this.getProducts({ new_arrival: true, limit: 50 })
    return products.slice(0, limit)
  },

  /**
   * Get products by IDs
   * @param productIds Array of product IDs
   * @returns Promise resolving to an array of products
   */
  async getProductsByIds(productIds: number[]): Promise<Product[]> {
    try {
      console.log(`API call: getProductsByIds for ids: ${productIds.join(", ")}`)

      // If no product IDs are provided, return an empty array
      if (!productIds.length) {
        return []
      }

      // Convert all IDs to strings for consistent comparison
      const requestedIds = productIds.map((id) => id.toString())

      // First check if any products are in the cache
      const cachedProducts: Product[] = []
      const missingIds: string[] = []

      requestedIds.forEach((id) => {
        const cacheKey = `product-${id}`
        const cachedItem = productCache.get(cacheKey)

        if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
          cachedProducts.push(...cachedItem.data) // Push all products from the array
        } else {
          missingIds.push(id)
        }
      })

      // If all products were in cache, return them
      if (missingIds.length === 0) {
        console.log(`All ${requestedIds.length} products found in cache`)
        return cachedProducts
      }

      // Make the API request for missing products
      console.log(`Fetching ${missingIds.length} products from API: ${missingIds.join(", ")}`)
      const response = await api.get("/api/products", {
        params: { ids: missingIds.join(",") },
      })

      console.log("API response for products by IDs:", response.data)

      // Get the items from the response
      const apiProducts = Array.isArray(response.data) ? response.data : response.data.items || []

      // Create a map of product IDs to products for easier lookup
      const productMap = new Map<string, Product>()

      // Add cached products to the map
      cachedProducts.forEach((product) => {
        productMap.set(product.id.toString(), product)
      })

      // Process API products and add to map
      const enhancedApiProducts = await Promise.all(
        apiProducts.map(async (product: Product) => {
          const productId = product.id.toString()

          // Normalize price data
          product = this.normalizeProductPrices(product)

          // Fetch product images if they're not already included
          if (!product.image_urls || product.image_urls.length === 0) {
            try {
              const images = await this.getProductImages(productId)
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
              console.error(`Error fetching images for product ${productId}:`, error)
            }
          }

          return {
            ...product,
            seller: product.seller || defaultSeller,
          }
        }),
      )

      // Add enhanced products to map and cache
      enhancedApiProducts.forEach((product) => {
        const productId = product.id.toString()
        productMap.set(productId, product)

        // Update cache
        const cacheKey = `product-${productId}`
        productCache.set(cacheKey, {
          data: [product], // Cache as an array
          timestamp: Date.now(),
        })
      })

      // Check which IDs are still missing
      const stillMissingIds = requestedIds.filter((id) => !productMap.has(id))

      if (stillMissingIds.length > 0) {
        console.log(`Still missing ${stillMissingIds.length} products: ${stillMissingIds.join(", ")}`)

        // Fetch missing products individually
        const individualResults = await Promise.allSettled(stillMissingIds.map((id) => this.getProduct(id)))

        // Add successful results to the map
        individualResults.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            const product = result.value
            productMap.set(stillMissingIds[index], product)
          }
        })
      }

      // Create the final result array in the same order as the requested IDs
      const result = requestedIds.map((id) => productMap.get(id)).filter((product): product is Product => !!product)

      console.log(`Found ${result.length} of ${requestedIds.length} requested products`)
      return result
    } catch (error) {
      console.error(`Error fetching products by ids:`, error)
      // Return an empty array instead of throwing, so the code can fall back to individual requests
      return []
    }
  },

  /**
   * Get product for cart item
   * @param productId The product ID
   * @returns Promise resolving to a product or null
   */
  async getProductForCartItem(productId: number): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `product-${productId}`
      const cachedItem = productCache.get(cacheKey)

      if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
        console.log(`Using cached product data for cart item ${productId}`)
        return cachedItem.data[0] // Return the first product from the array
      }

      const response = await api.get(`/api/products/${productId}?include=details,variants,images,stock`)
      return response.data
    } catch (error) {
      console.error(`Error fetching product ${productId} for cart:`, error)
      return null
    }
  },

  /**
   * Get products for cart items
   * @param productIds Array of product IDs
   * @returns Promise resolving to a record of products
   */
  async getProductsForCartItems(productIds: number[]): Promise<Record<string, any>> {
    if (!productIds || productIds.length === 0) return {}

    try {
      console.log(`Batch fetching products for cart items: ${productIds.join(", ")}`)

      // Deduplicate product IDs
      const uniqueIds = [...new Set(productIds)]
      const productMap: Record<string, any> = {}

      // Instead of using the batch endpoint which is failing, fetch products individually
      // but use Promise.all to fetch them in parallel
      await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            // First check if we have this product in cache
            const cacheKey = `product-${id}`
            const cachedItem = productCache.get(cacheKey)

            if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
              console.log(`Using cached product data for id ${id}`)
              cachedItem.data.forEach((product: Product) => {
                productMap[id.toString()] = product
              })
              return
            }

            // If not in cache, fetch it
            const product = await this.getProduct(id.toString())
            if (product) {
              productMap[id.toString()] = {
                id: product.id,
                name: product.name,
                slug: product.slug,
                thumbnail_url: product.thumbnail_url || "/placeholder.svg",
                image_urls: product.image_urls || [],
                category: product.category?.name || product.category_id,
                stock: product.stock,
                sku: product.sku,
                price: product.price,
                sale_price: product.sale_price,
              }

              // Update cache
              productCache.set(cacheKey, {
                data: [product], // Cache as an array
                timestamp: Date.now(),
              })
            } else {
              // Create a fallback product if fetch fails
              productMap[id.toString()] = this.createFallbackProduct(id)
            }
          } catch (err) {
            console.error(`Failed to fetch product ${id}:`, err)
            // Create a fallback product for failed fetches
            productMap[id.toString()] = this.createFallbackProduct(id)
          }
        }),
      )

      return productMap
    } catch (error) {
      console.error("Error fetching products for cart items:", error)

      // Fallback: create default products for all IDs
      const productMap: Record<string, any> = {}
      productIds.forEach((id) => {
        productMap[id.toString()] = this.createFallbackProduct(id)
      })

      return productMap
    }
  },

  /**
   * Create a fallback product
   * @param productId The product ID
   * @returns A fallback product object
   */
  createFallbackProduct(productId: number | string): any {
    return {
      id: productId,
      name: `Product ${productId}`,
      slug: `product-${productId}`,
      price: 999,
      sale_price: null,
      stock: 10,
      is_sale: false,
      is_luxury_deal: false,
      description: "Product information is currently being loaded. Please refresh the cart to see complete details.",
      thumbnail_url: "/placeholder.svg",
      image_urls: ["/placeholder.svg"],
      category_id: "unavailable",
      product_type: "regular",
      seller: {
        id: 1,
        name: "Mizizzi Store",
        rating: 4.8,
        verified: true,
        store_name: "Mizizzi Official Store",
        logo_url: "/logo.png",
      },
      sku: `SKU-${productId}`,
    }
  },

  /**
   * Prefetch products by category
   * @param categoryId The category ID
   * @returns Promise resolving to a boolean
   */
  async prefetchProductsByCategory(categoryId: string): Promise<boolean> {
    return prefetchData("/api/products", { category_id: categoryId, limit: 12 })
  },

  /**
   * Prefetch homepage products
   */
  async prefetchHomePageProducts(): Promise<void> {
    try {
      await Promise.allSettled([
        this.prefetchProductsByCategory("featured"),
        prefetchData("/api/products", { flash_sale: true }),
        prefetchData("/api/products", { luxury_deal: true }),
        prefetchData("/api/products", { limit: 12 }),
      ])
    } catch (error) {
      console.error("Error prefetching homepage products:", error)
    }
  },

  /**
   * Get product reviews
   * @param productId The product ID
   * @returns Promise resolving to an array of reviews
   */
  async getProductReviews(productId: number): Promise<any[]> {
    try {
      // Check cache first
      const cacheKey = `product-reviews-${productId}`
      const cachedItem = productReviewsCache.get(cacheKey)

      if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
        console.log(`Using cached reviews for product ${productId}`)
        return Array.isArray(cachedItem.data) ? cachedItem.data : [cachedItem.data]
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mizizzi-ecommerce-1.onrender.com"
      const response = await fetch(`${backendUrl}/api/products/${productId}/reviews`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch reviews: ${response.status}`)
      }

      const data = await response.json()
      const reviews = data.items || data || []

      // Cache the reviews
      const reviewsArray = Array.isArray(reviews) ? reviews : []
      productReviewsCache.set(cacheKey, {
        data: reviewsArray,
        timestamp: Date.now(),
      })

      return reviewsArray
    } catch (error) {
      console.error(`Error fetching reviews for product ${productId}:`, error)
      return []
    }
  },

  /**
   * Get product review summary
   * @param productId The product ID
   * @returns Promise resolving to review summary
   */
  async getProductReviewSummary(productId: number): Promise<any> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mizizzi-ecommerce-1.onrender.com"
      const response = await fetch(`${backendUrl}/api/products/${productId}/reviews/summary`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch review summary: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Error fetching review summary for product ${productId}:`, error)
      return {
        total_reviews: 0,
        average_rating: 0,
        verified_reviews: 0,
        rating_distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
      }
    }
  },

  /**
   * Create a new review
   * @param productId The product ID
   * @param reviewData The review data
   * @returns Promise resolving to the created review
   */
  async createReview(
    productId: number,
    reviewData: {
      rating: number
      title?: string
      comment?: string
    },
  ): Promise<any> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mizizzi-ecommerce-1.onrender.com"
      const token = localStorage.getItem("mizizzi_token")

      if (!token) {
        throw new Error("Authentication required")
      }

      const response = await fetch(`${backendUrl}/api/products/${productId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reviewData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to create review: ${response.status}`)
      }

      const result = await response.json()

      // Clear cache to force refresh
      const cacheKey = `product-reviews-${productId}`
      productReviewsCache.delete(cacheKey)

      return result.review
    } catch (error) {
      console.error(`Error creating review for product ${productId}:`, error)
      throw error
    }
  },

  /**
   * Update a review
   * @param reviewId The review ID
   * @param reviewData The updated review data
   * @returns Promise resolving to the updated review
   */
  async updateReview(
    reviewId: number,
    reviewData: {
      rating?: number
      title?: string
      comment?: string
    },
  ): Promise<any> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mizizzi-ecommerce-1.onrender.com"
      const token = localStorage.getItem("mizizzi_token")

      if (!token) {
        throw new Error("Authentication required")
      }

      const response = await fetch(`${backendUrl}/api/reviews/${reviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reviewData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to update review: ${response.status}`)
      }

      const result = await response.json()
      return result.review
    } catch (error) {
      console.error(`Error updating review ${reviewId}:`, error)
      throw error
    }
  },

  /**
   * Delete a review
   * @param reviewId The review ID
   * @returns Promise resolving to success message
   */
  async deleteReview(reviewId: number): Promise<void> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mizizzi-ecommerce-1.onrender.com"
      const token = localStorage.getItem("mizizzi_token")

      if (!token) {
        throw new Error("Authentication required")
      }

      const response = await fetch(`${backendUrl}/api/reviews/${reviewId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete review: ${response.status}`)
      }
    } catch (error) {
      console.error(`Error deleting review ${reviewId}:`, error)
      throw error
    }
  },

  /**
   * Prefetch images for multiple products
   * @param productIds Array of product IDs
   */
  async prefetchProductImages(productIds: string[]): Promise<void> {
    if (!productIds || productIds.length === 0) return

    // Use the batch service to prefetch images
    imageBatchService.prefetchProductImages(productIds)
  },

  /**
   * Get all categories
   * @returns Promise resolving to an array of categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      // Check cache first
      const cacheKey = "all-categories"
      const now = Date.now()
      const cachedItem = categoriesCache.get(cacheKey)

      if (cachedItem && now - cachedItem.timestamp < CATEGORIES_CACHE_DURATION) {
        console.log("Using cached categories data")
        return cachedItem.data
      }

      const response = await api.get("/api/categories")
      const categories = response.data.items || response.data || []

      // Cache the categories
      categoriesCache.set(cacheKey, {
        data: categories,
        timestamp: now,
      })

      return categories
    } catch (error) {
      console.error("Error fetching categories:", error)
      return []
    }
  },

  /**
   * Get all brands
   * @returns Promise resolving to an array of brands
   */
  async getBrands(): Promise<Brand[]> {
    try {
      // Check cache first
      const cacheKey = "all-brands"
      const now = Date.now()
      const cachedItem = brandsCache.get(cacheKey)

      if (cachedItem && now - cachedItem.timestamp < BRANDS_CACHE_DURATION) {
        console.log("Using cached brands data")
        return cachedItem.data
      }

      const response = await api.get("/api/brands")
      const brands = response.data.items || response.data || []

      // Cache the brands
      brandsCache.set(cacheKey, {
        data: brands,
        timestamp: now,
      })

      return brands
    } catch (error) {
      console.error("Error fetching brands:", error)
      return []
    }
  },

  /**
   * Normalize product prices
   * @param product The product to normalize
   * @returns The normalized product
   */
  normalizeProductPrices(product: any): Product {
    // Convert price to number if it's a string
    if (typeof product.price === "string") {
      product.price = Number.parseFloat(product.price) || 0
    }

    // Ensure price is a valid number
    if (typeof product.price !== "number" || isNaN(product.price) || product.price < 0) {
      console.warn(`Invalid price for product ${product.id}, setting default price`)
      product.price = 0
    }

    // Convert sale_price to number if it's a string
    if (product.sale_price !== undefined && typeof product.sale_price === "string") {
      product.sale_price = Number.parseFloat(product.sale_price) || null
    }

    // Ensure sale_price is a valid number or null
    if (
      product.sale_price !== undefined &&
      product.sale_price !== null &&
      (typeof product.sale_price !== "number" || isNaN(product.sale_price) || product.sale_price < 0)
    ) {
      console.warn(`Invalid sale_price for product ${product.id}, setting to null`)
      product.sale_price = null
    }

    return product
  },

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): {
    products: number
    images: number
    categories: number
    brands: number
    batchServiceStats: any
  } {
    return {
      products: productCache.size,
      images: productImagesCache.size,
      categories: categoriesCache.size,
      brands: brandsCache.size,
      batchServiceStats: imageBatchService.getCacheStats(),
    }
  },

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    productCache.clear()
    productImagesCache.clear()
    categoriesCache.clear()
    brandsCache.clear()
    imageBatchService.clearCache()
    console.log("All caches cleared")
  },
}
