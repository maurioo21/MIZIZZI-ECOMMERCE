'use client'

import { useState, useEffect } from 'react'
import type { Category } from '@/lib/server/get-categories'

/**
 * Simple categories hook - uses server data directly
 * No localStorage or sessionStorage caching
 * Redis handles caching on the backend
 */
export function useCategoriesCache(serverData: Category[]) {
  const [categories, setCategories] = useState<Category[]>(serverData)

  useEffect(() => {
    // Always use fresh server data
    setCategories(serverData)
  }, [serverData])

  return {
    categories,
    isFromCache: false, // Always fresh from server/Redis
  }
}

/**
 * Clear categories cache (no-op since we don't cache on frontend)
 */
export function clearCategoriesCache() {
  // No frontend cache to clear - Redis handles backend caching
}

/**
 * Get cached categories (returns null - frontend doesn't cache)
 */
export function getCachedCategories(): Category[] | null {
  return null
}

