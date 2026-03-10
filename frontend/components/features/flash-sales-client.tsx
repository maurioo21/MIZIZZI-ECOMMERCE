"use client"

import type React from "react"
import { useState, useEffect, useCallback, memo, useRef } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import Link from "next/link"
import { ChevronRight, ChevronLeft, Zap, Star } from "lucide-react"
import Image from "next/image"
import type { Product } from "@/types"
import { useRouter } from "next/navigation"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cloudinaryService } from "@/services/cloudinary-service"
import type { FlashSaleEvent, FlashSaleProduct } from "@/lib/server/get-flash-sale-products"

const LogoPlaceholder = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-white">
    <div className="relative h-12 w-12 sm:h-16 sm:w-16">
      <Image src="/logo.png" alt="Loading" fill sizes="64px" className="object-contain" />
    </div>
  </div>
)

const StarRating = ({ rating = 4 }: { rating?: number }) => {
  return (
    <div className="flex items-center">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
              star <= Math.floor(rating)
                ? "fill-yellow-400 text-yellow-400"
                : star - 0.5 <= rating
                  ? "fill-yellow-400/50 text-yellow-400"
                  : "fill-gray-200 text-gray-200"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

const StockIndicator = ({
  itemsLeft,
  progressPercentage,
  isSoldOut,
}: {
  itemsLeft: number
  progressPercentage: number
  isSoldOut: boolean
}) => {
  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-[10px] sm:text-xs font-medium text-gray-800">
        {isSoldOut ? <span className="text-red-600 font-semibold">Sold Out</span> : <span>{itemsLeft} items left</span>}
      </p>
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#8B1538] rounded-full transition-all duration-200"
          style={{ width: isSoldOut ? "0%" : `${Math.max(progressPercentage, 5)}%`, willChange: "width" }}
        />
      </div>
    </div>
  )
}

const getProductImageUrl = (product: Product): string => {
  // Priority 0: Check direct image field (from homepage API)
  if ((product as any).image && typeof (product as any).image === "string" && (product as any).image.length > 0) {
    const imageUrl = (product as any).image
    if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) {
      return imageUrl
    }
  }

  // Priority 1: Check thumbnail_url
  if (product.thumbnail_url && typeof product.thumbnail_url === "string" && product.thumbnail_url.length > 0) {
    if (product.thumbnail_url.startsWith("http") || product.thumbnail_url.startsWith("/")) {
      return product.thumbnail_url
    }
    const cloudUrl = cloudinaryService.generateOptimizedUrl(product.thumbnail_url)
    if (cloudUrl && cloudUrl !== "/placeholder.svg") {
      return cloudUrl
    }
  }

  // Priority 2: Check image_urls array
  if (product.image_urls && Array.isArray(product.image_urls) && product.image_urls.length > 0) {
    const firstUrl = product.image_urls[0]
    if (typeof firstUrl === "string" && firstUrl.length > 0) {
      if (firstUrl.startsWith("http") || firstUrl.startsWith("/")) {
        return firstUrl
      }
      const cloudUrl = cloudinaryService.generateOptimizedUrl(firstUrl)
      if (cloudUrl && cloudUrl !== "/placeholder.svg") {
        return cloudUrl
      }
    }
  }

  // Priority 3: Check images array
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const primaryImage = product.images.find((img: any) => img.is_primary)
    const imageToUse = primaryImage || product.images[0]
    if (imageToUse && imageToUse.url) {
      if (typeof imageToUse.url === "string" && imageToUse.url.length > 0) {
        if (imageToUse.url.startsWith("http") || imageToUse.url.startsWith("/")) {
          return imageToUse.url
        }
        const cloudUrl = cloudinaryService.generateOptimizedUrl(imageToUse.url)
        if (cloudUrl && cloudUrl !== "/placeholder.svg") {
          return cloudUrl
        }
      }
    }
  }

  return ""
}

const ProductCard = memo(
  ({ product, isMobile, isAboveFold }: { product: FlashSaleProduct | Product; isMobile: boolean; isAboveFold?: boolean }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const discountPercentage = product.sale_price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0

  const flashProduct = product as FlashSaleProduct
  const itemsLeft = flashProduct.items_left ?? product.stock ?? 100
  const progressPercentage = flashProduct.progress_percentage ?? (product.stock ? (product.stock / 100) * 100 : 100)
  const isAlmostGone = flashProduct.is_almost_gone ?? (itemsLeft > 0 && itemsLeft <= 5)
  const isSoldOut = flashProduct.is_sold_out ?? itemsLeft === 0

  // Use deterministic rating fallback based on product ID to avoid hydration mismatch
  const ratingFallback = product.rating ?? (product.id ? (parseInt(product.id.toString().slice(-1)) % 2 + 3.5) : 4)
  const rating = typeof ratingFallback === "number" ? Math.min(5, Math.max(1, ratingFallback)) : 4

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  // Get secondary image URL - only from real backend data, no fallback query params
  const getSecondaryImageUrl = (): string => {
    const imgArray = product.image_urls
    if (imgArray && Array.isArray(imgArray) && imgArray.length > 1 && imgArray[1]) {
      const secondUrl = imgArray[1]
      if (typeof secondUrl === "string" && secondUrl.length > 0) {
        if (secondUrl.startsWith("http") || secondUrl.startsWith("/")) {
          return secondUrl
        }
        return cloudinaryService.generateOptimizedUrl(secondUrl)
      }
    }
    return ""
  }
  
  const secondaryImageUrl = getSecondaryImageUrl()
  const hasMultipleImages = Boolean(secondaryImageUrl)

  const imageUrl = getProductImageUrl(product)
  const hasValidImage = imageUrl && imageUrl.length > 0

  const handleImageHover = () => {
    if (!isMobile && hasMultipleImages) {
      setIsHovering(true)
    }
  }

  const handleImageLeave = () => {
    setIsHovering(false)
  }

  // Removed: Debug logging and universal image preloading
  // Production optimization: Only preload on-hover if needed, not for every card

  return (
    <Link href={`/product/${product.slug || product.id}`} prefetch={false}>
      <div className="h-full">
        <div
          className={`group h-full overflow-hidden bg-white border-r border-gray-100 transition-all duration-200 hover:shadow-sm ${isSoldOut ? "opacity-75" : ""}`}
        >
          <div 
            ref={imageContainerRef}
            className="relative aspect-square overflow-hidden bg-[#f8f8f8]"
            onMouseEnter={handleImageHover}
            onMouseLeave={handleImageLeave}
          >
            {(imageError || !hasValidImage) && <LogoPlaceholder />}
            {hasValidImage && (
              <Image
                src={imageUrl || "/placeholder.svg"}
                alt={product.name}
                fill
                sizes={isMobile ? "25vw" : "16vw"}
                className="object-cover transition-opacity duration-500"
                style={{
                  opacity: isHovering && hasMultipleImages ? 0 : 1,
                }}
                loading={isAboveFold ? "eager" : "lazy"}
                priority={isAboveFold || false}
                onLoad={handleImageLoad}
                onError={handleImageError}
                crossOrigin="anonymous"
                decoding="async"
              />
            )}

            {/* Secondary Image - overlay for hover swap */}
            {hasMultipleImages && secondaryImageUrl && (
              <Image
                src={secondaryImageUrl}
                alt={`${product.name} - alternate view`}
                fill
                sizes={isMobile ? "25vw" : "16vw"}
                className="absolute inset-0 object-cover transition-opacity duration-500"
                style={{
                  opacity: isHovering ? 1 : 0,
                }}
                loading="lazy"
                priority={false}
                crossOrigin="anonymous"
                decoding="async"
              />
            )}
            {product.sale_price && discountPercentage > 0 && (
              <div className="absolute top-1 left-1 bg-[#8B1538] text-white text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-sm z-20 pointer-events-none">
                -{discountPercentage}%
              </div>
            )}
            {isAlmostGone && !isSoldOut && (
              <div className="absolute bottom-1.5 left-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-sm z-20 animate-pulse pointer-events-none">
                Almost Gone!
              </div>
            )}
            {isSoldOut && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 pointer-events-none">
                <span className="bg-red-600 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded">SOLD OUT</span>
              </div>
            )}
          </div>
          <div className={isMobile ? "p-2" : "p-3"}>
            <h3
              className={`text-gray-800 line-clamp-2 leading-tight mb-1.5 ${isMobile ? "text-xs min-h-[32px]" : "text-sm min-h-[40px]"}`}
            >
              {product.name}
            </h3>
            <div className="mb-1.5">
              <span className={`font-semibold text-[#8B1538] ${isMobile ? "text-sm" : "text-base"}`}>
                KSh {(product.sale_price || product.price).toLocaleString()}
              </span>
              {product.sale_price && (
                <span className={`text-gray-400 line-through ml-1.5 ${isMobile ? "text-[10px]" : "text-xs"}`}>
                  KSh {product.price.toLocaleString()}
                </span>
              )}
            </div>
            <StarRating rating={rating} />
            <StockIndicator itemsLeft={itemsLeft} progressPercentage={progressPercentage} isSoldOut={isSoldOut} />
          </div>
        </div>
      </div>
    </Link>
  )
})

ProductCard.displayName = "ProductCard"

interface FlashSalesClientProps {
  initialProducts: (FlashSaleProduct | Product)[]
  initialEvent: FlashSaleEvent | null
}

/**
 * Client Component - Hybrid Rendering Pattern (CSR interactivity)
 *
 * Receives pre-rendered data from server component and adds:
 * - Real-time countdown timer
 * - Smooth carousel animations and navigation
 * - Interactive hover effects
 * - Drag-to-scroll functionality
 */
export function FlashSalesClient({ initialProducts, initialEvent }: FlashSalesClientProps) {
  const products = initialProducts || []

  const getInitialTimeLeft = () => {
    if (initialEvent?.time_remaining) {
      const total = initialEvent.time_remaining
      return {
        hours: Math.floor(total / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
      }
    }
    const now = new Date()
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    const total = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000))
    return {
      hours: Math.floor(total / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    }
  }

  const [timeLeft, setTimeLeft] = useState(getInitialTimeLeft)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)
  const motionDivRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const dragVelocityRef = useRef(0)

  const isMobile = useMediaQuery("(max-width: 640px)")
  const isSmallMobile = useMediaQuery("(max-width: 480px)")
  const isTablet = useMediaQuery("(max-width: 1024px)")

  const itemsPerView = isSmallMobile ? 3 : isMobile ? 3 : isTablet ? 5 : 6
  const mobileItemWidth = "calc((100vw - 32px) / 3)"

  const maxIndex = Math.max(0, products.length - itemsPerView)

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1))
  }, [maxIndex])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!carouselRef.current || isDragging || isMobile) return
      const rect = carouselRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const width = rect.width
      setHoverSide(x < width / 2 ? "left" : "right")
    },
    [isDragging, isMobile],
  )

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) setIsHovering(true)
  }, [isMobile])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    setHoverSide(null)
  }, [])

  const handleDragStart = useCallback(() => {
    if (isMobile) return
    setIsDragging(true)
    setHoverSide(null)
  }, [isMobile])

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (isMobile) return
      setIsDragging(false)
      
      const velocity = info.velocity.x
      const offset = info.offset.x
      dragVelocityRef.current = velocity

      // Ultra-aggressive momentum detection for Jumia-speed response
      // Lower threshold + higher velocity detection = faster transitions
      if (Math.abs(offset) > 20 || Math.abs(velocity) > 150) {
        if (offset > 0 || velocity > 0) {
          if (currentIndex > 0) goToPrevious()
        } else {
          if (currentIndex < maxIndex) goToNext()
        }
      }
    },
    [currentIndex, maxIndex, goToPrevious, goToNext, isMobile],
  )

  useEffect(() => {
    const currentCarousel = carouselRef.current
    if (!currentCarousel || isMobile) return
    const handleWheelEvent = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault()
        const threshold = 10
        const delta = e.deltaX || e.deltaY
        if (Math.abs(delta) > threshold) {
          if (delta > 0 && currentIndex < maxIndex) {
            goToNext()
          } else if (delta < 0 && currentIndex > 0) {
            goToPrevious()
          }
        }
      }
    }
    currentCarousel.addEventListener("wheel", handleWheelEvent, { passive: false })
    return () => currentCarousel.removeEventListener("wheel", handleWheelEvent)
  }, [currentIndex, maxIndex, goToPrevious, goToNext, isMobile])

  // Countdown timer - updates every second on client
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const total = prev.hours * 3600 + prev.minutes * 60 + prev.seconds - 1
        if (total <= 0) {
          return { hours: 23, minutes: 59, seconds: 59 }
        }
        return {
          hours: Math.floor(total / 3600),
          minutes: Math.floor((total % 3600) / 60),
          seconds: total % 60,
        }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleViewAll = (e: React.MouseEvent) => {
    e.preventDefault()
    router.push("/flash-sales")
  }

  if (!products.length) {
    return null
  }

  return (
    <section className="w-full mb-4 sm:mb-8">
      <div className="w-full">
        <div className="bg-[#8B1538] text-white flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Zap className={`text-yellow-300 fill-yellow-300 ${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
            <h2 className={`font-bold whitespace-nowrap ${isMobile ? "text-sm" : "text-base sm:text-lg"}`}>
              {isMobile ? "Flash Sales" : "Flash Sales | Hot Deals!"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>Time Left:</span>
            <div className="flex gap-1">
              <div className="bg-white/20 rounded px-1.5 py-0.5 min-w-[24px] text-center">
                <span className="text-xs font-mono">{String(timeLeft.hours).padStart(2, "0")}</span>
              </div>
              <span className="text-xs">:</span>
              <div className="bg-white/20 rounded px-1.5 py-0.5 min-w-[24px] text-center">
                <span className="text-xs font-mono">{String(timeLeft.minutes).padStart(2, "0")}</span>
              </div>
              <span className="text-xs">:</span>
              <div className="bg-white/20 rounded px-1.5 py-0.5 min-w-[24px] text-center">
                <span className="text-xs font-mono">{String(timeLeft.seconds).padStart(2, "0")}</span>
              </div>
            </div>
            <button
              onClick={handleViewAll}
              className={`flex items-center gap-0.5 sm:gap-1 font-medium hover:underline whitespace-nowrap ${
                isMobile ? "text-xs" : "text-sm"
              }`}
            >
              See All
              <ChevronRight className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </button>
          </div>
        </div>

        <div className={isMobile ? "p-1" : "p-2"}>
          <div
            ref={carouselRef}
            className={`relative bg-gray-100 ${isMobile ? "overflow-hidden" : "overflow-hidden"}`}
            style={{
              maxWidth: isMobile ? "100%" : undefined,
              width: isMobile ? "100%" : undefined,
            }}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {isMobile ? (
              <div
                className="flex gap-1 w-full overflow-x-auto scrollbar-hide px-2"
                style={{
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                  paddingBottom: "8px",
                }}
              >
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex-shrink-0 pointer-events-auto"
                    style={{
                      width: mobileItemWidth,
                      minWidth: isSmallMobile ? "100px" : "110px",
                      maxWidth: "130px",
                      scrollSnapAlign: "start",
                    }}
                  >
                    <ProductCard product={product as FlashSaleProduct} isMobile={true} isAboveFold={index < 3} />
                  </div>
                ))}
              </div>
            ) : (
              <motion.div
                ref={motionDivRef}
                className="flex gap-[1px]"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0}
                dragTransition={{ power: 0.1, timeConstant: 80 }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={{
                  x: `-${currentIndex * (isTablet ? 20 : 16.666)}%`,
                }}
                transition={{
                  type: "spring",
                  stiffness: 350,
                  damping: 35,
                  mass: 1,
                  velocity: dragVelocityRef.current,
                }}
                style={{
                  cursor: isDragging ? "grabbing" : "grab",
                  willChange: "transform",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                  perspective: 1000,
                  WebkitFontSmoothing: "antialiased",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    className="flex-shrink-0 pointer-events-auto"
                    style={{ 
                      width: `${isTablet ? 20 : 16.666}%`,
                    }}
                  >
                    <ProductCard product={product as FlashSaleProduct} isMobile={false} isAboveFold={index < itemsPerView} />
                  </motion.div>
                ))}
              </motion.div>
            )}

            <AnimatePresence>
              {!isMobile && isHovering && !isDragging && hoverSide === "left" && currentIndex > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.1 }}
                  onClick={goToPrevious}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-colors z-20"
                  style={{ willChange: "opacity, transform" }}
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                </motion.button>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {!isMobile && isHovering && !isDragging && hoverSide === "right" && currentIndex < maxIndex && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.1 }}
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-colors z-20"
                  style={{ willChange: "opacity, transform" }}
                >
                  <ChevronRight className="w-5 h-5 text-gray-700" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
