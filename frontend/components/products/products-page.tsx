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
      className="luxury-reveal-item"
      style={{ animationDelay: `${(index % 12) * 0.06}s` }}
    >
      <Link
        href={`/product/${product.slug || product.id}`}
        prefetch={false}
        className="group flex flex-col h-full"
      >
        {/* Image Container */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-50 mb-4">
          {/* Primary image */}
          <Image
            src={primaryImg || "/placeholder.svg"}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 35vw, 20vw"
            className={cn(
              "object-cover transition-opacity duration-500",
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

          {/* Second image on hover - luxury fade */}
          {secondImg && (
            <Image
              src={secondImg || "/placeholder.svg"}
              alt={`${product.name} alternate`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 35vw, 20vw"
              className={cn(
                "object-cover transition-opacity duration-700 absolute inset-0",
                showSecondImg ? "opacity-100" : "opacity-0"
              )}
              onMouseEnter={() => {
                if (secondImg) setShowSecondImg(true)
              }}
              onMouseLeave={() => {
                setShowSecondImg(false)
              }}
            />
          )}

          {/* Subtle discount badge */}
          {discount > 0 && (
            <div className="absolute top-3 left-3 z-10">
              <span className="text-xs font-light text-gray-700 bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-full">
                {discount}% off
              </span>
            </div>
          )}

          {/* Wishlist button - luxury style */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setWished(!wished)
            }}
            className={cn(
              "absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 flex items-center justify-center border border-white/20 hover:bg-white",
              wished ? "text-gray-900" : "text-gray-400"
            )}
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={cn("h-4 w-4", wished && "fill-current")}
              strokeWidth={1.5}
            />
          </button>

          {/* Loading skeleton */}
          {!imgLoaded && (
            <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center z-[1]">
              <div className="w-6 h-6 rounded-full border border-gray-300 border-t-gray-900 animate-spin" />
            </div>
          )}
        </div>

        {/* Content Section - Minimal luxury */}
        <div className="flex flex-col flex-grow">
          {/* Category - uppercase, letter spacing */}
          {product.category && (
            <span className="text-[10px] tracking-[0.15em] text-gray-500 uppercase font-light mb-2">
              {product.category}
            </span>
          )}

          {/* Product name - elegant typography */}
          <h3 className="text-xs sm:text-sm font-light text-gray-900 line-clamp-2 leading-relaxed mb-auto group-hover:text-gray-600 transition-colors duration-300">
            {product.name}
          </h3>

          {/* Price section - refined */}
          <div className="mt-4 mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm sm:text-base font-light text-gray-900">
                KSh {(product.sale_price || product.price).toLocaleString()}
              </span>
              {product.sale_price && (
                <span className="text-xs text-gray-400 font-light line-through">
                  KSh {product.price.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Add to Cart - minimal button */}
          <button
            onClick={handleAddToCart}
            disabled={isAddingToCart}
            className="w-full py-2.5 px-3 text-xs font-light border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-all duration-300 rounded-none tracking-wide uppercase disabled:opacity-50"
            aria-label="Add to cart"
          >
            {isAddingToCart ? "Adding..." : "Add to Bag"}
          </button>
        </div>
      </Link>
    </div>
  )
})
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
    <div className="min-h-screen bg-white">
      <div className="container py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        {/* Page Header - Luxury minimal */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl font-light text-gray-900 mb-2 tracking-tight">
            All Products
          </h1>
          <p className="text-sm text-gray-600 font-light">
            Curated collection of premium selections
          </p>
        </div>

        {/* Search and Controls */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4 pb-8 border-b border-gray-200">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-11 pr-4 w-full bg-white border border-gray-200 rounded-none focus:ring-0 focus:border-gray-900 transition-colors text-sm font-light"
            />
            {searchQuery && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-11 w-full sm:w-48 text-sm font-light rounded-none border-gray-200 bg-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="discount">Best Value</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Chips - Luxury minimal */}
        <div className="mb-10 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "whitespace-nowrap text-sm font-light px-4 py-2 transition-all duration-300",
              activeFilter === "all"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            All ({initialProducts.length})
          </button>
          <button
            onClick={() => setActiveFilter("deals")}
            className={cn(
              "whitespace-nowrap text-sm font-light px-4 py-2 transition-all duration-300",
              activeFilter === "deals"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Deals ({dealsCount})
          </button>
          <button
            onClick={() => setActiveFilter("trending")}
            className={cn(
              "whitespace-nowrap text-sm font-light px-4 py-2 transition-all duration-300",
              activeFilter === "trending"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Trending
          </button>
          <button
            onClick={() => setActiveFilter("new")}
            className={cn(
              "whitespace-nowrap text-sm font-light px-4 py-2 transition-all duration-300",
              activeFilter === "new"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            New
          </button>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-sm">No products found</p>
          </div>
        ) : (
          <>
            {/* Products Grid - 4 columns luxury layout */}
            <div
              ref={gridRef}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-12"
            >
              {filteredProducts.slice(0, displayCount).map((product, index) => (
                <JumiaProductCard key={product.id} product={product} index={index} />
              ))}
            </div>

            {/* Show More Button - Minimal */}
            {displayCount < filteredProducts.length && (
              <div className="flex justify-center pt-8 border-t border-gray-200">
                <button
                  onClick={handleShowMore}
                  disabled={loading}
                  className="px-8 py-3 text-sm font-light border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-all duration-300 uppercase tracking-wide disabled:opacity-50"
                >
                  {loading ? "Loading..." : "View More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
