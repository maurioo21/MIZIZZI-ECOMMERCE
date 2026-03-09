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
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-100">Cache Service Unavailable</h3>
            <p className="mt-1 text-sm text-red-200/80">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {/* Status Card */}
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 transition-all hover:border-slate-600">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
            <div className="mt-2 flex items-center gap-2">
              {status?.connected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <p className="text-lg font-bold text-emerald-400">Connected</p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="text-lg font-bold text-red-400">Disconnected</p>
                </>
              )}
            </div>
          </div>
          <Activity className={`h-8 w-8 ${status?.connected ? 'text-emerald-500/30' : 'text-red-500/30'}`} />
        </div>
      </div>

      {/* Keys Count */}
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 transition-all hover:border-slate-600">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cached Items</p>
        <div className="mt-2">
          <p className="text-3xl font-bold text-blue-400">{isLoading ? '—' : status?.keysCount || 0}</p>
          <p className="mt-1 text-xs text-slate-400">Keys in Redis</p>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 transition-all hover:border-slate-600">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Memory</p>
        <div className="mt-2">
          <p className="text-3xl font-bold text-cyan-400">
            {isLoading ? '—' : status?.memoryUsage ? `${(status.memoryUsage / 1024 / 1024).toFixed(1)}MB` : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Used</p>
        </div>
      </div>

      {/* Cache Groups */}
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 transition-all hover:border-slate-600">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Groups</p>
        <div className="mt-2">
          <p className="text-3xl font-bold text-purple-400">{isLoading ? '—' : status?.cacheGroups?.length || 3}</p>
          <p className="mt-1 text-xs text-slate-400">Active</p>
        </div>
      </div>
    </div>
  )
}
