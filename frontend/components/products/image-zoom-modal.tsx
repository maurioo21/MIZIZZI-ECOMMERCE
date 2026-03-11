"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Product } from "@/types"
import { cloudinaryService } from "@/services/cloudinary-service"
import { cn } from "@/lib/utils"

interface ImageZoomModalProps {
  product: Product
  isOpen: boolean
  onClose: () => void
  selectedImageIndex: number
}

function getProcessedImageUrls(product: Product): string[] {
  const urls: string[] = []

  // First try the new backend format with Cloudinary variants
  if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
    try {
      product.images.forEach((img: any) => {
        if (img && (img?.urls?.large || img?.urls?.original || img?.url)) {
          const imageUrl = img.urls?.large || img.urls?.original || img.urls?.medium || img.url
          if (typeof imageUrl === 'string' && imageUrl.trim() && !imageUrl.startsWith('blob:')) {
            urls.push(imageUrl)
          }
        }
      })
      if (urls.length > 0) {
        console.log("[v0] Extracted images from backend format:", urls)
        return urls
      }
    } catch (e) {
      console.error("[v0] Error extracting from backend format:", e)
    }
  }

  // Fallback to old image_urls format
  if (product?.image_urls) {
    if (Array.isArray(product.image_urls)) {
      // Handle malformed array (single characters)
      if (
        product.image_urls.length > 0 &&
        typeof product.image_urls[0] === "string" &&
        product.image_urls[0].length === 1
      ) {
        try {
          const reconstructed = product.image_urls.join("")
          const parsed = JSON.parse(reconstructed)
          if (Array.isArray(parsed)) {
            parsed.forEach((u: string) => {
              if (typeof u === "string" && u.trim() && !u.startsWith("blob:")) {
                urls.push(
                  u.startsWith("http")
                    ? u
                    : cloudinaryService.generateOptimizedUrl(u, {
                        width: 1200,
                        height: 1200,
                        crop: "fit",
                        quality: 90,
                      }),
                )
              }
            })
          }
        } catch {
          // Failed to parse
        }
      } else {
        product.image_urls.forEach((u: string) => {
          if (typeof u === "string" && u.trim() && !u.startsWith("blob:")) {
            urls.push(
              u.startsWith("http")
                ? u
                : cloudinaryService.generateOptimizedUrl(u, { width: 1200, height: 1200, crop: "fit", quality: 90 }),
            )
          }
        })
      }
    } else if (typeof product.image_urls === "string") {
      try {
        const parsed = JSON.parse(product.image_urls)
        if (Array.isArray(parsed)) {
          parsed.forEach((u: string) => {
            if (typeof u === "string" && u.trim() && !u.startsWith("blob:")) {
              urls.push(
                u.startsWith("http")
                  ? u
                  : cloudinaryService.generateOptimizedUrl(u, { width: 1200, height: 1200, crop: "fit", quality: 90 }),
              )
            }
          })
        }
      } catch {
        const u = product.image_urls as string
        if (!u.startsWith("blob:")) {
          urls.push(
            u.startsWith("http")
              ? u
              : cloudinaryService.generateOptimizedUrl(u, { width: 1200, height: 1200, crop: "fit", quality: 90 }),
          )
        }
      }
    }
  }

  // Fallback to thumbnail
  if (urls.length === 0 && product?.thumbnail_url && !product.thumbnail_url.startsWith("blob:")) {
    urls.push(product.thumbnail_url)
  }

  // Final fallback
  if (urls.length === 0) {
    urls.push("/generic-product-display.png")
  }

  return urls
}

export function ImageZoomModal({ product, isOpen, onClose, selectedImageIndex }: ImageZoomModalProps) {
  const images = getProcessedImageUrls(product)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const validIndex = images.length > 0 ? Math.min(selectedImageIndex, images.length - 1) : 0
    setCurrentIndex(validIndex)
    setImageError(false)
    setImageLoaded(false)
  }, [isOpen, selectedImageIndex, images.length])

  useEffect(() => {
    setImageError(false)
    setImageLoaded(false)
  }, [currentIndex])

  const currentImageUrl = images[currentIndex] || "/generic-product-display.png"
  const productName = product?.name || "Product"

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") handleNext()
    if (e.key === "ArrowLeft") handlePrevious()
    if (e.key === "Escape") onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[1100px] w-[95vw] h-[90vh] p-0 bg-white overflow-hidden flex flex-col gap-0"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Product Images - {productName}</DialogTitle>
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <h2 className="font-medium text-base text-gray-900">Product Images</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 relative bg-white flex items-center justify-center min-h-0 overflow-hidden">
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-50 rounded-full h-10 w-10 shadow-md z-10 border border-gray-200"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-50 rounded-full h-10 w-10 shadow-md z-10 border border-gray-200"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </Button>
            </>
          )}

          <div className="w-full h-full flex items-center justify-center px-16 py-4">
            {imageError ? (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-sm">Image not available</span>
              </div>
            ) : (
              <>
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-[#8B1538] rounded-full animate-spin" />
                  </div>
                )}
                <img
                  src={currentImageUrl || "/placeholder.svg"}
                  alt={`${productName} - Image ${currentIndex + 1}`}
                  className={cn(
                    "h-full w-auto max-w-full object-contain transition-opacity duration-200",
                    imageLoaded ? "opacity-100" : "opacity-0",
                  )}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  draggable={false}
                />
              </>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <div className="py-2 px-4 border-t shrink-0 bg-white">
            <div className="flex gap-2 justify-center overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  className={cn(
                    "relative flex-shrink-0 w-12 h-12 rounded overflow-hidden transition-all",
                    currentIndex === index
                      ? "ring-2 ring-[#8B1538] ring-offset-1"
                      : "border border-gray-200 opacity-70 hover:opacity-100",
                  )}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`View image ${index + 1}`}
                >
                  <img
                    src={image || "/generic-product-display.png"}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      // Only set fallback if not already set to prevent infinite loop
                      if (!target.src.includes("generic-product-display")) {
                        target.src = "/generic-product-display.png"
                      }
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
