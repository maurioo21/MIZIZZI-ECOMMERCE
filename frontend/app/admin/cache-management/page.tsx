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

export default function CacheManagementPage() {
  const { toast } = useToast()
  const {
    status,
    isLoading,
    error,
    invalidateCritical,
    invalidateDeferred,
    invalidateHomepage,
    invalidateAll,
    rebuild,
  } = useCacheManagement()

  const [activeTab, setActiveTab] = useState('overview')

  const handleClearCritical = async () => {
    try {
      await invalidateCritical()
      toast({ title: 'Success', description: 'Critical caches cleared' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to clear caches', variant: 'destructive' })
    }
  }

  const handleClearDeferred = async () => {
    try {
      await invalidateDeferred()
      toast({ title: 'Success', description: 'Deferred caches cleared' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to clear caches', variant: 'destructive' })
    }
  }

  const handleClearHomepage = async () => {
    try {
      await invalidateHomepage()
      toast({ title: 'Success', description: 'Homepage caches cleared' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to clear caches', variant: 'destructive' })
    }
  }

  const handleRebuild = async () => {
    try {
      await rebuild()
      toast({ title: 'Success', description: 'Caches rebuilt successfully' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to rebuild caches', variant: 'destructive' })
    }
  }

  const handleClearAll = async () => {
    try {
      await invalidateAll()
      toast({ title: 'Success', description: 'All caches cleared' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to clear caches', variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">Cache Control</h1>
              </div>
              <p className="text-sm text-gray-600">Monitor and manage Redis cache systems</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-100 border border-gray-200">
            <TabsTrigger value="overview" className="flex items-center gap-2 text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">
              <Settings className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Status Dashboard */}
            <CacheStatusDashboard status={status} isLoading={isLoading} error={error} />

            {/* Actions Grid */}
            <CacheActionsGrid
              onClearCritical={handleClearCritical}
              onClearDeferred={handleClearDeferred}
              onClearHomepage={handleClearHomepage}
              onRebuild={handleRebuild}
              onClearAll={handleClearAll}
              isLoading={isLoading}
            />

            {/* Cache Groups */}
            <CacheGroupsDisplay status={status} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="history">
            <CacheHistoryTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
