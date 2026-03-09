'use client'

import { CacheStatus } from '@/types/cache-management'
import { Activity, AlertCircle, CheckCircle2, Zap } from 'lucide-react'

interface CacheStatusDashboardProps {
  status?: CacheStatus
  isLoading?: boolean
  error?: string
}

export default function CacheStatusDashboard({ status, isLoading, error }: CacheStatusDashboardProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Cache Service Unavailable</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {/* Status Card */}
      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 transition-all hover:border-gray-300 hover:shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</p>
            <div className="mt-2 flex items-center gap-2">
              {status?.connected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-lg font-bold text-emerald-700">Connected</p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-lg font-bold text-red-700">Disconnected</p>
                </>
              )}
            </div>
          </div>
          <Activity className={`h-8 w-8 ${status?.connected ? 'text-emerald-200' : 'text-red-200'}`} />
        </div>
      </div>

      {/* Keys Count */}
      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 transition-all hover:border-gray-300 hover:shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cached Items</p>
        <div className="mt-2">
          <p className="text-3xl font-bold text-blue-600">{isLoading ? '—' : status?.keysCount || 0}</p>
          <p className="mt-1 text-xs text-gray-600">Keys in Redis</p>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 transition-all hover:border-gray-300 hover:shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Memory</p>
        <div className="mt-2">
          <p className="text-3xl font-bold text-cyan-600">
            {isLoading ? '—' : status?.memoryUsage ? `${(status.memoryUsage / 1024 / 1024).toFixed(1)}MB` : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-gray-600">Used</p>
        </div>
      </div>

      {/* Cache Groups */}
      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 transition-all hover:border-gray-300 hover:shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Groups</p>
        <div className="mt-2">
          <p className="text-3xl font-bold text-purple-600">{isLoading ? '—' : status?.cacheGroups?.length || 3}</p>
          <p className="mt-1 text-xs text-gray-600">Active</p>
        </div>
      </div>
    </div>
  )
}
