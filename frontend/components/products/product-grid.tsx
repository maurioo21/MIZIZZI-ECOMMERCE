"use client"
import { useState, useEffect, useCallback, memo, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { productService } from "@/services/product"
import { ShoppingBag, Star, Package } from "lucide-react"
import type { Product } from "@/types"
import { cloudinaryService } from "@/services/cloudinary-service"

type ProductImageLike = {
  url?: string
  is_primary?: boolean
}

const LogoPlaceholder = memo(() => (
  <div className="absolute inset-0 flex items-center justify-center bg-white">
    <div className="relative h-6 w-6 sm:h-8 sm:w-8">
      <Image src="/logo.png" alt="Loading" fill sizes="32px" className="object-contain" />
    </div>
  </div>
))

LogoPlaceholder.displayName = "LogoPlaceholder"

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

const ProductCard = memo(
  ({ product, index, isNewlyLoaded = false }: { product: Product; index: number; isNewlyLoaded?: boolean }) => {
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)
    const [showPlaceholder, setShowPlaceholder] = useState(true)
    const [isHovering, setIsHovering] = useState(false)
    const [primaryImageLoaded, setPrimaryImageLoaded] = useState(false)
    const [secondaryImageLoaded, setSecondaryImageLoaded] = useState(false)

    const discountPercentage = product.sale_price
      ? Math.round(((product.price - product.sale_price) / product.price) * 100)
      : 0

    const primaryImage = useMemo(() => resolvePrimaryImage(product), [product])
    const secondaryImage = useMemo(() => resolveSecondaryImage(product, primaryImage), [product, primaryImage])
    const hasHoverImage = Boolean(secondaryImage)

    const handlePrimaryImageLoad = useCallback(() => {
      setPrimaryImageLoaded(true)
      setImageLoaded(true)
      setTimeout(() => setShowPlaceholder(false), 300)
    }, [])

    const handlePrimaryImageError = useCallback(() => {
      setImageError(true)
      setPrimaryImageLoaded(false)
    }, [])

    const handleSecondaryImageLoad = useCallback(() => {
      setSecondaryImageLoaded(true)
    }, [])

    const productId = product.id
    useEffect(() => {
      setPrimaryImageLoaded(false)
      setSecondaryImageLoaded(false)
      setImageLoaded(false)
      setImageError(false)
      setShowPlaceholder(true)
      setIsHovering(false)
    }, [productId])

    const rating = product.rating || 3.5 + Math.random() * 1.5

    const cardVariants = {
      hidden: {
        opacity: 0,
        y: 30,
        scale: 0.95,
      },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          type: "spring",
          stiffness: 100,
          damping: 15,
          delay: isNewlyLoaded ? index * 0.05 : index * 0.02,
        },
      },
    }

    return (
      <Link href={`/product/${product.slug || product.id}`} prefetch={false}>
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="h-full"
        >
          <div className="group h-full overflow-hidden bg-white border-b border-r border-gray-100 transition-all duration-200 hover:shadow-sm">
            <div
              className="relative aspect-square overflow-hidden bg-[#f8f8f8]"
              onMouseEnter={() => hasHoverImage && setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <AnimatePresence>
                {(showPlaceholder || imageError) && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    className="absolute inset-0 z-10"
                  >
                    <LogoPlaceholder />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Primary Image */}
              {primaryImage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: primaryImageLoaded && !isHovering ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={primaryImage}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onLoad={handlePrimaryImageLoad}
                    onError={handlePrimaryImageError}
                  />
                </motion.div>
              )}

              {/* Secondary Image - shows on hover */}
              {secondaryImage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovering && secondaryImageLoaded ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={secondaryImage}
                    alt={`${product.name} - alternate view`}
                    fill
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    quality={75}
                    onLoad={handleSecondaryImageLoad}
                  />
                </motion.div>
              )}

              {product.sale_price && discountPercentage > 0 && (
                <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 bg-[#8B1538] text-white text-[8px] sm:text-[10px] md:text-xs font-medium px-1 sm:px-1.5 py-0.5 rounded-sm z-20">
                  -{discountPercentage}%
                </div>
              )}
            </div>

            <div className="p-1.5 sm:p-2 md:p-3">
              <h3 className="text-gray-800 text-[10px] sm:text-xs md:text-sm line-clamp-2 leading-tight mb-1 sm:mb-1.5 min-h-[24px] sm:min-h-[32px] md:min-h-[40px]">
                {product.name}
              </h3>

              <div className="mb-1 sm:mb-1.5">
                <span className="font-semibold text-[#8B1538] text-[11px] sm:text-sm md:text-base">
                  KSh {(product.sale_price || product.price).toLocaleString()}
                </span>
                {product.sale_price && (
                  <span className="text-gray-400 line-through ml-1 sm:ml-1.5 text-[8px] sm:text-[10px] md:text-xs">
                    KSh {product.price.toLocaleString()}
                  </span>
                )}
              </div>

              <StarRating rating={rating} />
            </div>
          </div>
        </motion.div>
      </Link>
    )
  },
)

ProductCard.displayName = "ProductCard"

const ProductGridSkeleton = ({ count = 12 }: { count?: number }) => (
  <section className="w-full">
    <div className="w-full">
      <div className="grid grid-cols-3 gap-[1px] bg-gray-100 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {[...Array(count)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white p-1.5 sm:p-2 md:p-3"
          >
            {/* Image placeholder with shimmer */}
            <div className="aspect-square w-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden mb-1.5 sm:mb-2 rounded-lg">
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                  animationDelay: `${i * 100}ms`,
                }}
              />
              {/* Centered package icon */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.4, 0.6, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                  delay: i * 0.1,
                }}
                className="text-center z-10"
              >
                <Package className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-gray-300" />
              </motion.div>
            </div>

            {/* Text placeholders */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="h-2.5 sm:h-3 md:h-3.5 w-full bg-gray-200/80 rounded-full relative overflow-hidden">
                <div
                  className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)",
                    animationDelay: `${i * 100 + 50}ms`,
                  }}
                />
              </div>
              <div className="h-2.5 sm:h-3 md:h-3.5 w-2/3 bg-gray-200/60 rounded-full" />
              {/* Price placeholder with brand color tint */}
              <div className="h-3 sm:h-3.5 md:h-4 w-1/2 bg-[#8B1538]/10 rounded-full relative overflow-hidden">
                <div
                  className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(139,21,56,0.1) 50%, transparent 100%)",
                    animationDelay: `${i * 100 + 100}ms`,
                  }}
                />
              </div>
              {/* Star rating placeholder */}
              <div className="flex gap-0.5 sm:gap-1">
                {[...Array(5)].map((_, j) => (
                  <div
                    key={j}
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 bg-yellow-100 rounded-full"
                    style={{ animationDelay: `${j * 50}ms` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
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

interface ProductGridProps {
  limit?: number
  category?: string
  initialProducts?: Product[]
  initialHasMore?: boolean
}

export function ProductGrid({ limit = 12, category, initialProducts = [], initialHasMore = true }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts || [])
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore !== undefined ? initialHasMore : true)
  const [newlyLoadedStartIndex, setNewlyLoadedStartIndex] = useState<number | null>(null)

  const productsLengthRef = useRef(0)
  const initialLoadDone = useRef(!!initialProducts && initialProducts.length > 0)

  const fetchProducts = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (append) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }
        setError(null)

      // Use the dedicated category method if category is specified
      const data = category
        ? await productService.getProductsByCategory(category)
        : await productService.getProducts({
            limit,
            page: pageNum,
          })

        if (append) {
          setProducts((prev) => {
            setNewlyLoadedStartIndex(prev.length)
            productsLengthRef.current = prev.length + (data || []).length
            return [...prev, ...(data || [])]
          })
        } else {
          setNewlyLoadedStartIndex(null)
          setProducts(data || [])
          productsLengthRef.current = (data || []).length
        }

        setHasMore((data || []).length >= limit)
      } catch (err) {
        console.error("Error fetching products:", err)
        setError("Failed to load products")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [limit, category],
  )

  const handleShowMore = async () => {
    const nextPage = page + 1
    setPage(nextPage)
    await fetchProducts(nextPage, true)
  }

  useEffect(() => {
    // Only fetch if we don't have initial products from server
    if (!initialLoadDone.current && (!initialProducts || initialProducts.length === 0)) {
      initialLoadDone.current = true
      fetchProducts()
    }
  }, [initialProducts])

  useEffect(() => {
    // Reset pagination when category or limit changes
    if (initialLoadDone.current && (!initialProducts || initialProducts.length === 0)) {
      setPage(1)
      fetchProducts(1, false)
    }
  }, [category, limit])

  useEffect(() => {
    const handleProductImagesUpdated = () => {
      setProducts([])
      setLoading(true)
      setPage(1)
      initialLoadDone.current = false

      setTimeout(() => {
        initialLoadDone.current = true
        fetchProducts()
      }, 500)
    }

    window.addEventListener("productImagesUpdated", handleProductImagesUpdated as EventListener)
    return () => {
      window.removeEventListener("productImagesUpdated", handleProductImagesUpdated as EventListener)
    }
  }, [fetchProducts])

  if (loading) {
    return <ProductGridSkeleton count={limit} />
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md text-[#8B1538] text-center">
        <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-[#8B1538]" />
        <p className="mb-2">{error}</p>
        <button
          onClick={() => fetchProducts()}
          className="px-4 py-2 bg-[#8B1538] text-white rounded-md hover:bg-[#6d1029] transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-md text-gray-500 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No products found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-3 gap-[1px] bg-gray-100 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={
              newlyLoadedStartIndex !== null && index >= newlyLoadedStartIndex ? index - newlyLoadedStartIndex : index
            }
            isNewlyLoaded={newlyLoadedStartIndex !== null && index >= newlyLoadedStartIndex}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center py-6 sm:py-8 bg-white border-t border-gray-100">
          <button
            onClick={handleShowMore}
            disabled={loadingMore}
            className="relative flex items-center justify-center px-12 sm:px-16 py-2.5 sm:py-3 bg-white text-gray-600 font-medium rounded-full border border-gray-300 hover:border-gray-400 hover:text-gray-800 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed min-w-[180px] sm:min-w-[200px] tracking-widest uppercase text-xs sm:text-sm"
            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
          >
            <AnimatePresence mode="wait">
              {loadingMore ? (
                <motion.div
                  key="spinner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center"
                >
                  <div className="relative w-5 h-5">
                    {[...Array(12)].map((_, i) => (
                      <motion.span
                        key={i}
                        className="absolute left-1/2 top-0 w-[2px] h-[5px] rounded-full origin-[50%_10px]"
                        style={{
                          transform: `translateX(-50%) rotate(${i * 30}deg)`,
                          backgroundColor: "#8B1538",
                        }}
                        animate={{
                          opacity: [0.15, 1, 0.15],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Number.POSITIVE_INFINITY,
                          delay: i * (1 / 12),
                          ease: "linear",
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Show More
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}
    </div>
  )
}
