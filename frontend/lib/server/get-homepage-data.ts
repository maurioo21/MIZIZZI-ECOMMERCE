import { cache } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://mizizzi-ecommerce-1.onrender.com"

// Helper to optimize Cloudinary URLs with CDN parameters for faster delivery
function optimizeCloudinaryUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  
  // Only optimize Cloudinary URLs
  if (!url.includes("res.cloudinary.com")) {
    return normalizeImageUrl(url)
  }
  
  try {
    // For Cloudinary URLs, add CDN optimization parameters
    // This ensures fast delivery with automatic format optimization
    const uploadIndex = url.indexOf("/upload/")
    if (uploadIndex === -1) return url
    
    const beforeUpload = url.substring(0, uploadIndex + "/upload/".length)
    const afterUpload = url.substring(uploadIndex + "/upload/".length)
    
    // Add transformations for optimal performance and responsiveness
    // w_auto = dynamic width based on device, q_auto = dynamic quality, f_auto = optimal format
    return `${beforeUpload}w_auto,q_auto,f_auto/${afterUpload}`
  } catch {
    return url
  }
}

export const getHomepageData = cache(async () => {
  try {
    console.log("[Homepage] Fetching from:", `${API_BASE_URL}/api/homepage`)
    
    const response = await fetch(`${API_BASE_URL}/api/homepage`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      next: { 
        revalidate: 30, // Reduced from 60 to 30 seconds for faster updates
        tags: ["homepage", "feature-cards"] // Allow targeted invalidation
      },
    })

    if (!response.ok) {
      console.error(`[Homepage] API response not ok: ${response.status}`)
      return getHomepageDataFallback()
    }

    const result = await response.json()
    console.log("[Homepage] API Response status:", result.status)

    if (result.status === "success" && result.data) {
      const data = result.data
      
      // Transform API response to match frontend expectations and ensure image URLs are optimized for CDN
      const categories = Array.isArray(data.categories) 
        ? data.categories.map((cat: any) => ({
            ...cat,
            image_url: optimizeCloudinaryUrl(cat.image_url),
            banner_url: optimizeCloudinaryUrl(cat.banner_url),
          }))
        : []
      
      // Optimize product images for fast CDN delivery
      const optimizeProducts = (products: any[]) => {
        return Array.isArray(products)
          ? products.map((product: any) => ({
              ...product,
              image_url: optimizeCloudinaryUrl(product.image_url),
              images: Array.isArray(product.images)
                ? product.images.map((img: any) => ({
                    ...img,
                    url: optimizeCloudinaryUrl(img.url),
                    secure_url: optimizeCloudinaryUrl(img.secure_url),
                  }))
                : [],
            }))
          : []
      }

      return {
        categories,
        carousel_items: data.carousel_items || [],
        banner_slides: data.banner_slides || [],
        contact_cta_slides: data.contact_cta_slides || [],
        daily_finds: optimizeProducts(data.daily_finds || []),
        feature_cards: data.feature_cards || [],
        flash_sale_products: optimizeProducts(data.flash_sale_products || []),
        luxury_products: optimizeProducts(data.luxury_products || []),
        new_arrivals: optimizeProducts(data.new_arrivals || []),
        premium_experiences: optimizeProducts(data.premium_experiences || []),
        product_showcase: optimizeProducts(data.product_showcase || []),
        top_picks: optimizeProducts(data.top_picks || []),
        trending_products: optimizeProducts(data.trending_products || []),
        all_products: {
          products: optimizeProducts(data.all_products?.products || []),
          has_more: data.all_products?.has_more || false,
          total: data.all_products?.total || 0,
          page: data.all_products?.page || 1,
        },
      }
    }

    console.error("[Homepage] Unexpected response structure:", JSON.stringify(result).slice(0, 200))
    return getHomepageDataFallback()
  } catch (error) {
    console.error("[Homepage] Fetch error:", error instanceof Error ? error.message : String(error))
    return getHomepageDataFallback()
  }
})

function getHomepageDataFallback() {
  return {
    categories: [],
    carousel_items: [],
    banner_slides: [],
    contact_cta_slides: [],
    daily_finds: [],
    feature_cards: [],
    flash_sale_products: [],
    luxury_products: [],
    new_arrivals: [],
    premium_experiences: [],
    product_showcase: [],
    top_picks: [],
    trending_products: [],
    all_products: {
      products: [],
      has_more: false,
      total: 0,
      page: 1,
    },
  }
}
