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
      color: 'from-orange-500/10 to-amber-500/10',
      accentColor: 'text-orange-400 border-orange-500/20 hover:border-orange-500/50',
      isDangerous: false,
      handler: onClearCritical || (() => Promise.resolve()),
    },
    {
      id: 'deferred',
      label: 'Clear Deferred',
      description: 'Remove secondary cache groups and collections',
      icon: <Database className="h-5 w-5" />,
      color: 'from-blue-500/10 to-cyan-500/10',
      accentColor: 'text-blue-400 border-blue-500/20 hover:border-blue-500/50',
      isDangerous: false,
      handler: onClearDeferred || (() => Promise.resolve()),
    },
    {
      id: 'homepage',
      label: 'Clear Homepage',
      description: 'Refresh homepage snapshots and aggregated data',
      icon: <Home className="h-5 w-5" />,
      color: 'from-purple-500/10 to-pink-500/10',
      accentColor: 'text-purple-400 border-purple-500/20 hover:border-purple-500/50',
      isDangerous: false,
      handler: onClearHomepage || (() => Promise.resolve()),
    },
    {
      id: 'rebuild',
      label: 'Rebuild All',
      description: 'Clear and regenerate all caches from database',
      icon: <RefreshCw className="h-5 w-5" />,
      color: 'from-green-500/10 to-emerald-500/10',
      accentColor: 'text-green-400 border-green-500/20 hover:border-green-500/50',
      isDangerous: true,
      handler: onRebuild || (() => Promise.resolve()),
    },
    {
      id: 'clearall',
      label: 'Clear All',
      description: 'Nuclear option - removes all cached data',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'from-red-500/10 to-rose-500/10',
      accentColor: 'text-red-400 border-red-500/20 hover:border-red-500/50',
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={isLoading || isProcessing}
              className={`group relative overflow-hidden rounded-lg border-2 bg-gradient-to-br p-4 transition-all duration-300 ${action.color} ${action.accentColor} disabled:opacity-50`}
            >
              <div className="absolute inset-0 bg-white opacity-0 transition-opacity group-hover:opacity-5" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className={`${action.accentColor.split(' ')[0]}`}>{action.icon}</div>
                  {action.isDangerous && <AlertTriangle className="h-4 w-4 text-red-500" />}
                </div>
                <h3 className="font-semibold text-sm text-white">{action.label}</h3>
                <p className="mt-1 text-xs text-slate-400">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation Dialogs */}
      {actions.map((action) => (
        <Dialog key={`dialog-${action.id}`} open={activeDialog === action.id} onOpenChange={(open) => !open && setActiveDialog(null)}>
          <DialogContent className="border-slate-700 bg-slate-900">
            <DialogHeader>
              <DialogTitle className="text-white">{action.label}</DialogTitle>
              <DialogDescription className="text-slate-400">{action.description}</DialogDescription>
            </DialogHeader>
            {action.isDangerous && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-red-200">
                  <strong>Warning:</strong> This action will significantly impact performance until caches are rebuilt.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveDialog(null)} className="border-slate-600">
                Cancel
              </Button>
              <Button
                onClick={() => confirmAction(action)}
                disabled={isProcessing}
                className={action.isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
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
