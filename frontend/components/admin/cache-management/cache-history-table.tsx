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
        return 'text-emerald-400 bg-emerald-500/10'
      case 'failed':
        return 'text-red-400 bg-red-500/10'
      default:
        return 'text-slate-400 bg-slate-500/10'
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
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-3" />
        <p className="text-slate-400">Loading history...</p>
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
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400">Action</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Cache Groups</TableHead>
              <TableHead className="text-slate-400">Keys Deleted</TableHead>
              <TableHead className="text-slate-400">Timestamp</TableHead>
              <TableHead className="text-slate-400">Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item, idx) => (
              <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/50">
                <TableCell className="font-mono text-xs text-slate-300 capitalize">{item.action}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-slate-400">{item.cache_groups?.join(', ') || 'N/A'}</TableCell>
                <TableCell className="text-xs text-slate-300 font-mono">{item.keys_deleted || 0}</TableCell>
                <TableCell className="text-xs text-slate-400">{formatDate(item.created_at)}</TableCell>
                <TableCell className="text-xs text-slate-400">{item.admin_name || 'System'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
