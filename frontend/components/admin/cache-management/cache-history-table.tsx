'use client'

import { useState, useEffect } from 'react'
import { useCacheManagement } from '@/hooks/use-cache-management'
import { Clock, Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function CacheHistoryTable() {
  const { history, isLoading, fetchHistory } = useCacheManagement()
  const [displayItems, setDisplayItems] = useState<any[]>([])

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [fetchHistory])

  useEffect(() => {
    if (history?.items) {
      setDisplayItems(history.items.slice(0, 10))
    }
  }, [history])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-emerald-700 bg-emerald-100'
      case 'failed':
        return 'text-red-700 bg-red-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return 'Invalid date'
    }
  }

  if (isLoading && !displayItems.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Loading history...</p>
      </div>
    )
  }

  if (!displayItems.length) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center">
        <Clock className="h-8 w-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No cache invalidation history yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <Table>
        <TableHeader className="bg-gray-50">
          <TableRow className="border-gray-200 hover:bg-gray-50">
            <TableHead className="text-gray-900">Timestamp</TableHead>
            <TableHead className="text-gray-900">Action</TableHead>
            <TableHead className="text-gray-900">Admin</TableHead>
            <TableHead className="text-gray-900">Status</TableHead>
            <TableHead className="text-gray-900">Keys Affected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayItems.length > 0 ? (
            displayItems.map((item, idx) => (
              <TableRow key={idx} className="border-gray-200 hover:bg-gray-50">
                <TableCell className="text-gray-700 text-sm">{formatDate(item.created_at)}</TableCell>
                <TableCell className="text-gray-700 text-sm font-medium">{item.action}</TableCell>
                <TableCell className="text-gray-700 text-sm">{item.admin_name || 'Unknown'}</TableCell>
                <TableCell>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </TableCell>
                <TableCell className="text-gray-700 text-sm">{item.keys_deleted || 0}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No invalidation history yet</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
