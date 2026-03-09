'use client'

import { useState } from 'react'
import { useCacheManagement } from '@/hooks/use-cache-management'
import { useToast } from '@/hooks/use-toast'
import CacheStatusDashboard from '@/components/admin/cache-management/cache-status-dashboard'
import CacheActionsGrid from '@/components/admin/cache-management/cache-actions-grid'
import CacheGroupsDisplay from '@/components/admin/cache-management/cache-groups-display'
import CacheHistoryTable from '@/components/admin/cache-management/cache-history-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Zap, History, Settings } from 'lucide-react'
import { CacheGroupType } from '@/types/cache-management'

export default function CacheManagementPage() {
  const { toast } = useToast()
  const {
    cacheStatus,
    isLoading,
    error,
    invalidateCacheGroup,
    invalidateAllCaches,
    rebuildCaches,
    fetchCacheStatus,
  } = useCacheManagement()

  const [activeTab, setActiveTab] = useState('overview')

  const handleClearCritical = async () => {
    try {
      await invalidateCacheGroup(CacheGroupType.CRITICAL)
    } catch (err) {
      console.error('Error clearing critical cache:', err)
      throw err
    }
  }

  const handleClearDeferred = async () => {
    try {
      await invalidateCacheGroup(CacheGroupType.DEFERRED)
    } catch (err) {
      console.error('Error clearing deferred cache:', err)
      throw err
    }
  }

  const handleClearHomepage = async () => {
    try {
      await invalidateCacheGroup(CacheGroupType.HOMEPAGE)
    } catch (err) {
      console.error('Error clearing homepage cache:', err)
      throw err
    }
  }

  const handleRebuild = async () => {
    try {
      await rebuildCaches()
    } catch (err) {
      console.error('Error rebuilding cache:', err)
      throw err
    }
  }

  const handleClearAll = async () => {
    try {
      await invalidateAllCaches()
    } catch (err) {
      console.error('Error clearing all cache:', err)
      throw err
    }
  }

  const handleCacheRefresh = () => {
    fetchCacheStatus()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-white via-blue-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 p-2.5 shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">Cache Control</h1>
            </div>
            <p className="text-sm text-gray-600">Monitor and manage Redis cache systems in real-time</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-100 border border-gray-200 shadow-sm">
            <TabsTrigger value="overview" className="flex items-center gap-2 text-gray-700 data-[state=active]:text-blue-600 data-[state=active]:bg-white">
              <Settings className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 text-gray-700 data-[state=active]:text-blue-600 data-[state=active]:bg-white">
              <History className="h-4 w-4" />
              History & Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Status Dashboard */}
            <CacheStatusDashboard status={cacheStatus} isLoading={isLoading} error={error} />

            {/* Actions Grid */}
            <CacheActionsGrid
              onClearCritical={handleClearCritical}
              onClearDeferred={handleClearDeferred}
              onClearHomepage={handleClearHomepage}
              onRebuild={handleRebuild}
              onClearAll={handleClearAll}
              isLoading={isLoading}
              onSuccess={handleCacheRefresh}
            />

            {/* Cache Groups */}
            <CacheGroupsDisplay status={cacheStatus} isLoading={isLoading} onGroupDeleted={handleCacheRefresh} />
          </TabsContent>

          <TabsContent value="history">
            <CacheHistoryTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

