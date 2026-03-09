'use client'

import { CacheStatus } from '@/types/cache-management'
import { Database, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CacheGroupsDisplayProps {
  status?: CacheStatus
  isLoading?: boolean
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

export default function CacheGroupsDisplay({ status, isLoading }: CacheGroupsDisplayProps) {
  return (
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
                className="h-6 w-6 p-0 text-gray-500 hover:bg-black/5 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
