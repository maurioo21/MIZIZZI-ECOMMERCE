"use client"

import {
  useState,
  useEffect,
  useCallback,
  memo,
  useRef,
  useMemo,
} from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { ShoppingBag, Star, Package } from "lucide-react"

import { productService } from "@/services/product"
import { cloudinaryService } from "@/services/cloudinary-service"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Product } from "@/types"

type ProductImageLike = {
  url?: string
  is_primary?: boolean
}

type ProductResponse =
  | Product[]
  | {
      items?: Product[]
      products?: Product[]
      data?: Product[]
      hasMore?: boolean
      total?: number
      page?: number
      pages?: number
    }

const GRID_ANIMATION_ENABLED = false

const LogoPlaceholder = memo(function LogoPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white">
      <div className="relative h-6 w-6 sm:h-8 sm:w-8">
        <Image
          src="/logo.png"
          alt="Loading"
          fill
          sizes="32px"
          className="object-contain"
          priority={false}
        />
      </div>
    </div>
  )
})

const StarRating = memo(function StarRating({
  rating = 4,
}: {
  rating?: number
}) {
  const safeRating = Math.min(5, Math.max(0, rating))

  return (
    <div className="flex items-center" aria-label={`Rated ${safeRating} out of 5`}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const full = star <= Math.floor(safeRating)
          const half = !full && star - 0.5 <= safeRating

          return (
            <Star
              key={star}
              className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                full
                  ? "fill-yellow-400 text-yellow-400"
                  : half
                    ? "fill-yellow-400/50 text-yellow-400"
                    : "fill-gray-200 text-gray-200"
              }`}
            />
          )
        })}
      </div>
    </div>
  )
})

function optimizeImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return ""

  const trimmed = rawUrl.trim()
  if (!trimmed) return ""

  if (trimmed.startsWith("http") || trimmed.startsWith("/")) {
    return trimmed
  }

  const optimized = cloudinaryService.generateOptimizedUrl(trimmed)
  return optimized && optimized !== "/placeholder.svg" ? optimized : ""
}

function resolvePrimaryImage(product: Product): string {
  const directImage = optimizeImageUrl((product as any).image)
  if (directImage) return directImage

  const thumbnail = optimizeImageUrl(product.thumbnail_url)
  if (thumbnail) return thumbnail

  if (Array.isArray(product.image_urls)) {
    for (const url of product.image_urls) {
      const resolved = optimizeImageUrl(url)
      if (resolved) return resolved
    }
  }

  if (Array.isArray(product.images)) {
    const primary = product.images.find(
      (img: ProductImageLike) => img?.is_primary && img?.url,
    )
    const firstValid =
      primary ||
      product.images.find((img: ProductImageLike) => Boolean(img?.url))

    if (firstValid?.url) {
      return optimizeImageUrl(firstValid.url)
    }
  }

  return ""
}

function resolveSecondaryImage(
  product: Product,
  primaryImageUrl: string,
): string {
  const seen = new Set<string>()
  if (primaryImageUrl) seen.add(primaryImageUrl)

  if (Array.isArray(product.image_urls)) {
    for (const rawUrl of product.image_urls) {
      const resolved = optimizeImageUrl(rawUrl)
      if (resolved && !seen.has(resolved)) {
        return resolved
      }
    }
  }

  if (Array.isArray(product.images)) {
    const normalizedImages = product.images
      .map((img: ProductImageLike) => ({
        resolved: optimizeImageUrl(img?.url),
        isPrimary: Boolean(img?.is_primary),
      }))
      .filter((img) => Boolean(img.resolved))

    const nonPrimaryDifferent = normalizedImages.find(
      (img) => !img.isPrimary && img.resolved && !seen.has(img.resolved),
    )
    if (nonPrimaryDifferent?.resolved) return nonPrimaryDifferent.resolved

    const anyDifferent = normalizedImages.find(
      (img) => img.resolved && !seen.has(img.resolved),
    )
    if (anyDifferent?.resolved) return anyDifferent.resolved
  }

  return ""
}

function normalizeProductResponse(
  response: ProductResponse,
  limit: number,
): { items: Product[]; hasMore: boolean } {
  if (Array.isArray(response)) {
    return {
      items: response,
      hasMore: response.length >= limit,
    }
  }

  const items = response.items || response.products || response.data || []

  let hasMore = false

  if (typeof response.hasMore === "boolean") {
    hasMore = response.hasMore
  } else if (
    typeof response.total === "number" &&
    typeof response.page === "number"
  ) {
    hasMore = response.page * limit < response.total
  } else if (
    typeof response.pages === "number" &&
    typeof response.page === "number"
  ) {
    hasMore = response.page < response.pages
  } else {
    hasMore = items.length >= limit
  }

  return { items, hasMore }
}

const ProductCard = memo(function ProductCard({
  product,
  index,
  isNewlyLoaded = false,
}: {
  product: Product
  index: number
  isNewlyLoaded?: boolean
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [primaryImageLoaded, setPrimaryImageLoaded] = useState(false)
  const [secondaryImageLoaded, setSecondaryImageLoaded] = useState(false)

  const placeholderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  const primaryImage = useMemo(() => resolvePrimaryImage(product), [product])
  const secondaryImage = useMemo(
    () => resolveSecondaryImage(product, primaryImage),
    [product, primaryImage],
  )

  const hasHoverImage = Boolean(secondaryImage) && isDesktop

  const safePrice =
    typeof product.sale_price === "number" && product.sale_price > 0
      ? product.sale_price
      : product.price

  const discountPercentage =
    typeof product.sale_price === "number" &&
    product.sale_price > 0 &&
    product.price > product.sale_price
      ? Math.round(((product.price - product.sale_price) / product.price) * 100)
      : 0

  const rating =
    typeof product.rating === "number" && Number.isFinite(product.rating)
      ? product.rating
      : 4

  const href = `/product/${product.slug || product.id}`

  const clearPlaceholderTimer = useCallback(() => {
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current)
      placeholderTimeoutRef.current = null
    }
  }, [])

  const handlePrimaryImageLoad = useCallback(() => {
    setPrimaryImageLoaded(true)
    setImageError(false)
    clearPlaceholderTimer()

    placeholderTimeoutRef.current = setTimeout(() => {
      setShowPlaceholder(false)
    }, 180)
  }, [clearPlaceholderTimer])

  const handlePrimaryImageError = useCallback(() => {
    clearPlaceholderTimer()
    setImageError(true)
    setPrimaryImageLoaded(false)
    setShowPlaceholder(true)
  }, [clearPlaceholderTimer])

  const handleSecondaryImageLoad = useCallback(() => {
    setSecondaryImageLoaded(true)
  }, [])

  useEffect(() => {
    clearPlaceholderTimer()
    setShowPlaceholder(true)
    setImageError(false)
    setIsHovering(false)
    setPrimaryImageLoaded(false)
    setSecondaryImageLoaded(false)

    return clearPlaceholderTimer
  }, [product.id, primaryImage, secondaryImage, clearPlaceholderTimer])

  const motionProps = GRID_ANIMATION_ENABLED
    ? {
        initial: { opacity: 0, y: 10 },
        animate: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.2,
            delay: isNewlyLoaded ? index * 0.03 : index * 0.01,
          },
        },
      }
    : {}

  return (
    <Link
      href={href}
      className="block h-full"
      aria-label={`View ${product.name}`}
      scroll
    >
      <motion.div
        {...motionProps}
        whileHover={isDesktop ? { y: -2, transition: { duration: 0.18 } } : undefined}
        className="h-full"
      >
        <article className="group h-full overflow-hidden border-b border-r border-gray-100 bg-white transition-shadow duration-200 hover:shadow-sm">
          <div
            className="relative aspect-square overflow-hidden bg-[#f8f8f8]"
            onMouseEnter={() => {
              if (hasHoverImage) setIsHovering(true)
            }}
            onMouseLeave={() => setIsHovering(false)}
          >
            {showPlaceholder && <LogoPlaceholder />}

            {primaryImage && !imageError ? (
              <div
                className={`absolute inset-0 transition-opacity duration-300 ${
                  primaryImageLoaded && !(isDesktop && isHovering && hasHoverImage)
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              >
                <Image
                  src={primaryImage}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                  quality={80}
                  onLoad={handlePrimaryImageLoad}
                  onError={handlePrimaryImageError}
                />
              </div>
            ) : null}

            {secondaryImage && isDesktop ? (
              <div
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isHovering && secondaryImageLoaded ? "opacity-100" : "opacity-0"
                }`}
              >
                <Image
                  src={secondaryImage}
                  alt={`${product.name} alternate view`}
                  fill
                  sizes="16vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                  quality={75}
                  onLoad={handleSecondaryImageLoad}
                />
              </div>
            ) : null}

            {discountPercentage > 0 ? (
              <div className="absolute left-0.5 top-0.5 z-20 rounded-sm bg-[#8B1538] px-1 py-0.5 text-[8px] font-medium text-white sm:left-1 sm:top-1 sm:px-1.5 sm:text-[10px] md:text-xs">
                -{discountPercentage}%
              </div>
            ) : null}
          </div>

          <div className="p-1.5 sm:p-2 md:p-3">
            <h3 className="mb-1 line-clamp-2 min-h-[24px] text-[10px] leading-tight text-gray-800 sm:mb-1.5 sm:min-h-[32px] sm:text-xs md:min-h-[40px] md:text-sm">
              {product.name}
            </h3>

            <div className="mb-1 sm:mb-1.5">
              <span className="text-[11px] font-semibold text-[#8B1538] sm:text-sm md:text-base">
                KSh {safePrice.toLocaleString()}
              </span>

              {typeof product.sale_price === "number" &&
              product.sale_price > 0 &&
              product.price > product.sale_price ? (
                <span className="ml-1 text-[8px] text-gray-400 line-through sm:ml-1.5 sm:text-[10px] md:text-xs">
                  KSh {product.price.toLocaleString()}
                </span>
              ) : null}
            </div>

            <StarRating rating={rating} />
          </div>
        </article>
      </motion.div>
    </Link>
  )
})

const ProductGridSkeleton = memo(function ProductGridSkeleton({
  count = 12,
}: {
  count?: number
}) {
  return (
    <section className="w-full">
      <div className="grid grid-cols-3 gap-[1px] bg-gray-100 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white p-1.5 sm:p-2 md:p-3">
            <div className="relative mb-1.5 aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 sm:mb-2">
              <div
                className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                  animationDelay: `${i * 80}ms`,
                }}
              />
              <div className="relative z-10 flex h-full items-center justify-center">
                <Package className="h-4 w-4 text-gray-300 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200/80 sm:h-3 md:h-3.5">
                <div
                  className="h-full w-full -translate-x-full animate-[shimmer_1.8s_infinite]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)",
                    animationDelay: `${i * 80 + 50}ms`,
                  }}
                />
              </div>

              <div className="h-2.5 w-2/3 rounded-full bg-gray-200/60 sm:h-3 md:h-3.5" />

              <div className="h-3 w-1/2 overflow-hidden rounded-full bg-[#8B1538]/10 sm:h-3.5 md:h-4">
                <div
                  className="h-full w-full -translate-x-full animate-[shimmer_1.8s_infinite]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(139,21,56,0.12) 50%, transparent 100%)",
                    animationDelay: `${i * 80 + 100}ms`,
                  }}
                />
              </div>

              <div className="flex gap-0.5 sm:gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-2.5 w-2.5 rounded-full bg-yellow-100 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5"
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </section>
  )
})

interface ProductGridProps {
  limit?: number
  category?: string
  initialProducts?: Product[]
  initialHasMore?: boolean
}

export function ProductGrid({
  limit = 12,
  category,
  initialProducts = [],
  initialHasMore = true,
}: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [loading, setLoading] = useState(initialProducts.length === 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [newlyLoadedStartIndex, setNewlyLoadedStartIndex] = useState<number | null>(null)

  const initialLoadDone = useRef(initialProducts.length > 0)
  const isMountedRef = useRef(true)
  const fetchRequestIdRef = useRef(0)

  const fetchProducts = useCallback(
    async (pageNum = 1, append = false) => {
      const requestId = ++fetchRequestIdRef.current

      try {
        if (append) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }

        setError(null)

        let response: ProductResponse

        if (category) {
          if (typeof productService.getProductsByCategory === "function") {
            // getProductsByCategory expects a category slug string; call it with the slug
            // and paginate the returned array client-side to match expected paging behavior.
            const allCategoryProducts = await productService.getProductsByCategory(
              String(category),
            )
            const start = (pageNum - 1) * limit
            const pagedItems = Array.isArray(allCategoryProducts)
              ? allCategoryProducts.slice(start, start + limit)
              : []

            // normalizeProductResponse accepts an array as a valid ProductResponse
            response = pagedItems
          } else {
            response = await productService.getProducts({
              category,
              page: pageNum,
              limit,
            })
          }
        } else {
          response = await productService.getProducts({
            page: pageNum,
            limit,
          })
        }

        if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
          return
        }

        const { items, hasMore: nextHasMore } = normalizeProductResponse(
          response,
          limit,
        )

        if (append) {
          setProducts((prev) => {
            const existingIds = new Set(prev.map((item) => item.id))
            const uniqueIncoming = items.filter((item) => !existingIds.has(item.id))

            setNewlyLoadedStartIndex(prev.length)
            return [...prev, ...uniqueIncoming]
          })
        } else {
          setNewlyLoadedStartIndex(null)
          setProducts(items)
        }

        setHasMore(nextHasMore)
      } catch (err) {
        console.error("Error fetching products:", err)

        if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
          return
        }

        setError("Failed to load products")
      } finally {
        if (
          isMountedRef.current &&
          requestId === fetchRequestIdRef.current
        ) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [category, limit],
  )

  const handleShowMore = useCallback(async () => {
    if (loadingMore || !hasMore) return

    const nextPage = page + 1
    setPage(nextPage)
    await fetchProducts(nextPage, true)
  }, [fetchProducts, hasMore, loadingMore, page])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!initialLoadDone.current && initialProducts.length === 0) {
      initialLoadDone.current = true
      void fetchProducts(1, false)
    }
  }, [fetchProducts, initialProducts.length])

  useEffect(() => {
    if (initialLoadDone.current) {
      setPage(1)
      setProducts(initialProducts.length > 0 ? initialProducts : [])
      setHasMore(initialHasMore)
      setNewlyLoadedStartIndex(null)

      if (initialProducts.length === 0) {
        void fetchProducts(1, false)
      }
    }
  }, [category, limit, fetchProducts, initialHasMore, initialProducts])

  useEffect(() => {
    const handleProductImagesUpdated = () => {
      setPage(1)
      setNewlyLoadedStartIndex(null)
      void fetchProducts(1, false)
    }

    window.addEventListener(
      "productImagesUpdated",
      handleProductImagesUpdated as EventListener,
    )

    return () => {
      window.removeEventListener(
        "productImagesUpdated",
        handleProductImagesUpdated as EventListener,
      )
    }
  }, [fetchProducts])

  if (loading) {
    return <ProductGridSkeleton count={limit} />
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-center text-[#8B1538]">
        <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-[#8B1538]" />
        <p className="mb-2">{error}</p>
        <button
          onClick={() => void fetchProducts(1, false)}
          className="rounded-md bg-[#8B1538] px-4 py-2 text-sm text-white transition-colors hover:bg-[#6d1029]"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="rounded-md bg-gray-50 p-8 text-center text-gray-500">
        <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <p>No products found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-3 gap-[1px] bg-gray-100 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {products.map((product, index) => (
          <ProductCard
            key={`${product.id}-${product.slug || "product"}`}
            product={product}
            index={
              newlyLoadedStartIndex !== null && index >= newlyLoadedStartIndex
                ? index - newlyLoadedStartIndex
                : index
            }
            isNewlyLoaded={
              newlyLoadedStartIndex !== null && index >= newlyLoadedStartIndex
            }
          />
        ))}
      </div>

      {hasMore ? (
        <div className="border-t border-gray-100 bg-white py-6 sm:py-8">
          <div className="flex justify-center">
            <button
              onClick={handleShowMore}
              disabled={loadingMore}
              className="relative flex min-w-[180px] items-center justify-center rounded-full border border-gray-300 bg-white px-12 py-2.5 text-xs font-medium uppercase tracking-widest text-gray-600 transition-all duration-200 hover:border-gray-400 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[200px] sm:px-16 sm:py-3 sm:text-sm"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
            >
              {loadingMore ? (
                <div className="relative h-5 w-5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute left-1/2 top-0 h-[5px] w-[2px] rounded-full bg-[#8B1538] opacity-20"
                      style={{
                        transform: `translateX(-50%) rotate(${i * 30}deg)`,
                        transformOrigin: "50% 10px",
                        animation: `spinnerFade 1s linear infinite`,
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span>Show More</span>
              )}
            </button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes spinnerFade {
          0%,
          100% {
            opacity: 0.18;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}