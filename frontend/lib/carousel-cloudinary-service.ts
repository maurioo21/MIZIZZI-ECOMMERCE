import type { CarouselBanner } from "@/types/carousel-admin"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const CACHE_KEY_PREFIX = "carousel_cache_"
const CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

interface CacheEntry {
  data: CarouselBanner[]
  timestamp: number
}

/**
 * Carousel service with Cloudinary CDN integration
 * Features:
 * - Local cache for instant carousel display
 * - Background revalidation for fresh data
 * - Cloudinary URL optimization
 * - Error recovery with cached fallback
 */

// In-memory cache
const memoryCache = new Map<string, CacheEntry>()

// Get from localStorage cache
function getLocalCache(key: string): CarouselBanner[] | null {
  try {
    if (typeof window === "undefined") return null
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + key)
    if (!cached) return null

    const entry: CacheEntry = JSON.parse(cached)
    const now = Date.now()

    // Return cache if still valid
    if (now - entry.timestamp < CACHE_DURATION) {
      return entry.data
    }

    // Clear expired cache
    localStorage.removeItem(CACHE_KEY_PREFIX + key)
  } catch (error) {
    console.error("[v0] Error reading carousel cache:", error)
  }
  return null
}

// Save to localStorage cache
function saveLocalCache(key: string, data: CarouselBanner[]): void {
  try {
    if (typeof window === "undefined") return
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry))
  } catch (error) {
    console.error("[v0] Error saving carousel cache:", error)
  }
}

// Get from memory cache
function getMemoryCache(key: string): CarouselBanner[] | null {
  const cached = memoryCache.get(key)
  if (!cached) return null

  const now = Date.now()
  if (now - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  memoryCache.delete(key)
  return null
}

// Save to memory cache
function saveMemoryCache(key: string, data: CarouselBanner[]): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

// Optimize Cloudinary URLs for CDN delivery
export function optimizeCloudinaryUrl(url: string, width: number = 1400, height: number = 500): string {
  if (!url || !url.includes("cloudinary.com")) return url

  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split("/")
    const imageFileName = pathParts[pathParts.length - 1]
    const cloudName = urlObj.hostname.split(".")[0]

    // Construct optimized URL with auto format and quality
    return `https://res.cloudinary.com/${cloudName}/image/upload/w_${width},h_${height},c_fill,q_auto,f_auto,dpr_auto/${imageFileName}`
  } catch (error) {
    console.error("[v0] Error optimizing Cloudinary URL:", error)
    return url
  }
}

// Get carousel banners with caching and background revalidation
export async function getCarouselBanners(
  position: string = "homepage"
): Promise<CarouselBanner[]> {
  const cacheKey = `banners_${position}`
  
  // 1. Try memory cache first (fastest)
  const memCached = getMemoryCache(cacheKey)
  if (memCached) return memCached

  // 2. Try localStorage cache (instant for returning users)
  const localCached = getLocalCache(cacheKey)
  if (localCached) {
    // Save to memory for faster subsequent accesses
    saveMemoryCache(cacheKey, localCached)
    return localCached
  }

  // 3. Fetch fresh data from server
  try {
    const response = await fetch(`${API_BASE_URL}/api/carousel/banners?position=${position}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Enable caching for this request
      cache: "default",
    })

    if (!response.ok) {
      // If fetch fails, try to use any available cache
      const fallback = localCached || getMemoryCache(cacheKey)
      if (fallback) {
        return fallback
      }
      throw new Error(`Failed to fetch carousel: ${response.status}`)
    }

    const data = await response.json()
    const banners: CarouselBanner[] = data.banners || []

    // Optimize all carousel image URLs
    const optimizedBanners = banners.map((banner) => ({
      ...banner,
      image_url: optimizeCloudinaryUrl(banner.image_url),
    }))

    // Cache the results for future use
    saveMemoryCache(cacheKey, optimizedBanners)
    saveLocalCache(cacheKey, optimizedBanners)

    return optimizedBanners
  } catch (error) {
    console.error("[v0] Error fetching carousel banners:", error)
    
    // Return cached data if fetch fails
    const fallback = localCached || getMemoryCache(cacheKey) || []
    if (fallback.length > 0) {
      return fallback
    }
    
    return []
  }
}

// Get single banner
export async function getCarouselBanner(bannerId: number): Promise<CarouselBanner | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/carousel/banners/${bannerId}`, {
      cache: "default",
    })

    if (!response.ok) return null

    const data = await response.json()
    const banner: CarouselBanner = data.banner

    // Optimize image URL
    return {
      ...banner,
      image_url: optimizeCloudinaryUrl(banner.image_url),
    }
  } catch (error) {
    console.error("[v0] Error fetching carousel banner:", error)
    return null
  }
}

// Track carousel views (for analytics)
export async function trackCarouselView(bannerId: number): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/carousel/banners/${bannerId}/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("[v0] Error tracking carousel view:", error)
  }
}

// Track carousel clicks
export async function trackCarouselClick(bannerId: number): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/carousel/banners/${bannerId}/click`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("[v0] Error tracking carousel click:", error)
  }
}

// Clear cache
export function clearCarouselCache(position?: string): void {
  if (typeof window === "undefined") return

  if (position) {
    const cacheKey = `banners_${position}`
    memoryCache.delete(cacheKey)
    localStorage.removeItem(CACHE_KEY_PREFIX + cacheKey)
  } else {
    // Clear all carousel caches
    memoryCache.clear()
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  }
}
