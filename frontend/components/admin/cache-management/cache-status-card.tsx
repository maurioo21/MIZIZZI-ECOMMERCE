"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CacheStatus } from "@/types/cache-management"
import { Activity, AlertCircle, CheckCircle } from "lucide-react"

interface CacheStatusCardProps {
  status: CacheStatus | null
  isLoading?: boolean
}

export function CacheStatusCard({ status, isLoading }: CacheStatusCardProps) {
  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Cache Status
          </CardTitle>
          <CardDescription>Redis connection status and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {isLoading ? "Loading..." : "Unable to load cache status"}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Cache Status
          </div>
          <Badge variant={status.connected ? "default" : "destructive"}>
            {status.connected ? "Connected" : "Disconnected"}
          </Badge>
        </CardTitle>
        <CardDescription>Last updated: {new Date(status.lastUpdated).toLocaleString()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</p>
            <div className="flex items-center gap-2">
              {status.connected ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <p className="text-sm font-medium">{status.connected ? "Healthy" : "Error"}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Cache Groups</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {status.cacheGroups ? status.cacheGroups.length : 0}
            </p>
          </div>

          {status.keysCount !== undefined && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total Keys</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{status.keysCount.toLocaleString()}</p>
            </div>
          )}

          {status.memoryUsage !== undefined && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Memory</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {(status.memoryUsage / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
