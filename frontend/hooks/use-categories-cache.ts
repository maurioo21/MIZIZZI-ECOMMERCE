'use client'

import { useEffect, useRef, useState } from 'react'
import type { Category } from '@/lib/server/get-categories'
import { recordCacheMetric } from '@/lib/performance-metrics'

const CACHE_KEY = 'mizizzi_categories_cache'
const CACHE_EXPIRY_KEY = 'mizizzi_categories_cache_expiry'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds (reduced from 24h for faster admin updates)

interface CacheEntry {
  data: Category[]
  timestamp: number
}

/**
 * 3-Layer Browser Cache for Categories
 * 
 * Layer 1: sessionStorage - Fast, same-session persistence (<50ms)
 * Layer 2: localStorage - Cross-session persistence (24h TTL)
 * Layer 3: API fallback - Fresh data if cache expired
 * 
 * Mimics how Jumia/Shopee handle category caching
 */
export function useCategoriesCache(serverData: Category[]) {
  const [categories, setCategories] = useState<Category[]>(serverData)
  const [isFromCache, setIsFromCache] = useState(false)
  const cacheChecked = useRef(false)

  useEffect(() => {
    // Prevent duplicate cache checks on mount
    if (cacheChecked.current) return
    cacheChecked.current = true

    // Only run on client side
    if (typeof window === 'undefined') return

    const startTime = performance.now()

    try {
      // Layer 1: Check sessionStorage (fastest - same session)
      const sessionCache = sessionStorage.getItem(CACHE_KEY)
      if (sessionCache) {
        const parsed: CacheEntry = JSON.parse(sessionCache)
        // Validate cached data structure
        if (Array.isArray(parsed.data) && parsed.data.length > 0) {
          setCategories(parsed.data)
          setIsFromCache(true)
          recordCacheMetric(true, 'sessionStorage', performance.now() - startTime)
          return
        }
      }

      // Layer 2: Check localStorage (persistent - cross session)
      const localCache = localStorage.getItem(CACHE_KEY)
      const localExpiry = localStorage.getItem(CACHE_EXPIRY_KEY)

      if (localCache && localExpiry) {
        const now = Date.now()
        const expiryTime = parseInt(localExpiry, 10)

        // Cache is still valid (within 24h TTL)
        if (now < expiryTime) {
          const parsed: CacheEntry = JSON.parse(localCache)
          if (Array.isArray(parsed.data) && parsed.data.length > 0) {
            setCategories(parsed.data)
            setIsFromCache(true)

            // Also save to sessionStorage for faster subsequent loads
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
              data: parsed.data,
              timestamp: parsed.timestamp,
            }))
            recordCacheMetric(true, 'localStorage', performance.now() - startTime)
            return
          }
        } else {
          // Cache expired, clear it
          localStorage.removeItem(CACHE_KEY)
          localStorage.removeItem(CACHE_EXPIRY_KEY)
        }
      }

      // Layer 3: Use fresh server data and cache it
      if (serverData && serverData.length > 0) {
        const cacheEntry: CacheEntry = {
          data: serverData,
          timestamp: Date.now(),
        }

        // Store in both sessionStorage (fast) and localStorage (persistent)
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry))
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry))
        localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_TTL).toString())
        recordCacheMetric(false, 'server', performance.now() - startTime)
      }
    } catch (error) {
      // Gracefully handle storage errors (quota exceeded, etc)
      console.warn('[v0] Cache storage error:', error)
      // Continue with server data if caching fails
    }
  }, [serverData])

  return {
    categories,
    isFromCache,
  }
}

/**
 * Clear categories cache (called on logout or manual refresh)
 */
export function clearCategoriesCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_EXPIRY_KEY)
  } catch (error) {
    console.warn('[v0] Error clearing cache:', error)
  }
}

/**
 * Get cached categories synchronously (for debugging/testing)
 */
export function getCachedCategories(): Category[] | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed: CacheEntry = JSON.parse(cached)
      return Array.isArray(parsed.data) ? parsed.data : null
    }
    return null
  } catch (error) {
    console.warn('[v0] Error reading cache:', error)
    return null
  }
}
