/**
 * useCacheManagement Hook
 * Custom hook for managing cache operations and state
 */

import { useState, useCallback, useEffect } from "react"
import cacheManagementService from "@/services/cache-management"
import type { CacheStatus, CacheGroupType, InvalidationHistoryResponse } from "@/types/cache-management"

interface UseCacheManagementOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useCacheManagement(options: UseCacheManagementOptions = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options

  const [cacheStatus, setCacheStatus] = useState<CacheStatus | undefined>(undefined)
  const [history, setHistory] = useState<InvalidationHistoryResponse | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isServiceAvailable, setIsServiceAvailable] = useState(true)

  // Fetch cache status
  const fetchCacheStatus = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const status = await cacheManagementService.getCacheStatus()
      setCacheStatus(status)
      setIsServiceAvailable(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch cache status"
      setError(message)
      setIsServiceAvailable(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch invalidation history
  const fetchHistory = useCallback(async (page: number = 1, perPage: number = 50) => {
    try {
      const data = await cacheManagementService.getInvalidationHistory(page, perPage)
      setHistory(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch history"
      setError(message)
    }
  }, [])

  // Invalidate single cache
  const invalidateCache = useCallback(async (pattern: string) => {
    setError(undefined)
    try {
      const result = await cacheManagementService.invalidateCache(pattern)
      await fetchCacheStatus() // Refresh status
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invalidate cache"
      setError(message)
      throw err
    }
  }, [fetchCacheStatus])

  // Invalidate cache group
  const invalidateCacheGroup = useCallback(async (group: CacheGroupType) => {
    setError(undefined)
    try {
      const result = await cacheManagementService.invalidateCacheGroup(group)
      await fetchCacheStatus() // Refresh status
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invalidate cache group"
      setError(message)
      throw err
    }
  }, [fetchCacheStatus])

  // Invalidate multiple groups
  const invalidateMultipleGroups = useCallback(async (groups: CacheGroupType[]) => {
    setError(undefined)
    try {
      const result = await cacheManagementService.invalidateMultipleGroups(groups)
      await fetchCacheStatus() // Refresh status
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invalidate cache groups"
      setError(message)
      throw err
    }
  }, [fetchCacheStatus])

  // Invalidate all caches
  const invalidateAllCaches = useCallback(async (confirmed: boolean = true) => {
    setError(undefined)
    try {
      const result = await cacheManagementService.invalidateAllCaches(confirmed)
      await fetchCacheStatus() // Refresh status
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invalidate all caches"
      setError(message)
      throw err
    }
  }, [fetchCacheStatus])

  // Rebuild caches
  const rebuildCaches = useCallback(async (force: boolean = false) => {
    setError(undefined)
    try {
      const result = await cacheManagementService.rebuildCaches(force)
      await fetchCacheStatus() // Refresh status
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rebuild caches"
      setError(message)
      throw err
    }
  }, [fetchCacheStatus])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    // Initial fetch
    fetchCacheStatus()

    // Set up interval
    const interval = setInterval(fetchCacheStatus, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, fetchCacheStatus, refreshInterval])

  return {
    cacheStatus,
    history,
    isLoading,
    error,
    isServiceAvailable,
    fetchCacheStatus,
    fetchHistory,
    invalidateCache,
    invalidateCacheGroup,
    invalidateMultipleGroups,
    invalidateAllCaches,
    rebuildCaches,
  }
}
