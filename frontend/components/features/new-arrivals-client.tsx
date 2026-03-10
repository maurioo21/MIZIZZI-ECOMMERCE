"use client"

import type React from "react"
import { useState, useCallback, memo, useRef, useEffect, useMemo } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import Link from "next/link"
import { ChevronRight, ChevronLeft, Sparkles, Star } from "lucide-react"
import Image from "next/image"
import type { Product } from "@/types"
import { useRouter } from "next/navigation"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cloudinaryService } from "@/services/cloudinary-service"

type ProductImageLike = {
  url?: string
  is_primary?: boolean
}

const LogoPlaceholder = memo(function LogoPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white">
      <div className="relative h-12 w-12 sm:h-16 sm:w-16">
        <Image src="/logo.png" alt="Loading" fill sizes="64px" className="object-contain" />
      </div>
    </div>
  )
})

const StarRating = memo(function StarRating({ rating = 4 }: { rating?: number }) {
  const safeRating = Math.min(5, Math.max(1, rating))

  return (
    <div className="flex items-center">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${star <= Math.floor(safeRating)
                ? "fill-yellow-400 text-yellow-400"
                : star - 0.5 <= safeRating
                  ? "fill-yellow-400/50 text-yellow-400"
                  : "fill-gray-200 text-gray-200"
              }`}
          />
        ))}
      </div>
    </div>
  )
})

function optimizeImageUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return ""
  }

  if (rawUrl.startsWith("http") || rawUrl.startsWith("/")) {
    return rawUrl
  }

  const optimized = cloudinaryService.generateOptimizedUrl(rawUrl)
  return optimized && optimized !== "/placeholder.svg" ? optimized : ""
}

function resolvePrimaryImage(product: Product): string {
  const directImage = optimizeImageUrl((product as any).image)
  if (directImage) return directImage

  const thumbnail = optimizeImageUrl(product.thumbnail_url)
  if (thumbnail) return thumbnail

  if (Array.isArray(product.image_urls) && product.image_urls.length > 0) {
    for (const url of product.image_urls) {
      const resolved = optimizeImageUrl(url)
      if (resolved) return resolved
    }
  }

  if (Array.isArray(product.images) && product.images.length > 0) {
    const primary = product.images.find((img: any) => img?.is_primary && img?.url)
    const firstValid = primary || product.images.find((img: any) => img?.url)

    if (firstValid?.url) {
      const resolved = optimizeImageUrl(firstValid.url)
      if (resolved) return resolved
    }
  }

  return ""
}

function resolveSecondaryImage(product: Product, primaryImageUrl: string): string {
  const seen = new Set<string>()
  if (primaryImageUrl) {
    seen.add(primaryImageUrl)
  }

  if (Array.isArray(product.image_urls) && product.image_urls.length > 1) {
    for (const rawUrl of product.image_urls) {
      const resolved = optimizeImageUrl(rawUrl)
      if (resolved && !seen.has(resolved)) {
        return resolved
      }
    }
  }

  if (Array.isArray(product.images) && product.images.length > 1) {
    const normalizedImages = product.images
      .map((img: ProductImageLike) => ({
        resolved: optimizeImageUrl(img?.url),
        isPrimary: Boolean(img?.is_primary),
      }))
      .filter((img) => Boolean(img.resolved))

    const nonPrimaryDifferent = normalizedImages.find((img) => !img.isPrimary && img.resolved && !seen.has(img.resolved))
    if (nonPrimaryDifferent?.resolved) {
      return nonPrimaryDifferent.resolved
    }

    const anyDifferent = normalizedImages.find((img) => img.resolved && !seen.has(img.resolved))
    if (anyDifferent?.resolved) {
      return anyDifferent.resolved
    }
  }

  return ""
}

const ProductCard = memo(function ProductCard({
  product,
  isMobile,
  isAboveFold = false,
}: {
  product: Product
  isMobile: boolean
  isAboveFold?: boolean
}) {
  const [imageError, setImageError] = useState(false)

  const imageUrl = useMemo(() => resolvePrimaryImage(product), [product])
  const secondaryImageUrl = useMemo(() => resolveSecondaryImage(product, imageUrl), [product, imageUrl])

  const hasValidImage = imageUrl.length > 0
  const hasMultipleImages = !isMobile && secondaryImageUrl.length > 0

  const discountPercentage =
    typeof product.sale_price === "number" && product.price > 0
      ? Math.round(((product.price - product.sale_price) / product.price) * 100)
      : 0

  const rating = typeof product.rating === "number" ? product.rating : 4

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  return (
    <Link href={`/product/${product.slug || product.id}`} prefetch={false}>
      <div className="h-full">
        <div className="group h-full overflow-hidden border-r border-gray-100 bg-white transition-shadow duration-200 hover:shadow-sm">
          <div className="relative aspect-square overflow-hidden bg-[#f8f8f8]">
            {(imageError || !hasValidImage) && <LogoPlaceholder />}

            {hasValidImage && (
              <>
                <Image
                  src={imageUrl}
                  alt={product.name}
                  fill
                  sizes={isMobile ? "25vw" : "16vw"}
                  className={`object-cover transition-opacity duration-500 ${hasMultipleImages ? "group-hover:opacity-0" : ""
                    }`}
                  loading={isAboveFold ? "eager" : "lazy"}
                  priority={isAboveFold}
                  onError={handleImageError}
                />

                {hasMultipleImages && (
                  <Image
                    src={secondaryImageUrl}
                    alt={`${product.name} alternate view`}
                    fill
                    sizes={isMobile ? "25vw" : "16vw"}
                    className="absolute inset-0 object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    loading="lazy"
                    priority={false}
                    onError={handleImageError}
                  />
                )}
              </>
            )}

            {product.sale_price && discountPercentage > 0 && (
              <div className="pointer-events-none absolute left-1 top-1 z-20 rounded-sm bg-[#8B1538] px-1.5 py-0.5 text-[10px] font-medium text-white sm:text-xs">
                -{discountPercentage}%
              </div>
            )}
          </div>

          <div className={isMobile ? "p-2" : "p-3"}>
            <h3
              className={`mb-1.5 line-clamp-2 leading-tight text-gray-800 ${isMobile ? "min-h-[32px] text-xs" : "min-h-[40px] text-sm"
                }`}
            >
              {product.name}
            </h3>

            <div className="mb-1.5">
              <span className={`font-semibold text-[#8B1538] ${isMobile ? "text-sm" : "text-base"}`}>
                KSh {(product.sale_price || product.price).toLocaleString()}
              </span>
              {product.sale_price && (
                <span className={`ml-1.5 text-gray-400 line-through ${isMobile ? "text-[10px]" : "text-xs"}`}>
                  KSh {product.price.toLocaleString()}
                </span>
              )}
            </div>

            <StarRating rating={rating} />
          </div>
        </div>
      </div>
    </Link>
  )
})

interface NewArrivalsClientProps {
  initialProducts: Product[]
}

export function NewArrivalsClient({ initialProducts }: NewArrivalsClientProps) {
  const products = initialProducts ?? []

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const carouselRef = useRef<HTMLDivElement>(null)
  const hoverSideRef = useRef<"left" | "right" | null>(null)
  const dragVelocityRef = useRef(0)

  const router = useRouter()

  const isMobile = useMediaQuery("(max-width: 640px)")
  const isSmallMobile = useMediaQuery("(max-width: 480px)")
  const isTablet = useMediaQuery("(max-width: 1024px)")

  const itemsPerView = isSmallMobile ? 3 : isMobile ? 3 : isTablet ? 5 : 6
  const mobileItemWidth = "calc((100vw - 32px) / 3)"
  const desktopItemWidth = isTablet ? 20 : 16.666
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
      const nextSide: "left" | "right" = x < rect.width / 2 ? "left" : "right"

      if (hoverSideRef.current !== nextSide) {
        hoverSideRef.current = nextSide
        setHoverSide(nextSide)
      }
    },
    [isDragging, isMobile],
  )

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) setIsHovering(true)
  }, [isMobile])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    setHoverSide(null)
    hoverSideRef.current = null
  }, [])

  const handleDragStart = useCallback(() => {
    if (isMobile) return
    setIsDragging(true)
    setHoverSide(null)
    hoverSideRef.current = null
  }, [isMobile])

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (isMobile) return

      setIsDragging(false)

      const velocity = info.velocity.x
      const offset = info.offset.x
      dragVelocityRef.current = velocity

      if (Math.abs(offset) > 20 || Math.abs(velocity) > 150) {
        if (offset > 0 || velocity > 0) {
          if (currentIndex > 0) goToPrevious()
        } else {
          if (currentIndex < maxIndex) goToNext()
        }
      }
    },
    [currentIndex, goToNext, goToPrevious, isMobile, maxIndex],
  )

  useEffect(() => {
    const currentCarousel = carouselRef.current
    if (!currentCarousel || isMobile) return

    const handleWheelEvent = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault()

        const delta = e.deltaX || e.deltaY
        if (Math.abs(delta) <= 10) return

        setCurrentIndex((prevIndex) => {
          const nextMaxIndex = Math.max(0, products.length - itemsPerView)

          if (delta > 0 && prevIndex < nextMaxIndex) return prevIndex + 1
          if (delta < 0 && prevIndex > 0) return prevIndex - 1
          return prevIndex
        })
      }
    }

    currentCarousel.addEventListener("wheel", handleWheelEvent, { passive: false })
    return () => currentCarousel.removeEventListener("wheel", handleWheelEvent)
  }, [isMobile, itemsPerView, products.length])

  const handleViewAll = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      router.push("/new-arrivals")
    },
    [router],
  )

  if (!products.length) {
    return null
  }

  return (
    <section className="mb-4 w-full sm:mb-8">
      <div className="w-full">
        <div className="flex items-center justify-between bg-[#8B1538] px-2 py-1.5 text-white sm:px-4 sm:py-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Sparkles className={`h-4 w-4 text-yellow-300 sm:h-5 sm:w-5`} />
            <h2 className={`whitespace-nowrap font-bold ${isMobile ? "text-sm" : "text-base sm:text-lg"}`}>
              {isMobile ? "New Arrivals" : "New Arrivals | Fresh Collection!"}
            </h2>
          </div>

          <button
            onClick={handleViewAll}
            className={`flex items-center gap-0.5 whitespace-nowrap font-medium hover:underline sm:gap-1 ${isMobile ? "text-xs" : "text-sm"
              }`}
          >
            See All
            <ChevronRight className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>
        </div>

        <div className={isMobile ? "p-1" : "p-2"}>
          <div
            ref={carouselRef}
            className="relative overflow-hidden bg-gray-100"
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {isMobile ? (
              <div
                className="scrollbar-hide flex w-full gap-1 overflow-x-auto px-2"
                style={{
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                  paddingBottom: "8px",
                }}
              >
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className="pointer-events-auto flex-shrink-0"
                    style={{
                      width: mobileItemWidth,
                      minWidth: isSmallMobile ? "100px" : "110px",
                      maxWidth: "130px",
                      scrollSnapAlign: "start",
                    }}
                  >
                    <ProductCard product={product} isMobile={true} isAboveFold={index < 3} />
                  </div>
                ))}
              </div>
            ) : (
              <motion.div
                className="flex gap-[1px]"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0}
                dragTransition={{ power: 0.1, timeConstant: 80 }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={{ x: `-${currentIndex * desktopItemWidth}%` }}
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
                  <div
                    key={product.id}
                    className="pointer-events-auto flex-shrink-0"
                    style={{ width: `${desktopItemWidth}%` }}
                  >
                    <ProductCard product={product} isMobile={false} isAboveFold={index < itemsPerView} />
                  </div>
                ))}
              </motion.div>
            )}

            <AnimatePresence>
              {!isMobile && isHovering && !isDragging && hoverSide === "left" && currentIndex > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  onClick={goToPrevious}
                  className="pointer-events-auto absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700" />
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!isMobile && isHovering && !isDragging && hoverSide === "right" && currentIndex < maxIndex && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  onClick={goToNext}
                  className="pointer-events-auto absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white"
                >
                  <ChevronRight className="h-5 w-5 text-gray-700" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
