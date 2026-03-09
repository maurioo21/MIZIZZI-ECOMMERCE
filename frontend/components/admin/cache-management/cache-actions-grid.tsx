'use client'

import { useState } from 'react'
import { AlertTriangle, Zap, Database, Home, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CacheActionsGridProps {
  onClearCritical?: () => Promise<any>
  onClearDeferred?: () => Promise<any>
  onClearHomepage?: () => Promise<any>
  onRebuild?: () => Promise<any>
  onClearAll?: () => Promise<any>
  isLoading?: boolean
}

interface ActionConfig {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
  accentColor: string
  isDangerous: boolean
  handler: () => Promise<any>
}

export default function CacheActionsGrid({
  onClearCritical,
  onClearDeferred,
  onClearHomepage,
  onRebuild,
  onClearAll,
  isLoading,
}: CacheActionsGridProps) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const actions: ActionConfig[] = [
    {
      id: 'critical',
      label: 'Clear Critical',
      description: 'Remove homepage carousel, categories, and featured items',
      icon: <Zap className="h-5 w-5" />,
      color: 'from-orange-100 to-amber-50',
      accentColor: 'text-orange-600 border-orange-300 hover:border-orange-400',
      isDangerous: false,
      handler: onClearCritical || (() => Promise.resolve()),
    },
    {
      id: 'deferred',
      label: 'Clear Deferred',
      description: 'Remove secondary cache groups and collections',
      icon: <Database className="h-5 w-5" />,
      color: 'from-blue-100 to-cyan-50',
      accentColor: 'text-blue-600 border-blue-300 hover:border-blue-400',
      isDangerous: false,
      handler: onClearDeferred || (() => Promise.resolve()),
    },
    {
      id: 'homepage',
      label: 'Clear Homepage',
      description: 'Refresh homepage snapshots and aggregated data',
      icon: <Home className="h-5 w-5" />,
      color: 'from-purple-100 to-pink-50',
      accentColor: 'text-purple-600 border-purple-300 hover:border-purple-400',
      isDangerous: false,
      handler: onClearHomepage || (() => Promise.resolve()),
    },
    {
      id: 'rebuild',
      label: 'Rebuild All',
      description: 'Clear and regenerate all caches from database',
      icon: <RefreshCw className="h-5 w-5" />,
      color: 'from-green-100 to-emerald-50',
      accentColor: 'text-green-600 border-green-300 hover:border-green-400',
      isDangerous: true,
      handler: onRebuild || (() => Promise.resolve()),
    },
    {
      id: 'clearall',
      label: 'Clear All',
      description: 'Nuclear option - removes all cached data',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'from-red-100 to-rose-50',
      accentColor: 'text-red-600 border-red-300 hover:border-red-400',
      isDangerous: true,
      handler: onClearAll || (() => Promise.resolve()),
    },
  ]

  const handleAction = async (action: ActionConfig) => {
    setActiveDialog(action.id)
  }

  const confirmAction = async (action: ActionConfig) => {
    setIsProcessing(true)
    try {
      await action.handler()
    } catch (error) {
      console.error('Cache action failed:', error)
    } finally {
      setIsProcessing(false)
      setActiveDialog(null)
    }
  }

  return (
    <>
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={isLoading || isProcessing}
              className={`group relative overflow-hidden rounded-lg border-2 bg-gradient-to-br p-4 transition-all duration-300 ${action.color} ${action.accentColor} disabled:opacity-50`}
            >
              <div className="absolute inset-0 bg-black opacity-0 transition-opacity group-hover:opacity-5" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className={`${action.accentColor.split(' ')[0]}`}>{action.icon}</div>
                  {action.isDangerous && <AlertTriangle className="h-4 w-4 text-red-600" />}
                </div>
                <h3 className="font-semibold text-sm text-gray-900">{action.label}</h3>
                <p className="mt-1 text-xs text-gray-600">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation Dialogs */}
      {actions.map((action) => (
        <Dialog key={`dialog-${action.id}`} open={activeDialog === action.id} onOpenChange={(open) => !open && setActiveDialog(null)}>
          <DialogContent className="border-gray-200 bg-white">
            <DialogHeader>
              <DialogTitle className="text-gray-900">{action.label}</DialogTitle>
              <DialogDescription className="text-gray-600">{action.description}</DialogDescription>
            </DialogHeader>
            {action.isDangerous && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This action will significantly impact performance until caches are rebuilt.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveDialog(null)} className="border-gray-300">
                Cancel
              </Button>
              <Button
                onClick={() => confirmAction(action)}
                disabled={isProcessing}
                className={action.isDangerous ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
              >
                {isProcessing ? 'Processing...' : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </>
  )
}
