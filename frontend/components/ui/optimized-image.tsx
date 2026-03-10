"use client"

import type React from "react"
import { useState, memo } from "react"
import { cn } from "@/lib/utils"

interface OptimizedImageProps {
  src?: string
  alt: string
  className?: string
  fallback?: React.ReactNode
  width?: number
  height?: number
  priority?: boolean
}

export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  className,
  fallback,
  width,
  height,
  priority = false,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return <div className={cn("flex items-center justify-center bg-gray-100", className)}>{fallback}</div>
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          <div className="w-6 h-6 bg-gray-300 rounded" />
        </div>
      )}
      <img
        src={src || "/placeholder.svg"}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-200", // Faster transition
          isLoading ? "opacity-0" : "opacity-100",
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </div>
  )
})
