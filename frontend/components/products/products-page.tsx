"use client"

import React, {
  useState,
  useCallback,
  useMemo,
  memo,
  useEffect,
  useRef,
} from "react"
import Link from "next/link"
import {
  Search,
  X,
  ShoppingBag,
  Heart,
  ShoppingCart,
  ChevronDown,
  Grid3X3,
  LayoutGrid,
  Tag,
  TrendingUp,
  Sparkles,
  ArrowUpDown,
  Zap,
  Loader2,
} from "lucide-react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProductsBannerCarousel } from "./banner-carousel"
import { cloudinaryService } from "@/services/cloudinary-service"
import { cn } from "@/lib/utils"
import { useCart } from "@/contexts/cart/cart-context"
import { useToast } from "@/components/ui/use-toast"

/* ─── Types ─── */
interface Product {
  id: number
  name: string
  price: number
  sale_price: number | null
  thumbnail_url: string | null
  image_urls: string[] | null
  category?: string
  slug?: string
  rating?: number
  images?: string[]
  image?: string
}

interface ProductsPageContentProps {
  initialProducts: Product[]
}

/* ─── Intersection Observer hook for reveal-on-scroll ─── */
function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    )

    const items = el.querySelectorAll(".jumia-reveal-item")
    items.forEach((item) => observer.observe(item))

    return () => observer.disconnect()
  })

  return ref
}

/* ─── Image URL helper ─── */
function getProductImageUrl(product: Product): string {
  if (product.thumbnail_url && product.thumbnail_url.startsWith("http")) {
    return product.thumbnail_url
  }
  if (
    product.image_urls &&
    Array.isArray(product.image_urls) &&
    product.image_urls.length > 0
  ) {
    const firstImage = product.image_urls[0]
    if (typeof firstImage === "string") {
      if (firstImage.startsWith("http")) return firstImage
      if (firstImage.trim() !== "" && !firstImage.startsWith("blob:")) {
        return cloudinaryService.generateOptimizedUrl(firstImage)
      }
    }
  }
  if (product.thumbnail_url && !product.thumbnail_url.startsWith("blob:")) {
    return product.thumbnail_url
  }
  return "/generic-product-display.png"
}

function getSecondImageUrl(product: Product): string | null {
  if (
    product.image_urls &&
    Array.isArray(product.image_urls) &&
    product.image_urls.length > 1
  ) {
    const secondImage = product.image_urls[1]
    if (typeof secondImage === "string" && secondImage.startsWith("http")) {
      return secondImage
    }
  }
  return null
}

/* ─── Discount helper ─── */
function calculateDiscount(price: number, salePrice: number | null): number {
  if (!salePrice || salePrice >= price) return 0
  return Math.round(((price - salePrice) / price) * 100)
}

/* ─── Jumia-style Product Card ─── */
const JumiaProductCard = memo(function JumiaProductCard({
  product,
  index,
}: {
  product: Product
  index: number
}) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showSecondImg, setShowSecondImg] = useState(false)
  const [wished, setWished] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const { addToCart } = useCart()
  const { toast } = useToast()

  const primaryImg = getProductImageUrl(product)
  const secondImg = getSecondImageUrl(product)
  const discount = calculateDiscount(product.price, product.sale_price)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsAddingToCart(true)
    try {
      const result = await addToCart(product.id, 1)
      if (result?.success) {
        toast({
          title: "Added to Cart",
          description: `${product.name} has been added to your cart.`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add product to cart. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <div
      className="jumia-reveal-item"
      style={{ animationDelay: `${(index % 12) * 0.06}s` }}
    >
      <div
        className="jumia-card group h-full flex flex-col"
        onMouseEnter={() => {
          if (secondImg) setTimeout(() => setShowSecondImg(true), 150)
        }}
        onMouseLeave={() => {
          setShowSecondImg(false)
        }}
      >
        {/* Image Section */}
        <Link
          href={`/product/${product.slug || product.id}`}
          prefetch={false}
          className="block"
        >
          <div className="jumia-img-wrap relative aspect-square">
            {/* Primary image */}
            <Image
              src={primaryImg || "/placeholder.svg"}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              className={cn(
                "object-cover transition-opacity duration-300",
                showSecondImg && secondImg ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (!target.src.includes("generic-product-display")) {
                  target.src = "/generic-product-display.png"
                }
              }}
            />

            {/* Second image on hover */}
            {secondImg && (
              <Image
                src={secondImg || "/placeholder.svg"}
                alt={`${product.name} alternate`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className={cn(
                  "object-cover transition-opacity duration-300 absolute inset-0",
                  showSecondImg ? "opacity-100" : "opacity-0"
                )}
              />
            )}

            {/* Gradient overlay on hover */}
            <div className="jumia-overlay" />

            {/* Badges */}
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
              {discount > 0 && (
                <span className="jumia-badge inline-flex items-center gap-0.5 bg-[#8B1538] text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded">
                  <Zap className="h-2.5 w-2.5" />
                  -{discount}%
                </span>
              )}
              {discount >= 30 && (
                <span className="jumia-badge jumia-new-tag inline-block bg-amber-500 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded">
                  HOT DEAL
                </span>
              )}
            </div>

            {/* Wishlist heart */}
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setWished(!wished)
              }}
              className={cn(
                "jumia-wish flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-md transition-colors",
                wished
                  ? "text-[#8B1538] opacity-100 transform scale-100"
                  : "text-gray-400 hover:text-[#8B1538]"
              )}
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart
                className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", wished && "fill-current")}
              />
            </button>

            {/* Add to Cart button on hover */}
            <div className="jumia-actions">
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="jumia-add-btn flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 bg-[#8B1538] text-white text-[10px] sm:text-xs font-semibold rounded-full shadow-lg hover:bg-[#6B1028] disabled:opacity-70"
                aria-label="Add to cart"
              >
                {isAddingToCart ? (
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                <span>{isAddingToCart ? "Adding..." : "Add to Cart"}</span>
              </button>
            </div>

            {/* Loading skeleton */}
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-[1]">
                <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#8B1538] animate-spin" />
              </div>
            )}
          </div>
        </Link>

        {/* Content Section */}
        <Link
          href={`/product/${product.slug || product.id}`}
          prefetch={false}
          className="flex flex-col flex-grow p-2 sm:p-2.5 md:p-3"
        >
          {/* Category tag */}
          {product.category && (
            <span className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-wider font-medium mb-0.5 line-clamp-1">
              {product.category}
            </span>
          )}

          {/* Product name */}
          <h3 className="text-gray-800 text-[10px] sm:text-xs md:text-sm font-medium line-clamp-2 leading-snug mb-1.5 min-h-[28px] sm:min-h-[34px] md:min-h-[40px] group-hover:text-[#8B1538] transition-colors duration-200">
            {product.name}
          </h3>

          {/* Price */}
          <div className="mt-auto flex items-baseline gap-1.5 flex-wrap">
            <span className="jumia-price-current font-bold text-[#8B1538] text-xs sm:text-sm md:text-base leading-none">
              KSh {(product.sale_price || product.price).toLocaleString()}
            </span>
            {product.sale_price && (
              <span className="text-gray-400 line-through text-[8px] sm:text-[10px] md:text-xs leading-none">
                KSh {product.price.toLocaleString()}
              </span>
            )}
          </div>

          {/* Savings callout */}
          {discount > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <Tag className="h-2.5 w-2.5 text-emerald-600" />
              <span className="text-[8px] sm:text-[9px] text-emerald-600 font-semibold">
                You save KSh{" "}
                {(product.price - (product.sale_price || product.price)).toLocaleString()}
              </span>
            </div>
          )}
        </Link>
      </div>
    </div>
  )
})

/* ─── Filter Chip ─── */
function FilterChip({
  label,
  active,
  onClick,
  icon,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200",
        active
          ? "bg-[#8B1538] text-white shadow-md shadow-[#8B1538]/20"
          : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
            active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/* ─── Main Products Page ─── */
export function ProductsPageContent({
  initialProducts,
}: ProductsPageContentProps) {
  const [sortBy, setSortBy] = useState("discount")
  const [searchQuery, setSearchQuery] = useState("")
  const [displayCount, setDisplayCount] = useState(18)
  const [loading, setLoading] = useState(false)
  const [gridCols, setGridCols] = useState<"compact" | "regular">("compact")
  const [activeFilter, setActiveFilter] = useState("all")
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Reveal ref
  const gridRef = useRevealOnScroll()

  const INITIAL_DISPLAY = 18
  const INCREMENT = 18

  // Handle show more
  const handleShowMore = () => {
    setLoading(true)
    setTimeout(() => {
      setDisplayCount((prev) => prev + INCREMENT)
      setLoading(false)
      // Re-trigger reveal observer for new items
      setTimeout(() => {
        if (gridRef.current) {
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.classList.add("revealed")
                  observer.unobserve(entry.target)
                }
              })
            },
            { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
          )
          const items = gridRef.current.querySelectorAll(
            ".jumia-reveal-item:not(.revealed)"
          )
          items.forEach((item) => observer.observe(item))
        }
      }, 50)
    }, 500)
  }

  // Handle quick view
  const handleQuickView = (product: Product) => {
    setSelectedProduct(product)
    setQuickViewOpen(true)
  }

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...initialProducts]

    // Search filter
    if (searchQuery) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Category filter
    if (activeFilter === "deals") {
      result = result.filter(
        (p) =>
          p.sale_price !== null &&
          calculateDiscount(p.price, p.sale_price) >= 10
      )
    } else if (activeFilter === "trending") {
      result = result.filter(
        (p) => (p.rating || 3) >= 4 || (p.sale_price !== null && p.sale_price < p.price)
      )
    } else if (activeFilter === "new") {
      result = result.slice(0, Math.ceil(result.length * 0.3))
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "price-asc")
        return (a.sale_price || a.price) - (b.sale_price || b.price)
      if (sortBy === "price-desc")
        return (b.sale_price || b.price) - (a.sale_price || a.price)
      if (sortBy === "discount") {
        const dA = a.sale_price ? (a.price - a.sale_price) / a.price : 0
        const dB = b.sale_price ? (b.price - b.sale_price) / b.price : 0
        return dB - dA
      }
      if (sortBy === "rating") {
        return (b.rating || 3) - (a.rating || 3)
      }
      return 0
    })

    return result
  }, [initialProducts, searchQuery, sortBy, activeFilter])

  // Stats
  const dealsCount = initialProducts.filter(
    (p) => p.sale_price !== null && calculateDiscount(p.price, p.sale_price) >= 10
  ).length

  if (!initialProducts || initialProducts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              All Products
            </h1>
            <ShoppingBag className="h-6 w-6 text-[#8B1538]" />
          </div>
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">
              No products available at the moment.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <div className="container py-4 sm:py-6 px-3 sm:px-4 lg:px-8">
        {/* ── Page Header ── */}
        <div className="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight text-balance">
                All Products
              </h1>
              <div className="jumia-count-badge flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#8B1538] text-white text-xs sm:text-sm font-bold">
                {filteredProducts.length > 99
                  ? "99+"
                  : filteredProducts.length}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-500">
              Discover amazing deals on premium products
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-auto sm:min-w-[280px] lg:min-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-10 pr-10 w-full rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#8B1538]/20 focus:border-[#8B1538] transition-all"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* ── Premium Banner ── */}
        <ProductsBannerCarousel />

        {/* ── Filter Chips + Sort Bar ── */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <FilterChip
              label="All"
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              count={initialProducts.length}
            />
            <FilterChip
              label="Deals"
              active={activeFilter === "deals"}
              onClick={() => setActiveFilter("deals")}
              icon={<Zap className="h-3.5 w-3.5" />}
              count={dealsCount}
            />
            <FilterChip
              label="Trending"
              active={activeFilter === "trending"}
              onClick={() => setActiveFilter("trending")}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            />
            <FilterChip
              label="New"
              active={activeFilter === "new"}
              onClick={() => setActiveFilter("new")}
              icon={<Sparkles className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Sort + Grid toggle */}
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-[170px] text-xs sm:text-sm rounded-xl border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">Highest Discount</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
              </SelectContent>
            </Select>

            {/* Grid toggle - hidden on mobile */}
            <div className="hidden sm:flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <button
                onClick={() => setGridCols("compact")}
                className={cn(
                  "p-2 transition-colors",
                  gridCols === "compact"
                    ? "bg-[#8B1538] text-white"
                    : "text-gray-400 hover:text-gray-600"
                )}
                aria-label="Compact grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setGridCols("regular")}
                className={cn(
                  "p-2 transition-colors",
                  gridCols === "regular"
                    ? "bg-[#8B1538] text-white"
                    : "text-gray-400 hover:text-gray-600"
                )}
                aria-label="Regular grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Results summary ── */}
        {searchQuery && (
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
            <Search className="h-3.5 w-3.5" />
            <span>
              Showing{" "}
              <span className="font-semibold text-gray-800">
                {filteredProducts.length}
              </span>{" "}
              results for{" "}
              <span className="font-semibold text-[#8B1538]">
                &quot;{searchQuery}&quot;
              </span>
            </span>
          </div>
        )}

        {/* ── Product Grid ── */}
        <div
          ref={gridRef}
          className="rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm"
        >
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm mb-2">No products found</p>
              <button
                onClick={() => {
                  setSearchQuery("")
                  setActiveFilter("all")
                }}
                className="text-[#8B1538] text-sm font-medium hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-[1px] bg-gray-100",
                gridCols === "compact"
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                  : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              )}
            >
              {filteredProducts.slice(0, displayCount).map((product, idx) => (
                <JumiaProductCard
                  key={product.id}
                  product={product}
                  index={idx}
                />
              ))}
            </div>
          )}

          {/* Show More Button */}
          {filteredProducts.length > displayCount && (
            <div className="flex flex-col items-center gap-2 py-6 sm:py-8 bg-white border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Showing {Math.min(displayCount, filteredProducts.length)} of{" "}
                {filteredProducts.length} products
              </p>
              <button
                onClick={handleShowMore}
                disabled={loading}
                className="group relative flex items-center justify-center px-10 sm:px-14 py-2.5 sm:py-3 bg-white text-gray-700 font-semibold rounded-full border-2 border-gray-200 hover:border-[#8B1538] hover:text-[#8B1538] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed min-w-[180px] sm:min-w-[220px] text-xs sm:text-sm overflow-hidden"
              >
                {/* Hover background fill */}
                <span className="absolute inset-0 bg-[#8B1538]/5 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />

                {loading ? (
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#8B1538] animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 relative z-10">
                    <ChevronDown className="h-4 w-4 group-hover:animate-bounce" />
                    <span>Show More Products</span>
                  </div>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
