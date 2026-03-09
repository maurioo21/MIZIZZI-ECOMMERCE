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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-white">Cache Control</h1>
              </div>
              <p className="text-sm text-slate-400">Monitor and manage Redis cache systems</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 p-4 backdrop-blur-sm">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="overview" className="flex items-center gap-2 text-slate-400 data-[state=active]:text-white">
              <Settings className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 text-slate-400 data-[state=active]:text-white">
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
