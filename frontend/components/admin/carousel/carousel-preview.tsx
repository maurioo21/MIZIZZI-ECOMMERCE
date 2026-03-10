"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, BarChart3, ExternalLink } from "lucide-react"
import Image from "next/image"
import type { CarouselBanner } from "@/types/carousel-admin"
import { motion } from "framer-motion"

interface CarouselPreviewProps {
  banner?: CarouselBanner
}

export function CarouselPreview({ banner }: CarouselPreviewProps) {
  if (!banner) {
    return (
      <Card className="sticky top-4">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Select a banner to preview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">No banner selected</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Optimize Cloudinary URL for preview
  const getOptimizedUrl = (imageUrl: string) => {
    if (!imageUrl) return "/placeholder.svg"
    if (imageUrl.startsWith("blob:")) {
      return "/placeholder.svg"
    }
    if (!imageUrl.includes("cloudinary.com")) return imageUrl
    
    try {
      // For Cloudinary URLs, the format is:
      // https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
      // OR after transformations:
      // https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{version}/{public_id}.{format}
      
      // Extract the full path after /upload/
      const uploadMatch = imageUrl.match(/\/upload\/(.*?)$/)
      if (!uploadMatch) {
        return imageUrl
      }
      
      const pathAfterUpload = uploadMatch[1]
      
      // Get the public_id (everything after the last slash)
      const publicIdWithFormat = pathAfterUpload.split('/').pop() || ''
      
      if (!publicIdWithFormat) {
        return imageUrl
      }
      
      // Construct optimized URL with transformations
      return `https://res.cloudinary.com/da35rsdl0/image/upload/w_800,h_300,c_fill,q_auto,f_auto/${publicIdWithFormat}`
    } catch (error) {
      return imageUrl
    }
  }

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Preview
          {banner.link_url && (
            <Button variant="ghost" size="sm" asChild>
              <a href={banner.link_url} target="_blank" rel="noopener noreferrer" className="gap-1">
                <ExternalLink className="h-3 w-3" />
                Test Link
              </a>
            </Button>
          )}
        </CardTitle>
        <CardDescription>{banner.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full h-56 rounded-lg overflow-hidden bg-muted group"
        >
          {banner.image_url && banner.image_url.includes("cloudinary.com") ? (
            // Use native img for Cloudinary URLs - they're already optimized CDN URLs
            <img
              src={getOptimizedUrl(banner.image_url)}
              alt={banner.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            // Use Next.js Image for other URLs
            <Image
              src={getOptimizedUrl(banner.image_url) || "/placeholder.svg"}
              alt={banner.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority={true}
              quality={75}
            />
          )}
          {/* Overlay with gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Discount badge */}
          {banner.discount && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-red-600 text-white font-bold">{banner.discount}</Badge>
            </div>
          )}

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            {banner.badge_text && (
              <Badge variant="secondary" className="bg-white/20 text-white mb-2">
                {banner.badge_text}
              </Badge>
            )}
            <h3 className="font-bold text-lg line-clamp-2 mb-1">{banner.title}</h3>
            {banner.description && <p className="text-sm text-white/90 line-clamp-2">{banner.description}</p>}
          </div>
        </motion.div>

        {/* Button Preview */}
        <Button className="w-full gap-2">
          {banner.button_text}
          <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="space-y-3 text-xs border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Link:</span>
            <span className="font-mono text-xs truncate max-w-[200px]">{banner.link_url || "—"}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={banner.is_active ? "default" : "secondary"} className="text-xs">
              {banner.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>

          {banner.priority && banner.priority > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Priority:
              </span>
              <span className="font-semibold">{banner.priority}</span>
            </div>
          )}

          {(banner.start_date || banner.end_date) && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-1 text-muted-foreground font-semibold">
                <Calendar className="h-3 w-3" />
                Schedule
              </div>
              {banner.start_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start:</span>
                  <span>{new Date(banner.start_date).toLocaleDateString()}</span>
                </div>
              )}
              {banner.end_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End:</span>
                  <span>{new Date(banner.end_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(banner.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
