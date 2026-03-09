/**
 * Cache Management Service
 * Handles all cache operations via Flask backend API endpoints
 */

import type {
  CacheStatus,
  InvalidateCacheRequest,
  InvalidateGroupRequest,
  InvalidateAllRequest,
  CacheInvalidationResponse,
  InvalidationHistoryResponse,
  CacheRebuildRequest,
  CacheRebuildResponse,
} from "@/types/cache-management"
import { CacheGroupType } from "@/types/cache-management"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

console.log("[v0] Cache Management Service - API_BASE_URL:", API_BASE_URL)

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem("mizizzi_token") || localStorage.getItem("admin_token") || ""
}

/**
 * Fetch with authentication and error handling
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken()

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const url = `${API_BASE_URL}${endpoint}`
  console.log("[v0] Cache Management - Fetching:", url)

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    })

    if (response.status === 401) {
      throw new Error("Unauthorized: Please login again")
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      const errorMessage = error.message || `Request failed: ${response.status}`
      
      // Provide more helpful error messages
      if (response.status === 404) {
        throw new Error(`Endpoint not found: ${endpoint}. Please ensure the backend is properly configured.`)
      }
      
      throw new Error(errorMessage)
    }

    return await response.json()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Cache Management] API Error at ${endpoint}:`, errorMsg)
    throw error
  }
}

export const cacheManagementService = {
  /**
   * Get current cache status and metadata
   */
  async getCacheStatus(): Promise<CacheStatus> {
    return fetchWithAuth<CacheStatus>("/api/admin/cache/status")
  },

  /**
   * Invalidate a single cache by pattern
   */
  async invalidateCache(pattern: string): Promise<CacheInvalidationResponse> {
    const payload: InvalidateCacheRequest = { pattern }
    return fetchWithAuth<CacheInvalidationResponse>("/api/admin/cache/invalidate", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  /**
   * Invalidate a cache group (critical, deferred, homepage, or all)
   */
  async invalidateCacheGroup(group: CacheGroupType): Promise<CacheInvalidationResponse> {
    const payload: InvalidateGroupRequest = { group }
    return fetchWithAuth<CacheInvalidationResponse>("/api/admin/cache/invalidate-group", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  /**
   * Invalidate all caches (requires confirmation)
   */
  async invalidateAllCaches(confirmed: boolean = true): Promise<CacheInvalidationResponse> {
    const payload: InvalidateAllRequest = { confirmed }
    return fetchWithAuth<CacheInvalidationResponse>("/api/admin/cache/invalidate-all", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  /**
   * Rebuild homepage caches
   */
  async rebuildCaches(force: boolean = false): Promise<CacheRebuildResponse> {
    const payload: CacheRebuildRequest = { force }
    return fetchWithAuth<CacheRebuildResponse>("/api/admin/cache/rebuild", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  /**
   * Get cache invalidation history
   */
  async getInvalidationHistory(page: number = 1, perPage: number = 50): Promise<InvalidationHistoryResponse> {
    return fetchWithAuth<InvalidationHistoryResponse>(
      `/api/admin/cache/history?page=${page}&per_page=${perPage}`
    )
  },

  /**
   * Invalidate multiple cache groups at once
   */
  async invalidateMultipleGroups(groups: CacheGroupType[]): Promise<CacheInvalidationResponse> {
    const results: CacheInvalidationResponse[] = []
    let totalDeleted = 0
    const allAffected: string[] = []

    for (const group of groups) {
      try {
        const result = await this.invalidateCacheGroup(group)
        results.push(result)
        totalDeleted += result.deletedCount || 0
        if (result.affectedGroups) {
          allAffected.push(...result.affectedGroups)
        }
      } catch (error) {
        console.error(`Failed to invalidate group ${group}:`, error)
      }
    }

    const success = results.every((r) => r.success)
    return {
      success,
      message: success
        ? `Invalidated ${groups.length} cache group(s)`
        : `Partially invalidated cache groups (${results.filter((r) => r.success).length}/${groups.length} succeeded)`,
      deletedCount: totalDeleted,
      affectedGroups: [...new Set(allAffected)],
      timestamp: new Date().toISOString(),
    }
  },

  /**
   * Invalidate caches based on cache group types array
   */
  async invalidateCachesByGroups(groups: CacheGroupType[]): Promise<CacheInvalidationResponse> {
    // If "all" is in the list, invalidate everything
    if (groups.includes(CacheGroupType.ALL)) {
      return this.invalidateAllCaches(true)
    }

    return this.invalidateMultipleGroups(groups)
  },

  /**
   * Check if cache management service is available (check connectivity)
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.getCacheStatus()
      return true
    } catch (error) {
      console.warn("Cache management service unavailable:", error)
      return false
    }
  },
}

export default cacheManagementService
