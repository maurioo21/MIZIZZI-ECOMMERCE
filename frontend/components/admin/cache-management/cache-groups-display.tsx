'use client'

import { useState } from 'react'
import { CacheStatus } from '@/types/cache-management'
import { Database, Eye, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import cacheManagementService from '@/services/cache-management'

interface CacheGroupsDisplayProps {
  status?: CacheStatus
  isLoading?: boolean
  onGroupDeleted?: () => void
}

const CACHE_GROUPS = [
  {
    name: 'Carousel Cache',
    pattern: 'mizizzi:carousel:*',
    description: 'Homepage carousel items and images',
    color: 'from-orange-100 to-amber-50',
    borderColor: 'border-orange-300',
  },
  {
    name: 'Categories Cache',
    pattern: 'mizizzi:categories:*',
    description: 'Shop categories hierarchy and metadata',
    color: 'from-blue-100 to-cyan-50',
    borderColor: 'border-blue-300',
  },
  {
    name: 'Feature Cards Cache',
    pattern: 'mizizzi:feature_cards:*',
    description: 'Feature cards displayed on homepage',
    color: 'from-purple-100 to-pink-50',
    borderColor: 'border-purple-300',
  },
  {
    name: 'Products Cache',
    pattern: 'mizizzi:products:*',
    description: 'Product listings and details',
    color: 'from-green-100 to-emerald-50',
    borderColor: 'border-green-300',
  },
]

export default function CacheGroupsDisplay({ status, isLoading, onGroupDeleted }: CacheGroupsDisplayProps) {
  const { toast } = useToast()
  const [activeDialog, setActiveDialog] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<typeof CACHE_GROUPS[0] | null>(null)

  const handleDeleteClick = (group: typeof CACHE_GROUPS[0]) => {
    setSelectedGroup(group)
    setActiveDialog(group.pattern)
  }

  const confirmDelete = async () => {
    if (!selectedGroup) return

    setIsDeleting(true)
    try {
      const result = await cacheManagementService.invalidateCache(selectedGroup.pattern)
      
      toast({
        title: 'Success',
        description: `${selectedGroup.name} cleared successfully. New cache will be generated on next access.`,
        variant: 'default',
      })
      
      setActiveDialog(null)
      setSelectedGroup(null)
      
      if (onGroupDeleted) {
        onGroupDeleted()
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred'
      
      toast({
        title: 'Error',
        description: `Failed to clear ${selectedGroup.name}: ${errorMsg}`,
        variant: 'destructive',
      })
      
      console.error('Cache deletion failed:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">Cache Groups</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CACHE_GROUPS.map((group) => (
            <div
              key={group.pattern}
              className={`group rounded-lg border-2 bg-gradient-to-br ${group.color} ${group.borderColor} p-4 transition-all hover:border-opacity-100 hover:shadow-sm`}
            >
              <div className="flex items-start justify-between mb-3">
                <Database className="h-5 w-5 text-gray-600 group-hover:text-gray-700" />
                <Eye className="h-4 w-4 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900">{group.name}</h3>
              <p className="mt-1 text-xs text-gray-700">{group.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <code className="text-xs text-gray-600 font-mono">{group.pattern}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading || isDeleting}
                  onClick={() => handleDeleteClick(group)}
                  className="h-6 w-6 p-0 text-gray-500 hover:bg-black/5 hover:text-red-600"
                >
                  {isDeleting && activeDialog === group.pattern ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {selectedGroup && (
        <Dialog open={activeDialog !== null} onOpenChange={(open) => !open && setActiveDialog(null)}>
          <DialogContent className="border-gray-200 bg-white">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Clear {selectedGroup.name}</DialogTitle>
              <DialogDescription className="text-gray-600">
                This will delete all cached data for {selectedGroup.name.toLowerCase()}. New data will be cached on the next access.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                <strong>Pattern:</strong> {selectedGroup.pattern}
              </p>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setActiveDialog(null)} 
                className="border-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Clearing...' : 'Clear Cache'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

