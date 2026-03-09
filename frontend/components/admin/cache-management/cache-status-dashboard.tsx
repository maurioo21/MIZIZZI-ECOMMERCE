'use client'

import { useEffect, useState } from 'react'
import type { CacheStatus } from '@/types/cache-management'
import { AlertCircle, CheckCircle2, RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CacheStatusDashboardProps {
  status?: CacheStatus
  isLoading: boolean
  error?: string
}

function formatMemory(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

function formatLastUpdated(timestamp?: string): string {
  if (!timestamp) return 'Never'
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid timestamp'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    
    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`
    
    return date.toLocaleString()
  } catch {
    return 'Invalid date'
  }
}

export default function CacheStatusDashboard({ status, isLoading, error }: CacheStatusDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefreshIn, setAutoRefreshIn] = useState<number>(0)

  useEffect(() => {
    if (!isLoading && autoRefreshIn === 0) {
      setAutoRefreshIn(30)
    }

    if (autoRefreshIn === 0) return

    const interval = setInterval(() => {
      setAutoRefreshIn((prev) => (prev > 1 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [isLoading, autoRefreshIn])

  const isConnected = status?.connected === true
  const memoryUsage = status?.memory_usage || 0
  const keysCount = status?.keys_count || 0
  const cacheGroupsCount = status?.cache_groups?.length || 0
  const cacheType = (status as any)?.type || 'unknown'
  const statusMessage = status?.message || error || 'Unable to connect to Redis cache service.'

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className={cn(
          'px-6 py-4 border-b',
          isConnected ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Cache Connection Status</p>
                    <p className="text-lg font-bold text-emerald-600">Connected & Active</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 animate-pulse">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Cache Connection Status</p>
                    <p className="text-lg font-bold text-red-600">Disconnected</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Last Updated</p>
              <p className="text-sm font-medium text-gray-900">{formatLastUpdated(status?.last_updated)}</p>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {!isConnected && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-700">
              {statusMessage}
            </p>
          </div>
        )}
        
        {isConnected && cacheType === 'in-memory' && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-100">
            <p className="text-sm text-amber-700">
              <strong>Fallback Mode:</strong> Using in-memory cache (Upstash not configured). Cache will be lost on server restart. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent caching.
            </p>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cached Items */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Cached Items</p>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{keysCount.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Keys in Redis</p>
          {!isConnected && <p className="text-xs text-orange-600 mt-1">Unavailable when disconnected</p>}
          {isConnected && cacheType === 'in-memory' && <p className="text-xs text-blue-600 mt-1">In-memory cache (fallback)</p>}
        </div>

        {/* Memory Usage */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Memory Usage</p>
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
              <div className="h-2 w-2 bg-purple-600 rounded-full"></div>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatMemory(memoryUsage)}</p>
          <p className="text-xs text-gray-500 mt-2">Total Redis memory</p>
          {!isConnected && <p className="text-xs text-orange-600 mt-1">Unavailable when disconnected</p>}
        </div>

        {/* Active Groups */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Cache Groups</p>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
              <p className="text-sm font-bold text-amber-600">#</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{cacheGroupsCount}</p>
          <p className="text-xs text-gray-500 mt-2">Active cache groups</p>
        </div>
      </div>

      {/* Status Information */}
      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">System Status</p>
            <p className="text-xs text-gray-600 mt-1">
              {isConnected 
                ? 'Cache system is operational. All metrics are being monitored in real-time.'
                : 'Cache system is currently offline. Check your Redis connection and backend configuration.'}
            </p>
          </div>
          {isRefreshing && <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />}
        </div>
        {autoRefreshIn > 0 && !isRefreshing && (
          <p className="text-xs text-gray-500 mt-2">Auto-refresh in {autoRefreshIn}s</p>
        )}
      </div>
    </div>
  )
}
