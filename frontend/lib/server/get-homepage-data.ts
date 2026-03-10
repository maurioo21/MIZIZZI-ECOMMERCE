import { cache } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://mizizzi-ecommerce-1.onrender.com"

// Helper to normalize image URLs - prioritizes Cloudinary URLs and handles backend endpoints
function normalizeImageUrl(url: string | undefined | null): string | undefined {
  if (!url || url === "null" || url === "undefined" || url.trim() === "") {
    return undefined
  }
  
  // If it's already a Cloudinary URL (has https and domain), return as-is (highest priority)
  if (url.includes("res.cloudinary.com")) {
    return url
  }
  
  // If it's already an http/https URL (other than Cloudinary), return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  
  // If it's a data URL, return as-is
  if (url.startsWith("data:")) {
    return url
  }
  
  // If it's a relative path starting with /, construct full backend URL
  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`
  }
  
  // Fallback - return as-is
  return url
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
      console.log("[Homepage] Successfully loaded homepage data")
      console.log("[Homepage] Categories:", data.categories?.length || 0)
      if (data.categories && data.categories.length > 0) {
        console.log("[Homepage] First category:", JSON.stringify(data.categories[0], null, 2))
      }
      console.log("[Homepage] Feature Cards:", data.feature_cards?.length || 0)
      console.log("[Homepage] Flash Sales:", data.flash_sale_products?.length || 0)
      console.log("[Homepage] Luxury Products:", data.luxury_products?.length || 0)
      console.log("[Homepage] Contact CTA Slides:", data.contact_cta_slides?.length || 0)
      
      // Transform API response to match frontend expectations and ensure image URLs are included
      const categories = Array.isArray(data.categories) 
        ? data.categories.map((cat: any) => ({
            ...cat,
            image_url: normalizeImageUrl(cat.image_url),
            banner_url: normalizeImageUrl(cat.banner_url),
          }))
        : []

      return {
        categories,
        carousel_items: data.carousel_items || [], // Some backends return this
        banner_slides: data.banner_slides || [], // Some backends return this instead
        contact_cta_slides: data.contact_cta_slides || [],
        daily_finds: data.daily_finds || [],
        feature_cards: data.feature_cards || [],
        flash_sale_products: data.flash_sale_products || [],
        luxury_products: data.luxury_products || [],
        new_arrivals: data.new_arrivals || [],
        premium_experiences: data.premium_experiences || [],
        product_showcase: data.product_showcase || [],
        top_picks: data.top_picks || [],
        trending_products: data.trending_products || [],
        all_products: data.all_products || {
          products: [],
          has_more: false,
          total: 0,
          page: 1,
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
