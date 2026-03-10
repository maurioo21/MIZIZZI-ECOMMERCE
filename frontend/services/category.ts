import api from "@/lib/api"

export interface Category {
  id: number
  name: string
  slug: string
  description?: string
  image_url?: string
  banner_url?: string
  is_featured?: boolean
  parent_id?: number | null
  subcategories?: Category[]
  parent?: Category | null
  products_count?: number
  sort_order?: number
  is_active?: boolean
}

// Create a cache for API responses with expiry
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // Increased to 5 minutes

// Helper to strip nullish values from params
function sanitizeParams<T extends Record<string, any>>(params: T): Partial<T> {
  const out: Record<string, any> = {}
  Object.keys(params || {}).forEach((key) => {
    const val = params[key]
    if (val !== null && val !== undefined) {
      out[key] = val
    }
  })
  return out as Partial<T>
}

const STORAGE_KEY = "mizizzi_category_service_cache"

const loadCacheFromStorage = () => {
  if (typeof window === "undefined") return
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      Object.entries(parsed).forEach(([key, value]: [string, any]) => {
        // Only restore if not too old (30 min max)
        if (Date.now() - value.timestamp < 30 * 60 * 1000) {
          cache.set(key, value)
        }
      })
    }
  } catch (e) {
    // Ignore errors
  }
}

const saveCacheToStorage = () => {
  if (typeof window === "undefined") return
  try {
    const cacheObj: Record<string, any> = {}
    cache.forEach((value, key) => {
      cacheObj[key] = value
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheObj))
  } catch (e) {
    // Ignore errors
  }
}

// Initialize cache from storage
if (typeof window !== "undefined") {
  loadCacheFromStorage()
}

const getBaseUrl = () => {
  return (
    process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://mizizzi-ecommerce-1.onrender.com"
  )
}

const normalizeImageUrl = (url: string | undefined | null): string | undefined => {
  if (!url) return undefined
  // Already absolute URL or data URL - return as is
  if (url.startsWith("http") || url.startsWith("data:")) return url
  // Relative URL starting with / - prepend base URL
  if (url.startsWith("/")) {
    return `${getBaseUrl()}${url}`
  }
  return url
}

const normalizeCategoryImages = (category: any): Category => {
  return {
    ...category,
    image_url: normalizeImageUrl(category.image_url),
    banner_url: normalizeImageUrl(category.banner_url),
    products_count: category.products_count ?? 0,
  }
}

const CATEGORIES_BASE = "/api/categories"

const isCacheValid = (cacheKey: string): boolean => {
  const cached = cache.get(cacheKey)
  if (!cached) return false
  return Date.now() - cached.timestamp < CACHE_TTL
}

export const categoryService = {
  async getCategories(params: Record<string, any> = {}, forceRefresh = false): Promise<Category[]> {
    try {
      const cleanParams = sanitizeParams({
        page: params.page || 1,
        per_page: params.per_page || 100,
        parent_id: params.parent_id !== undefined ? params.parent_id : undefined,
        featured: params.featured !== undefined ? params.featured : undefined,
        ...params,
      })

      const cacheKey = `categories-${JSON.stringify(cleanParams)}`

      if (!forceRefresh && isCacheValid(cacheKey)) {
        return cache.get(cacheKey)!.data
      }

      const staleData = cache.get(cacheKey)?.data

      const baseUrl = getBaseUrl()
      const response = await api.get(`${baseUrl}${CATEGORIES_BASE}`, {
        params: cleanParams,
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      let data = response.data?.items ?? response.data ?? []

      if (data && typeof data === "object" && !Array.isArray(data) && data.categories) {
        data = data.categories
      }

      if (!Array.isArray(data)) {
        if (staleData) return staleData
        data = []
      }

      data = data.map(normalizeCategoryImages)

      cache.set(cacheKey, { data, timestamp: Date.now() })
      saveCacheToStorage()

      return data
    } catch (error) {
      console.error("[v0] Error fetching categories:", error)
      const cacheKey = `categories-${JSON.stringify(params)}`
      const cachedData = cache.get(cacheKey)?.data
      if (cachedData) return cachedData
      return []
    }
  },

  async getFeaturedCategories(): Promise<Category[]> {
    return this.getCategories({ featured: true })
  },

  async getCategoryBySlug(slug: string, forceRefresh = false): Promise<Category | null> {
    if (!slug) return null
    try {
      const cacheKey = `category-${slug}`
      if (!forceRefresh && isCacheValid(cacheKey)) {
        console.log("[v0] getCategoryBySlug - Using cached data for slug:", slug)
        return cache.get(cacheKey)!.data
      }

      const url = `${getBaseUrl()}${CATEGORIES_BASE}/slug/${encodeURIComponent(slug)}`
      console.log("[v0] getCategoryBySlug - Fetching from URL:", url, { slug, forceRefresh })
      const response = await api.get(url)
      const data = response.data ?? null
      console.log("[v0] getCategoryBySlug - Response data:", { slug, dataId: data?.id, dataName: data?.name })

      const normalizedData = data ? normalizeCategoryImages(data) : null

      cache.set(cacheKey, { data: normalizedData, timestamp: Date.now() })
      saveCacheToStorage()
      return normalizedData
    } catch (error) {
      console.error(`[v0] Error fetching category with slug ${slug}:`, error)
      return null
    }
  },

  async getSubcategories(parentId: number): Promise<Category[]> {
    try {
      const cacheKey = `subcategories-${parentId}`
      if (isCacheValid(cacheKey)) return cache.get(cacheKey)!.data

      const response = await api.get(`${getBaseUrl()}${CATEGORIES_BASE}`, {
        params: { parent_id: parentId },
      })
      let data = response.data?.items ?? response.data ?? []

      if (data && typeof data === "object" && !Array.isArray(data) && data.categories) {
        data = data.categories
      }

      if (!Array.isArray(data)) {
        data = []
      }

      data = data.map(normalizeCategoryImages)

      // Remove duplicates by ID
      const uniqueMap = new Map<number, Category>()
      data.forEach((cat: Category) => {
        if (!uniqueMap.has(cat.id)) {
          uniqueMap.set(cat.id, cat)
        }
      })
      const uniqueData = Array.from(uniqueMap.values())

      cache.set(cacheKey, { data: uniqueData, timestamp: Date.now() })
      saveCacheToStorage()
      return uniqueData
    } catch (error) {
      console.error(`[v0] Error fetching subcategories for parent ${parentId}:`, error)
      return []
    }
  },

  async getRelatedCategories(categoryId: number): Promise<Category[]> {
    if (!categoryId && categoryId !== 0) return []
    const tryEndpoints = [
      `${CATEGORIES_BASE}/${encodeURIComponent(String(categoryId))}/related/`,
      `${CATEGORIES_BASE}/${encodeURIComponent(String(categoryId))}/related`,
      `${CATEGORIES_BASE}/related/`,
    ] as const

    for (const url of tryEndpoints.slice(0, 2)) {
      try {
        const res = await api.get(`${getBaseUrl()}${url}`)
        let items = res.data?.items ?? res.data ?? []
        if (Array.isArray(items)) {
          const normalized = items.map(normalizeCategoryImages)
          // Remove duplicates by ID
          const uniqueMap = new Map<number, Category>()
          normalized.forEach((cat) => {
            if (!uniqueMap.has(cat.id)) {
              uniqueMap.set(cat.id, cat)
            }
          })
          return Array.from(uniqueMap.values())
        }
      } catch {
        // continue to next pattern
      }
    }

    try {
      const res = await api.get(`${getBaseUrl()}${tryEndpoints[2]}`, { params: { category_id: categoryId } })
      let items = res.data?.items ?? res.data ?? []
      if (Array.isArray(items)) {
        const normalized = items.map(normalizeCategoryImages)
        // Remove duplicates by ID
        const uniqueMap = new Map<number, Category>()
        normalized.forEach((cat) => {
          if (!uniqueMap.has(cat.id)) {
            uniqueMap.set(cat.id, cat)
          }
        })
        return Array.from(uniqueMap.values())
      }
      return []
    } catch (error) {
      return []
    }
  },

  async getRecommendedCategories(
    currentCategoryId: number,
    currentCategoryName: string,
    allCategories: Category[]
  ): Promise<Category[]> {
    // Define category relationships based on common e-commerce patterns
    const categoryKeywords: Record<string, string[]> = {
      fashion: ["clothing", "apparel", "dress", "shirt", "pants", "shoes", "jacket", "coat", "sweater", "skirt"],
      shoes: ["footwear", "sneakers", "boots", "sandals", "heels", "slippers", "loafers"],
      bags: ["handbags", "backpacks", "luggage", "wallets", "purse", "satchel", "clutch"],
      electronics: ["gadgets", "phones", "computers", "laptop", "camera", "headphones", "audio", "tech"],
      home: ["furniture", "decor", "kitchen", "bedding", "lighting", "rugs", "curtains"],
      beauty: ["cosmetics", "makeup", "skincare", "haircare", "fragrance", "perfume", "wellness"],
      sports: ["athletic", "fitness", "outdoor", "gym", "running", "yoga", "sports"],
      books: ["reading", "literature", "educational", "learning"],
      toys: ["games", "children", "kids", "baby", "dolls", "puzzles"],
      jewelry: ["accessories", "rings", "necklaces", "bracelets", "earrings", "watches"],
    }

    // Find matching categories based on keyword similarity
    const currentNameLower = currentCategoryName.toLowerCase()
    
    // Find the best matching keyword group for current category
    let matchedKeywords: string[] = []
    for (const [_key, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => currentNameLower.includes(kw) || kw.includes(currentNameLower.split(' ')[0]))) {
        matchedKeywords = keywords
        break
      }
    }

    // If no keywords found, use the first word of category name
    if (matchedKeywords.length === 0) {
      const firstWord = currentNameLower.split(' ')[0]
      matchedKeywords = [firstWord]
    }

    // Score and filter categories
    const scoredCategories = allCategories
      .filter(cat => cat.id !== currentCategoryId) // Exclude current category
      .map(cat => {
        const catNameLower = cat.name.toLowerCase()
        let score = 0

        // Check for keyword matches
        matchedKeywords.forEach(keyword => {
          if (catNameLower.includes(keyword)) {
            score += 10
          }
        })

        // Check for word overlap
        const currentWords = currentNameLower.split(/\s+/)
        const catWords = catNameLower.split(/\s+/)
        const overlap = currentWords.filter(word => catWords.some(cw => cw.includes(word) || word.includes(cw)))
        score += overlap.length * 5

        // Boost categories with products
        if ((cat.products_count || 0) > 0) {
          score += 2
        }

        return { category: cat, score }
      })
      .sort((a, b) => b.score - a.score)
      .filter(item => item.score > 0) // Only include categories with positive score
      .slice(0, 12) // Limit to 12 recommendations
      .map(item => item.category)

    return scoredCategories
  },

  clearCache() {
    cache.clear()
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem("mizizzi_categories_cache")
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("categories")
    }
  },
}
