"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Heart,
  Share2,
  ChevronRight,
  Star,
  ThumbsUp,
  Shield,
  Zap,
  Home,
  ArrowLeft,
  ArrowRight,
  Award,
  Minus,
  Plus,
  ShoppingCart,
  CreditCard,
  Maximize2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  MessageSquare,
  BadgeCheck,
  Truck,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"

import { useCart } from "@/contexts/cart/cart-context"
import { useWishlist } from "@/contexts/wishlist/wishlist-context"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice, cn } from "@/lib/utils"
import { productService } from "@/services/product"
import { inventoryService } from "@/services/inventory-service"
import { cloudinaryService } from "@/services/cloudinary-service"
import { websocketService } from "@/services/websocket"
import { ImageZoomModal } from "./image-zoom-modal"
import { reviewService, type Review, type ReviewSummary } from "@/services/review-service"
import { imageBatchService } from "@/services/image-batch-service"
import type { ProductDetails } from "@/types/product-details"

interface ProductDetailsEnhancedProps {
  product: any
  initialReviews?: Review[]
  similarProducts?: any[]
  recentlyViewedProducts?: any[]
}

type InventoryState = {
  available_quantity: number
  is_in_stock: boolean
  is_low_stock: boolean
  stock_status: "in_stock" | "low_stock" | "out_of_stock"
  last_updated?: string
}

const BRAND_COLOR = "#8B1538"
const BRAND_HOVER = "#6B1028"
const WHATSAPP_COLOR = "#25D366"

const motionVariants = {
  fadeIn: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.35,
      ease: [0.2, 0, 0.2, 1],
    },
  },
  slideUp: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.35,
      ease: [0.175, 0.885, 0.32, 1.08],
    },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    transition: {
      duration: 0.24,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

function normalizeProductsResponse(data: any): any[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.products)) return data.products
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

function getInitialInventory(product: any): InventoryState {
  // Support new backend structure: product.stock.quantity
  // Also support legacy structure: product.stock (number)
  let stock = 0
  let stockStatus: InventoryState["stock_status"] = "out_of_stock"

  if (product?.stock && typeof product.stock === "object") {
    // New backend structure
    stock = Number(product.stock.quantity || 0)
    stockStatus = product.stock.stock_status || "out_of_stock"
  } else if (typeof product?.stock === "number") {
    // Legacy structure
    stock = Number(product.stock)
    stockStatus = stock === 0 ? "out_of_stock" : stock <= 5 ? "low_stock" : "in_stock"
  }

  return {
    available_quantity: stock,
    is_in_stock: stock > 0,
    is_low_stock: stock > 0 && stock <= 5,
    stock_status: stockStatus,
    last_updated: undefined,
  }
}

function getSafeRating(value: unknown, fallback = 4): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(5, Math.max(0, value))
  }
  return fallback
}

function safeCloudinaryUrl(url?: string, options?: Parameters<typeof cloudinaryService.generateOptimizedUrl>[1]): string {
  if (!url || typeof url !== "string" || !url.trim() || url.startsWith("blob:")) {
    return "/generic-product-display.png"
  }
  if (url.startsWith("http") || url.startsWith("/")) return url
  return cloudinaryService.generateOptimizedUrl(url, options)
}

function sanitizeHtml(html?: string): string {
  if (!html || typeof html !== "string") return ""

  let sanitized = html

  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
  sanitized = sanitized.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
  sanitized = sanitized.replace(/\son\w+="[^"]*"/gi, "")
  sanitized = sanitized.replace(/\son\w+='[^']*'/gi, "")
  sanitized = sanitized.replace(/\sjavascript:/gi, "")
  sanitized = sanitized.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")

  return sanitized
}

/**
 * Extract images from new backend structure
 * Supports both new nested urls structure and legacy flat image_urls array
 */
function extractProductImages(product: any): string[] {
  if (!product) return ["/generic-product-display.png"]

  // NEW: Try new backend structure first (product.images[].urls.large)
  if (Array.isArray(product.images) && product.images.length > 0) {
    const newStructureUrls = product.images
      .map((img: any) => {
        if (img?.urls?.large) return img.urls.large
        if (img?.urls?.original) return img.urls.original
        if (img?.urls?.medium) return img.urls.medium
        return null
      })
      .filter((url: string | null): url is string => !!url && typeof url === "string" && !url.startsWith("blob:"))

    if (newStructureUrls.length > 0) {
      return newStructureUrls.map((url) => safeCloudinaryUrl(url))
    }
  }

  // LEGACY: Handle old image_urls structure (fallback)
  if (product?.image_urls) {
    if (Array.isArray(product.image_urls)) {
      const urls = product.image_urls
        .filter((u: unknown): u is string => typeof u === "string" && u.trim() !== "" && !u.startsWith("blob:"))
        .map((u: string) => safeCloudinaryUrl(u))

      if (urls.length > 0) return urls
    } else if (typeof product.image_urls === "string" && product.image_urls.trim()) {
      return [safeCloudinaryUrl(product.image_urls)]
    }
  }

  // Fallback to thumbnail if available
  if (product?.thumbnail_url && typeof product.thumbnail_url === "string") {
    return [safeCloudinaryUrl(product.thumbnail_url)]
  }

  return ["/generic-product-display.png"]
}

function getProductImageUrl(product: any, index = 0, highQuality = false): string {
  if (
    !highQuality &&
    product?.thumbnail_url &&
    typeof product.thumbnail_url === "string" &&
    !product.thumbnail_url.startsWith("blob:")
  ) {
    return product.thumbnail_url
  }

  if (Array.isArray(product?.image_urls) && product.image_urls.length > index) {
    const url = product.image_urls[index]
    if (typeof url === "string" && url.trim()) {
      if (highQuality) {
        return safeCloudinaryUrl(url, {
          width: 2048,
          height: 2048,
          quality: 90,
          format: "auto",
          crop: "fit",
        })
      }
      return safeCloudinaryUrl(url)
    }
  }

  if (typeof product?.image_urls === "string" && product.image_urls.trim()) {
    return safeCloudinaryUrl(product.image_urls)
  }

  if (product?.thumbnail_url && typeof product.thumbnail_url === "string") {
    return safeCloudinaryUrl(product.thumbnail_url)
  }

  return "/generic-product-display.png"
}

function getProductImages(product: any): string[] {
  return extractProductImages(product)
}

/**
 * Get current display price from product
 * Handles both new backend structure (product.pricing.*) and legacy (product.sale_price / product.price)
 */
function getCurrentPrice(product: any): number {
  if (!product) return 0

  // New backend structure
  if (product?.pricing && typeof product.pricing === "object") {
    return Number(product.pricing.current_price || product.pricing.original_price || 0)
  }

  // Legacy structure
  const salePrice = Number(product?.sale_price || 0)
  const basePrice = Number(product?.price || 0)
  return salePrice > 0 ? salePrice : basePrice
}

/**
 * Get original/list price from product
 */
function getOriginalPrice(product: any): number {
  if (!product) return 0

  // New backend structure
  if (product?.pricing && typeof product.pricing === "object") {
    return Number(product.pricing.original_price || 0)
  }

  // Legacy structure
  return Number(product?.price || 0)
}

/**
 * Get discount percentage from product
 */
function getDiscountPercentage(product: any): number {
  if (!product) return 0

  // New backend structure
  if (product?.pricing && typeof product.pricing === "object") {
    return Number(product.pricing.discount_percentage || 0)
  }

  // Legacy structure: calculate from prices
  const original = getOriginalPrice(product)
  const current = getCurrentPrice(product)
  if (original <= 0 || original <= current) return 0
  return Math.round(((original - current) / original) * 100)
}

/**
 * Get rating from product
 * Handles both new backend structure (product.ratings.average) and legacy (product.rating)
 */
function getProductRating(product: any): number {
  if (!product) return 0

  // New backend structure
  if (product?.ratings && typeof product.ratings === "object") {
    return getSafeRating(product.ratings.average, 0)
  }

  // Legacy structure
  return getSafeRating(product?.rating, 0)
}

function StarRating({
  rating,
  onRatingChange,
  interactive = false,
  size = 16,
}: {
  rating: number
  onRatingChange?: (rating: number) => void
  interactive?: boolean
  size?: number
}) {
  const [hoverRating, setHoverRating] = useState(0)

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const activeValue = hoverRating || rating
        return (
          <motion.button
            key={star}
            type="button"
            onClick={() => interactive && onRatingChange?.(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={cn(
              "transition-colors",
              interactive && "cursor-pointer",
              activeValue >= star ? "text-amber-400" : "text-gray-200",
            )}
            disabled={!interactive}
            whileHover={interactive ? { scale: 1.06 } : undefined}
          >
            <Star
              size={size}
              fill={activeValue >= star ? "currentColor" : "none"}
              strokeWidth={1.5}
            />
          </motion.button>
        )
      })}
    </div>
  )
}

export default function ProductDetailsEnhanced({
  product: initialProduct,
  initialReviews = [],
  similarProducts = [],
  recentlyViewedProducts = [],
}: ProductDetailsEnhancedProps) {
  const { toast } = useToast()
  const { addToCart, items: cartItems } = useCart()
  const { isInWishlist, addToWishlist, removeProductFromWishlist } = useWishlist()

  const [product, setProduct] = useState<any>(initialProduct)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  const [exploreProducts, setExploreProducts] = useState<any[]>(
    Array.isArray(similarProducts) ? similarProducts.slice(0, 12) : [],
  )
  const [explorePage, setExplorePage] = useState(1)
  const [exploreHasMore, setExploreHasMore] = useState<boolean>(
    Array.isArray(similarProducts) ? similarProducts.length > 12 : false,
  )
  const [exploreLoading, setExploreLoading] = useState(false)
  const [newlyLoadedStartIndex, setNewlyLoadedStartIndex] = useState<number | null>(null)

  const [recentlyViewed, setRecentlyViewed] = useState<any[]>(recentlyViewedProducts || [])
  const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false)
  const [zoomSelectedImage, setZoomSelectedImage] = useState(0)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [showCartNotification, setShowCartNotification] = useState(false)
  const [cartNotificationData, setCartNotificationData] = useState<any>(null)
  const [optimisticWishlistState, setOptimisticWishlistState] = useState<boolean | null>(null)
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false)
  const [reviewSortBy, setReviewSortBy] = useState<"recent" | "highest" | "lowest">("recent")
  const [likedReviews, setLikedReviews] = useState<Set<number>>(new Set())
  const [animatingReviews, setAnimatingReviews] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<"details" | "specs" | "reviews">("details")

  const [inventoryData, setInventoryData] = useState<InventoryState>(getInitialInventory(initialProduct))
  const [inventoryError, setInventoryError] = useState<string | null>(null)

  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null)
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const addToCartInProgress = useRef(false)
  const lastAddToCartTime = useRef(0)
  const imageRef = useRef<HTMLDivElement>(null)
  const cartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addToCartResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const helpfulAnimationTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const actualWishlistState = isInWishlist(Number(product?.id))
  const isProductInWishlist = optimisticWishlistState !== null ? optimisticWishlistState : actualWishlistState

  const productImages = useMemo(() => getProductImages(product), [product])

  const currentPrice = useMemo(
    () => selectedVariant?.price ?? getCurrentPrice(product),
    [selectedVariant?.price, product],
  )

  const originalPrice = useMemo(
    () => getOriginalPrice(product),
    [product],
  )

  const discountPercentage = useMemo(
    () => getDiscountPercentage(product),
    [product],
  )

  const averageRating = useMemo(
    () => getProductRating(product),
    [product],
  )

  const specifications = useMemo(() => {
    const p = product
    if (!p) return []

    if (p?.specifications) {
      let specs = p.specifications

      if (typeof specs === "string") {
        try {
          specs = JSON.parse(specs)
        } catch (error) {
          console.error("[product-details] Failed to parse specifications JSON:", error)
        }
      }

      if (Array.isArray(specs) && specs.length > 0) {
        return specs.map((spec: any) => ({
          category: spec.category || "Specifications",
          items: Array.isArray(spec.items)
            ? spec.items.map((item: any) => ({
              label: item.label || "",
              value: typeof item.value === "string" ? item.value : String(item.value || ""),
            }))
            : [],
        }))
      }

      if (typeof specs === "object" && specs && !Array.isArray(specs)) {
        const categorizedSpecs: Array<{ category: string; items: Array<{ label: string; value: string }> }> = []
        const categoryOrder = ["product_identification", "specifications", "what's_in_the_box", "options"]

        categoryOrder.forEach((categoryKey) => {
          const categoryData = specs[categoryKey]
          if (categoryData && typeof categoryData === "object") {
            const displayName = categoryKey
              .split("_")
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")

            const items: Array<{ label: string; value: string }> = []

            Object.entries(categoryData).forEach(([key, value]) => {
              const fieldName = key
                .split("_")
                .map((word, index) =>
                  index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
                )
                .join(" ")

              if (typeof value === "string" && value.trim()) {
                items.push({ label: fieldName, value })
              }
            })

            if (items.length > 0) {
              categorizedSpecs.push({
                category: displayName,
                items,
              })
            }
          }
        })

        if (categorizedSpecs.length > 0) return categorizedSpecs
      }
    }

    const specs: Array<{ category: string; items: Array<{ label: string; value: string }> }> = []

    const identificationItems: Array<{ label: string; value: string }> = []
    if (p?.brand?.name) identificationItems.push({ label: "Brand", value: p.brand.name })
    if (p?.name) identificationItems.push({ label: "Model", value: p.name })
    if (p?.sku) identificationItems.push({ label: "SKU", value: p.sku })

    if (identificationItems.length > 0) {
      specs.push({ category: "Product Identification", items: identificationItems })
    }

    const physicalItems: Array<{ label: string; value: string }> = []
    if (p?.weight) physicalItems.push({ label: "Weight", value: `${p.weight}kg` })

    if (p?.dimensions) {
      if (typeof p.dimensions === "object" && p.dimensions !== null) {
        const { height, length, width } = p.dimensions as any
        if (height && length && width) {
          physicalItems.push({ label: "Dimensions", value: `${length}L × ${width}W × ${height}H cm` })
        }
      } else if (typeof p.dimensions === "string") {
        physicalItems.push({ label: "Dimensions", value: p.dimensions })
      }
    }

    if (p?.material) physicalItems.push({ label: "Material", value: p.material })
    if (p?.color) physicalItems.push({ label: "Color", value: p.color })

    if (physicalItems.length > 0) {
      specs.push({ category: "Specifications", items: physicalItems })
    }

    const packageItems: Array<{ label: string; value: string }> = []
    if (Array.isArray(p?.package_contents)) {
      p.package_contents.forEach((item: string, index: number) => {
        packageItems.push({ label: `Item ${index + 1}`, value: item })
      })
    }

    if (packageItems.length > 0) {
      specs.push({ category: "What's in the Box", items: packageItems })
    }

    if (Array.isArray(p?.variants) && p.variants.length) {
      const colors = [...new Set(p.variants.map((v: any) => v.color).filter(Boolean))]
      const sizes = [...new Set(p.variants.map((v: any) => v.size).filter(Boolean))]
      const variantItems: Array<{ label: string; value: string }> = []

      if (colors.length) variantItems.push({ label: "Available Colors", value: colors.join(", ") })
      if (sizes.length) variantItems.push({ label: "Available Sizes", value: sizes.join(", ") })

      if (variantItems.length) {
        specs.push({ category: "Available Options", items: variantItems })
      }
    }

    return specs
  }, [product])

  const sanitizedDescription = useMemo(
    () => sanitizeHtml(product?.description),
    [product?.description],
  )

  const stockDisplay = useMemo(() => {
    if (inventoryError) {
      return {
        icon: AlertTriangle,
        text: "Unable to check stock",
        cls: "text-orange-600 bg-orange-50 border-orange-200",
        ic: "text-orange-600",
      }
    }

    switch (inventoryData.stock_status) {
      case "in_stock":
        return {
          icon: CheckCircle,
          text: `${inventoryData.available_quantity} in stock`,
          cls: "text-emerald-600 bg-emerald-50 border-emerald-200",
          ic: "text-emerald-600",
        }
      case "low_stock":
        return {
          icon: AlertTriangle,
          text: `Only ${inventoryData.available_quantity} left`,
          cls: "text-amber-600 bg-amber-50 border-amber-200",
          ic: "text-amber-600",
        }
      case "out_of_stock":
        return {
          icon: XCircle,
          text: "Out of stock",
          cls: "text-red-600 bg-red-50 border-red-200",
          ic: "text-red-600",
        }
      default:
        return {
          icon: Info,
          text: "Stock status unknown",
          cls: "text-gray-500 bg-gray-50 border-gray-200",
          ic: "text-gray-500",
        }
    }
  }, [inventoryData, inventoryError])

  const refreshProduct = useCallback(
    async (productId: string | number, refreshImages = false) => {
      try {
        const refreshed = await productService.getProduct(String(productId))
        if (!refreshed) return

        if (refreshImages) {
          imageBatchService.invalidateCache(String(productId))
          const images = await imageBatchService.fetchProductImages(String(productId))
          if (Array.isArray(images) && images.length > 0) {
            refreshed.image_urls = images
              .map((img: any) => img?.url || img?.image_url)
              .filter(Boolean)
          }
        }

        setProduct(refreshed)
      } catch (error) {
        console.error("[product-details] Failed to refresh product:", error)
      }
    },
    [],
  )

  const fetchInventoryData = useCallback(async () => {
    if (!product?.id) return

    setInventoryError(null)

    try {
      const summary = await inventoryService.getProductInventorySummary(
        Number(product.id),
        selectedVariant?.id,
      )

      const available = summary.total_available_quantity ?? 0
      const stock_status: InventoryState["stock_status"] =
        available === 0 ? "out_of_stock" : summary.is_low_stock ? "low_stock" : "in_stock"

      setInventoryData({
        available_quantity: available,
        is_in_stock: !!summary.is_in_stock,
        is_low_stock: !!summary.is_low_stock,
        stock_status,
        last_updated: summary.items?.[0]?.last_updated,
      })
    } catch (error) {
      console.error("[product-details] Inventory fetch error:", error)
      setInventoryError("Unable to check stock")
    }
  }, [product?.id, selectedVariant?.id])

  const fetchReviews = useCallback(async () => {
    if (!product?.id) return

    setIsLoadingReviews(true)
    setReviewError(null)

    try {
      const [reviewsResponse, summaryResponse] = await Promise.all([
        reviewService.getProductReviews(Number(product.id), {
          page: 1,
          per_page: showAllReviews ? 50 : 5,
          sort_by: reviewSortBy === "recent" ? "created_at" : "rating",
          sort_order: reviewSortBy === "lowest" ? "asc" : "desc",
        }),
        reviewService.getProductReviewSummary(Number(product.id)),
      ])

      setReviews(Array.isArray(reviewsResponse?.items) ? reviewsResponse.items : [])
      setReviewSummary(summaryResponse)
    } catch (error: any) {
      console.error("[product-details] Reviews fetch error:", error)
      setReviewError(error?.message || "Failed to load reviews")
      setReviews([])
      setReviewSummary({
        total_reviews: 0,
        average_rating: 0,
        verified_reviews: 0,
        rating_distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
      })
    } finally {
      setIsLoadingReviews(false)
    }
  }, [product?.id, showAllReviews, reviewSortBy])

  const fetchRelatedProducts = useCallback(async () => {
    if (!product?.id || exploreLoading) return

    if (exploreProducts.length >= 12) {
      setExploreHasMore(exploreProducts.length > 12)
      return
    }

    setExploreLoading(true)

    try {
      let allProducts: any[] = []

      if (product?.category_id) {
        try {
          const categoryProducts = await productService.getProductsByCategory(String(product.category_id))
          const normalized = normalizeProductsResponse(categoryProducts)
          allProducts = normalized.filter((item: any) => item?.id && item.id !== product.id)
        } catch (error) {
          console.error("[product-details] Category products fetch error:", error)
        }
      }

      if (allProducts.length < 12) {
        try {
          const response = await fetch("/api/products?limit=30&page=1")
          const data = await response.json()
          const normalized = normalizeProductsResponse(data)
          const generalProducts = normalized.filter(
            (item: any) =>
              item?.id &&
              item.id !== product.id &&
              !allProducts.some((existing: any) => existing.id === item.id),
          )
          allProducts = [...allProducts, ...generalProducts]
        } catch (error) {
          console.error("[product-details] General products fetch error:", error)
        }
      }

      const productPrice = Number(product?.sale_price || product?.price || 0)
      const sorted = allProducts.sort((a: any, b: any) => {
        const aCategoryMatch = a.category_id === product?.category_id ? 1 : 0
        const bCategoryMatch = b.category_id === product?.category_id ? 1 : 0
        if (aCategoryMatch !== bCategoryMatch) return bCategoryMatch - aCategoryMatch

        const aPriceDiff = Math.abs(Number(a.sale_price || a.price || 0) - productPrice)
        const bPriceDiff = Math.abs(Number(b.sale_price || b.price || 0) - productPrice)
        if (aPriceDiff !== bPriceDiff) return aPriceDiff - bPriceDiff

        return getSafeRating(b.rating, 0) - getSafeRating(a.rating, 0)
      })

      setExploreProducts(sorted.slice(0, 12))
      setExploreHasMore(sorted.length > 12)
      setExplorePage(1)
      setNewlyLoadedStartIndex(null)
    } finally {
      setExploreLoading(false)
    }
  }, [product?.id, product?.category_id, product?.sale_price, product?.price, exploreLoading, exploreProducts.length])

  const fetchMoreExploreProducts = useCallback(async () => {
    if (exploreLoading || !exploreHasMore) return

    setExploreLoading(true)

    try {
      const nextPage = explorePage + 1
      const categoryQuery = product?.category?.slug ? `&category_slug=${product.category.slug}` : ""
      const response = await fetch(`/api/products?limit=12&page=${nextPage}${categoryQuery}`)
      const data = await response.json()

      const normalized = normalizeProductsResponse(data)
      const deduped = normalized.filter(
        (item: any) =>
          item?.id &&
          item.id !== product?.id &&
          !exploreProducts.some((existing: any) => existing.id === item.id),
      )

      if (deduped.length > 0) {
        setExploreProducts((prev) => {
          setNewlyLoadedStartIndex(prev.length)
          return [...prev, ...deduped]
        })
        setExplorePage(nextPage)
        setExploreHasMore(deduped.length >= 12)
      } else {
        setExploreHasMore(false)
      }
    } catch (error) {
      console.error("[product-details] More explore products fetch error:", error)
      setExploreHasMore(false)
    } finally {
      setExploreLoading(false)
    }
  }, [exploreHasMore, exploreLoading, explorePage, product?.category?.slug, product?.id, exploreProducts])

  const handleVariantSelection = useCallback((variant: any) => {
    setSelectedVariant(variant)
    setQuantity(1)
  }, [])

  const handleImageClick = useCallback(() => {
    setZoomSelectedImage(selectedImage)
    setIsImageZoomModalOpen(true)
  }, [selectedImage])

  const handleShare = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : ""

    if ((navigator as any)?.share) {
      ; (navigator as any)
        .share({
          title: product?.name || "Product",
          text: product?.description || "",
          url,
        })
        .catch(() => { })
      return
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
      toast({ title: "Link copied", description: "Product link copied to clipboard" })
    }
  }, [product?.description, product?.name, toast])

  const handleBuyViaWhatsApp = useCallback(() => {
    const whatsappNumber = "254746741719"
    const message = encodeURIComponent(
      `I'm interested in buying ${product?.name}. Price: ${formatPrice(currentPrice)}. Quantity: ${quantity}. Please assist me with the purchase.`,
    )
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer")
  }, [currentPrice, product?.name, quantity])

  const getTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays <= 0) return "Today"
    if (diffInDays === 1) return "Yesterday"
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`
    return `${Math.floor(diffInDays / 365)} years ago`
  }, [])

  const handleMarkHelpful = useCallback(
    async (reviewId: number) => {
      if (animatingReviews.has(reviewId)) return

      setAnimatingReviews((prev) => new Set(prev).add(reviewId))

      const isCurrentlyLiked = likedReviews.has(reviewId)

      setLikedReviews((prev) => {
        const next = new Set(prev)
        if (isCurrentlyLiked) next.delete(reviewId)
        else next.add(reviewId)
        return next
      })

      try {
        await reviewService.markReviewHelpful(reviewId)
        await fetchReviews()
      } catch (error: any) {
        console.error("[product-details] Mark helpful error:", error)

        setLikedReviews((prev) => {
          const next = new Set(prev)
          if (isCurrentlyLiked) next.add(reviewId)
          else next.delete(reviewId)
          return next
        })

        toast({
          title: "Error",
          description: error?.message || "Failed to mark review as helpful",
          variant: "destructive",
        })
      } finally {
        const existingTimer = helpfulAnimationTimersRef.current.get(reviewId)
        if (existingTimer) clearTimeout(existingTimer)

        const timer = setTimeout(() => {
          setAnimatingReviews((prev) => {
            const next = new Set(prev)
            next.delete(reviewId)
            return next
          })
          helpfulAnimationTimersRef.current.delete(reviewId)
        }, 250)

        helpfulAnimationTimersRef.current.set(reviewId, timer)
      }
    },
    [animatingReviews, likedReviews, fetchReviews, toast],
  )

  const handleAddToCart = useCallback(async (): Promise<boolean> => {
    if (!inventoryData?.is_in_stock) {
      toast({
        title: "Out of Stock",
        description: "This product is currently out of stock",
        variant: "destructive",
      })
      return false
    }

    try {
      const fresh = await inventoryService.checkAvailability(
        Number(product.id),
        quantity,
        selectedVariant?.id,
      )

      if (!fresh.is_available || quantity > fresh.available_quantity) {
        setInventoryData({
          available_quantity: fresh.available_quantity,
          is_in_stock: fresh.available_quantity > 0,
          is_low_stock: !!fresh.is_low_stock,
          stock_status:
            fresh.available_quantity === 0
              ? "out_of_stock"
              : fresh.is_low_stock
                ? "low_stock"
                : "in_stock",
        })

        toast({
          title: "Stock Updated",
          description:
            fresh.available_quantity === 0
              ? "This item just went out of stock."
              : `Only ${fresh.available_quantity} items available`,
          variant: "destructive",
        })

        return false
      }
    } catch { }

    if (quantity > (inventoryData?.available_quantity ?? 0)) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${inventoryData?.available_quantity ?? 0} items available`,
        variant: "destructive",
      })
      return false
    }

    if (addToCartInProgress.current || isAddingToCart) return false

    const now = Date.now()
    if (now - lastAddToCartTime.current < 1000) return false

    if ((product?.variants?.length ?? 0) > 0 && !selectedVariant) {
      toast({
        title: "Select Options",
        description: "Please choose the required product options before adding to cart",
        variant: "destructive",
      })
      return false
    }

    if (quantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please select at least 1 item",
        variant: "destructive",
      })
      return false
    }

    try {
      addToCartInProgress.current = true
      lastAddToCartTime.current = now
      setIsAddingToCart(true)

      const productId = typeof product.id === "string" ? Number.parseInt(product.id, 10) : product.id

      const result = await addToCart(
        productId,
        quantity,
        typeof selectedVariant?.id === "number" ? selectedVariant.id : undefined,
      )

      if (result.success) {
        await fetchInventoryData()

        setCartNotificationData({
          name: product?.name,
          price: currentPrice,
          quantity,
          thumbnail_url: productImages[0] || "/shopping-cart-thumbnail.png",
        })

        setShowCartNotification(true)

        if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
        cartToastTimerRef.current = setTimeout(() => {
          setShowCartNotification(false)
        }, 4200)

        if (result.message && result.message.toLowerCase().includes("guest")) {
          toast({
            title: "Added to Cart",
            description: "Item added to your cart. Log in to proceed to checkout.",
            variant: "default",
          })
        }

        return true
      }

      const message = result.message || "Failed to add item to cart"
      const isAuthError = message.toLowerCase().includes("log in") || message.toLowerCase().includes("auth")

      toast({
        title: isAuthError ? "Cart Ready" : "Error",
        description: isAuthError
          ? "Item added to your cart. Log in to complete your purchase."
          : message,
        variant: isAuthError ? "default" : "destructive",
      })

      return isAuthError
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to add to cart"
      const isAuthError =
        errorMsg.toLowerCase().includes("401") ||
        errorMsg.toLowerCase().includes("unauthorized") ||
        errorMsg.toLowerCase().includes("log in")

      if (isAuthError) {
        toast({
          title: "Added to Cart",
          description: "Item added to your cart as a guest. Log in to checkout and see all your items.",
          variant: "default",
        })
        return true
      }

      toast({ title: "Error", description: errorMsg, variant: "destructive" })
      return false
    } finally {
      if (addToCartResetTimerRef.current) clearTimeout(addToCartResetTimerRef.current)
      addToCartResetTimerRef.current = setTimeout(() => {
        addToCartInProgress.current = false
        setIsAddingToCart(false)
      }, 900)
    }
  }, [
    addToCart,
    currentPrice,
    fetchInventoryData,
    inventoryData,
    isAddingToCart,
    product,
    productImages,
    quantity,
    selectedVariant,
    toast,
  ])

  const handleToggleWishlist = useCallback(async () => {
    if (isTogglingWishlist) return

    try {
      setIsTogglingWishlist(true)

      const nextState = !isProductInWishlist
      setOptimisticWishlistState(nextState)

      if (isProductInWishlist) {
        await removeProductFromWishlist(Number(product.id))
      } else {
        await addToWishlist({ product_id: Number(product.id) })
      }
    } catch (error: any) {
      setOptimisticWishlistState(null)
      console.error("[product-details] Toggle wishlist error:", error)

      if (!error?.message?.includes("already")) {
        toast({
          title: "Error",
          description: "Failed to update wishlist. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setTimeout(() => {
        setIsTogglingWishlist(false)
      }, 250)
    }
  }, [addToWishlist, isProductInWishlist, isTogglingWishlist, product?.id, removeProductFromWishlist, toast])

  useEffect(() => {
    setProduct(initialProduct)
    setSelectedImage(0)
    setSelectedVariant(null)
    setQuantity(1)
    setInventoryData(getInitialInventory(initialProduct))
  }, [initialProduct])

  useEffect(() => {
    if (optimisticWishlistState !== null && optimisticWishlistState === actualWishlistState) {
      setOptimisticWishlistState(null)
    }
  }, [actualWishlistState, optimisticWishlistState])

  useEffect(() => {
    fetchInventoryData()
  }, [fetchInventoryData])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  useEffect(() => {
    if (product?.id && exploreProducts.length < 12) {
      fetchRelatedProducts()
    }
  }, [fetchRelatedProducts, product?.id, exploreProducts.length])

  useEffect(() => {
    if (!product?.id) return

    const productId = String(product.id)

    const handleProductUpdate = (updatedProduct: any) => {
      if (String(updatedProduct?.id) === productId) {
        setProduct((prev: any) => ({
          ...prev,
          ...updatedProduct,
        }))
      }
    }

    websocketService.on("product_updated", handleProductUpdate)

    let pollTimer: ReturnType<typeof setInterval> | null = null

    if (typeof document !== "undefined") {
      pollTimer = setInterval(async () => {
        if (document.hidden) return
        await refreshProduct(productId, false)
      }, 20000)
    }

    return () => {
      websocketService.off("product_updated", handleProductUpdate)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [product?.id, refreshProduct])

  useEffect(() => {
    if (!product?.id) return

    const handleProductEvent = (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = customEvent.detail || {}

      if (String(detail?.id || detail?.productId || detail?.product_id) !== String(product.id)) return

      fetchInventoryData()
    }

    const handleInventoryUpdate = (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = customEvent.detail || {}

      if (detail?.product_id !== product?.id) return

      setInventoryData((prev) => ({
        ...prev,
        available_quantity: detail.stock,
        is_in_stock: detail.stock > 0,
        is_low_stock: !!detail.is_low_stock,
        stock_status: detail.stock === 0 ? "out_of_stock" : detail.is_low_stock ? "low_stock" : "in_stock",
        last_updated: new Date().toISOString(),
      }))
    }

    const handleProductImagesUpdated = async (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = customEvent.detail || {}

      if (String(detail?.productId) !== String(product.id)) return

      await refreshProduct(product.id, true)
      setSelectedImage(0)
      fetchInventoryData()
    }

    window.addEventListener("product-updated", handleProductEvent)
    window.addEventListener("inventory-updated", handleInventoryUpdate)
    window.addEventListener("productImagesUpdated", handleProductImagesUpdated)

    return () => {
      window.removeEventListener("product-updated", handleProductEvent)
      window.removeEventListener("inventory-updated", handleInventoryUpdate)
      window.removeEventListener("productImagesUpdated", handleProductImagesUpdated)
    }
  }, [fetchInventoryData, product?.id, refreshProduct])

  useEffect(() => {
    if (!product?.id) return

    let isCancelled = false

    const fetchAllProductImages = async () => {
      try {
        imageBatchService.invalidateCache(String(product.id))
        const images = await imageBatchService.fetchProductImages(String(product.id))
        if (isCancelled) return

        const imageUrls = Array.isArray(images)
          ? images.map((img: any) => img?.url || img?.image_url).filter(Boolean)
          : []

        setProduct((prev: any) => ({
          ...prev,
          image_urls: imageUrls.length > 0 ? imageUrls : prev?.image_urls || [],
        }))
      } catch (error) {
        console.error("[product-details] Product images fetch error:", error)
      }
    }

    fetchAllProductImages()

    return () => {
      isCancelled = true
    }
  }, [product?.id])

  useEffect(() => {
    if (!product?.id) return

    try {
      const recentItems = JSON.parse(localStorage.getItem("recentlyViewed") || "[]")
      const exists = recentItems.some((item: any) => item.id === product.id)

      if (!exists) {
        const updated = [
          {
            id: product.id,
            name: product.name,
            price: currentPrice,
            image: productImages[0] || "/generic-product-display.png",
            slug: product.slug || product.id,
            image_urls: productImages,
            thumbnail_url: product.thumbnail_url,
          },
          ...recentItems,
        ].slice(0, 6)

        localStorage.setItem("recentlyViewed", JSON.stringify(updated))
        setRecentlyViewed(updated)
      } else {
        setRecentlyViewed(recentItems)
      }
    } catch { }
  }, [product?.id, product?.name, product?.slug, product?.thumbnail_url, currentPrice, productImages])

  useEffect(() => {
    return () => {
      if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
      if (addToCartResetTimerRef.current) clearTimeout(addToCartResetTimerRef.current)

      helpfulAnimationTimersRef.current.forEach((timer) => clearTimeout(timer))
      helpfulAnimationTimersRef.current.clear()
    }
  }, [])

  const colorOptions = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          (product?.variants || [])
            .map((variant: any) => variant.color)
            .filter((v: unknown): v is string => typeof v === "string" && v.trim() !== ""),
        ),
      ),
    [product?.variants],
  )

  const sizeOptions = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          (product?.variants || [])
            .map((variant: any) => variant.size)
            .filter((v: unknown): v is string => typeof v === "string" && v.trim() !== ""),
        ),
      ),
    [product?.variants],
  )

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans antialiased text-gray-900">
      <AnimatePresence>
        {showCartNotification && cartNotificationData && (
          <motion.div
            {...motionVariants.scaleIn}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-black/10">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                  <Image
                    src={cartNotificationData?.thumbnail_url || "/generic-product-display.png"}
                    alt={cartNotificationData?.name || "Product"}
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900">
                    {cartNotificationData?.name}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-sm">
                    <span className="font-bold text-[#8B1538]">
                      {formatPrice(cartNotificationData?.price || 0)}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">Qty: {cartNotificationData?.quantity || 1}</span>
                  </div>
                </div>

                <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCartNotification(false)}
                  className="h-11 flex-1 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Continue
                </button>

                <Link href="/cart" className="flex-1">
                  <button
                    type="button"
                    className="h-11 w-full rounded-xl bg-[#8B1538] text-sm font-semibold text-white transition-colors hover:bg-[#6B1028]"
                  >
                    View Cart ({cartItems.length})
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center text-sm text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="flex items-center transition-colors hover:text-[#8B1538]">
              <Home className="mr-1.5 h-4 w-4" />
              Home
            </Link>
            <ChevronRight className="mx-2 h-4 w-4 text-gray-300" />
            <Link href="/products" className="transition-colors hover:text-[#8B1538]">
              Products
            </Link>
            <ChevronRight className="mx-2 h-4 w-4 text-gray-300" />
            <span className="max-w-[200px] truncate font-medium text-gray-900">{product?.name}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <motion.div {...motionVariants.fadeIn} className="lg:col-span-5">
            <div className="sticky top-6 overflow-hidden rounded-2xl bg-white shadow-sm">
              <div
                className="group relative aspect-[4/3] cursor-zoom-in bg-gray-50"
                ref={imageRef}
                onClick={handleImageClick}
              >
                <Image
                  src={productImages[selectedImage] || "/generic-product-display.png"}
                  alt={product?.name || "Product image"}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-contain p-6 transition-transform duration-500 group-hover:scale-[1.03]"
                  priority
                  loading="eager"
                  quality={85}
                />

                {discountPercentage > 0 && (
                  <div className="absolute left-4 top-4 rounded-full bg-[#FF6B35] px-3 py-1.5 text-xs font-bold text-white">
                    -{discountPercentage}%
                  </div>
                )}

                {productImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 shadow-lg opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedImage((prev) => (prev === 0 ? productImages.length - 1 : prev - 1))
                      }}
                    >
                      <ArrowLeft className="h-5 w-5 text-gray-700" />
                    </button>

                    <button
                      type="button"
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 shadow-lg opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedImage((prev) => (prev === productImages.length - 1 ? 0 : prev + 1))
                      }}
                    >
                      <ArrowRight className="h-5 w-5 text-gray-700" />
                    </button>
                  </>
                )}

                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Click to zoom</span>
                </div>
              </div>

              <div className="border-t border-gray-100 p-4">
                <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                  {productImages.map((img, index) => (
                    <button
                      key={`${img}-${index}`}
                      type="button"
                      className={cn(
                        "relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-50 transition-all",
                        selectedImage === index
                          ? "border-[#8B1538] ring-2 ring-[#8B1538]/20"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                      onClick={() => setSelectedImage(index)}
                    >
                      <Image
                        src={img || "/generic-product-display.png"}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        sizes="80px"
                        className="object-cover"
                        loading={index === 0 ? "eager" : "lazy"}
                        quality={75}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...motionVariants.fadeIn} className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap gap-2">
                {product?.is_flash_sale && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/10 px-2.5 py-1 text-xs font-semibold text-[#FF6B35]">
                    <Zap className="h-3 w-3" />
                    Flash Sale
                  </span>
                )}

                {product?.is_luxury_deal && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-600">
                    <Award className="h-3 w-3" />
                    Premium
                  </span>
                )}
              </div>

              <h1 className="mb-3 text-xl font-bold leading-tight text-gray-900">{product?.name}</h1>

              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <StarRating rating={averageRating} size={16} />
                  <span className="text-sm font-semibold text-gray-900">{averageRating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">({reviewSummary?.total_reviews || 0} reviews)</span>
              </div>

              <div className="mb-4 flex items-baseline gap-3">
                <span className="text-3xl font-black text-[#8B1538]">{formatPrice(currentPrice)}</span>
                {currentPrice < originalPrice && (
                  <span className="text-lg text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                )}
              </div>

              <div className={cn("inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium", stockDisplay.cls)}>
                <stockDisplay.icon className={cn("mr-1.5 h-4 w-4", stockDisplay.ic)} />
                {stockDisplay.text}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8B1538]/10">
                    <Shield className="h-6 w-6 text-[#8B1538]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Mizizzi Store</span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Official
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">Verified Seller</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleShare}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                    <Truck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Free Delivery</p>
                    <p className="text-xs text-gray-500">Orders over KSh 2,000</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Easy Returns</p>
                    <p className="text-xs text-gray-500">14-day return policy</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">100% Genuine</p>
                    <p className="text-xs text-gray-500">Verified quality products</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...motionVariants.slideUp} className="lg:col-span-3">
            <div className="sticky top-6 rounded-2xl bg-white shadow-sm">
              <div className="space-y-5 p-5">
                {Array.isArray(product?.variants) && product.variants.length > 0 && (
                  <div className="space-y-4">
                    {colorOptions.length > 0 && (
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">Color</label>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.map((color, index) => {
                            const active = selectedVariant?.color === color
                            return (
                              <button
                                key={`${color}-${index}`}
                                type="button"
                                onClick={() => {
                                  const variant = product.variants.find((item: any) => item.color === color)
                                  if (variant) handleVariantSelection(variant)
                                }}
                                className={cn(
                                  "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                                  active ? "bg-[#8B1538] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                                )}
                              >
                                {color}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {sizeOptions.length > 0 && (
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">Size</label>
                        <div className="flex flex-wrap gap-2">
                          {sizeOptions.map((size, index) => {
                            const active = selectedVariant?.size === size
                            return (
                              <button
                                key={`${size}-${index}`}
                                type="button"
                                onClick={() => {
                                  const variant = product.variants.find((item: any) => item.size === size)
                                  if (variant) handleVariantSelection(variant)
                                }}
                                className={cn(
                                  "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                                  active ? "bg-[#8B1538] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                                )}
                              >
                                {size}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Quantity</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center overflow-hidden rounded-xl border border-gray-200">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
                        onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <div className="flex h-10 w-12 items-center justify-center border-x border-gray-200 bg-gray-50">
                        <span className="text-sm font-bold text-gray-900">{quantity}</span>
                      </div>

                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
                        onClick={() =>
                          setQuantity((prev) => Math.min(inventoryData.available_quantity || 0, prev + 1))
                        }
                        disabled={!inventoryData.is_in_stock || quantity >= (inventoryData.available_quantity || 0)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <span className="text-sm text-gray-500">{inventoryData.available_quantity || 0} available</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <motion.button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isAddingToCart || !inventoryData.is_in_stock}
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all",
                      isAddingToCart || !inventoryData.is_in_stock
                        ? "cursor-not-allowed bg-gray-300"
                        : "bg-[#8B1538] shadow-lg shadow-[#8B1538]/20 hover:bg-[#6B1028]",
                    )}
                    whileTap={inventoryData.is_in_stock ? { scale: 0.985 } : {}}
                  >
                    {isAddingToCart ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        Add to Cart
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleBuyViaWhatsApp}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-colors"
                    style={{ backgroundColor: WHATSAPP_COLOR }}
                    whileTap={{ scale: 0.985 }}
                  >
                    <FaWhatsapp className="h-5 w-5" />
                    Buy via WhatsApp
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleToggleWishlist}
                    disabled={isTogglingWishlist}
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 text-sm font-bold transition-all",
                      isProductInWishlist
                        ? "border-[#8B1538] bg-[#8B1538]/5 text-[#8B1538]"
                        : "border-gray-200 text-gray-700 hover:border-[#8B1538] hover:text-[#8B1538]",
                    )}
                    whileTap={{ scale: 0.985 }}
                  >
                    <Heart className={cn("h-4 w-4", isProductInWishlist && "fill-current")} />
                    {isProductInWishlist ? "Saved to Wishlist" : "Add to Wishlist"}
                  </motion.button>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <CreditCard className="h-4 w-4" />
                    <span>Visa, Mastercard, M-Pesa, Airtel Money</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div {...motionVariants.fadeIn} className="mt-8">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-gray-100">
              <div className="flex">
                {["details", "specs", "reviews"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab as "details" | "specs" | "reviews")}
                    className={cn(
                      "relative flex-1 px-6 py-4 text-sm font-semibold transition-all",
                      activeTab === tab ? "text-[#8B1538]" : "text-gray-500 hover:text-gray-700",
                    )}
                  >
                    {tab === "details" && "Product Details"}
                    {tab === "specs" && "Specifications"}
                    {tab === "reviews" && `Reviews (${reviewSummary?.total_reviews || 0})`}
                    {activeTab === tab && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B1538]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {activeTab === "details" && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <style>{`
                      .product-description-content img {
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        margin: 2rem auto !important;
                        border-radius: 1rem !important;
                        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
                        object-fit: contain !important;
                      }
                      .product-description-content figure {
                        width: 100% !important;
                        margin: 2rem 0 !important;
                      }
                      .product-description-content picture {
                        width: 100% !important;
                        display: block !important;
                      }
                    `}</style>

                    <div className="prose prose-lg max-w-none">
                      {sanitizedDescription ? (
                        <div
                          className="product-description-content space-y-6 text-gray-700
                            [&>p]:mb-4 [&>p]:text-[15px] [&>p]:leading-relaxed [&>p]:text-gray-600
                            [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-900
                            [&>h3]:mt-6 [&>h3]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-800
                            [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&>ul>li]:text-gray-600
                            [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-6 [&>ol>li]:text-gray-600"
                          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                        />
                      ) : (
                        <div className="py-12 text-center">
                          <Info className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                          <p className="font-semibold text-gray-900">No description available</p>
                          <p className="mt-2 text-sm text-gray-500">Product details will be updated soon.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "specs" && (
                  <motion.div
                    key="specs"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    {specifications.length > 0 ? (
                      <div className="grid gap-6 md:grid-cols-2">
                        {specifications.map(
                          (
                            spec: { category: string; items: { label: string; value: string }[] },
                            index: number,
                          ) => (
                            <div key={`${spec.category}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                              <div className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B1538]/10">
                                  <Shield className="h-5 w-5 text-[#8B1538]" />
                                </div>
                                <h4 className="font-bold text-gray-900">{spec.category}</h4>
                              </div>

                              <div className="space-y-3">
                                {spec.items.map((item, itemIndex) => (
                                  <div key={`${item.label}-${itemIndex}`} className="flex items-start justify-between gap-4">
                                    <span className="shrink-0 text-sm text-gray-500">{item.label}</span>
                                    <span className="text-right text-sm font-medium text-gray-900">{item.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="py-16 text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                          <Info className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">No specifications available</p>
                        <p className="mt-2 text-sm text-gray-500">Product specifications will be updated soon.</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "reviews" && (
                  <motion.div
                    key="reviews"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    {reviewSummary && reviewSummary.total_reviews > 0 && (
                      <div className="mb-8 grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl bg-gradient-to-br from-[#8B1538] to-[#6B1028] p-6 text-white">
                          <h3 className="mb-2 text-sm font-medium opacity-80">Overall Rating</h3>
                          <div className="mb-3 flex items-baseline gap-2">
                            <span className="text-5xl font-black">{averageRating.toFixed(1)}</span>
                            <span className="text-lg opacity-70">/ 5</span>
                          </div>
                          <div className="mb-3 flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "h-5 w-5",
                                  star <= Math.round(averageRating)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-white/20 text-white/20",
                                )}
                              />
                            ))}
                          </div>
                          <p className="text-sm opacity-80">
                            Based on {reviewSummary.total_reviews} reviews
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gray-50 p-6">
                          <h3 className="mb-4 text-sm font-semibold text-gray-900">Rating Distribution</h3>
                          <div className="space-y-3">
                            {[5, 4, 3, 2, 1].map((star) => {
                              const distribution = reviewSummary?.rating_distribution as Record<string, number> | undefined
                              const count = distribution?.[star.toString()] ?? 0
                              const percentage =
                                reviewSummary.total_reviews > 0 ? (count / reviewSummary.total_reviews) * 100 : 0

                              return (
                                <div key={star} className="flex items-center gap-3">
                                  <div className="flex w-8 items-center gap-1">
                                    <span className="text-sm font-bold text-gray-700">{star}</span>
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  </div>

                                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                                    <motion.div
                                      className="h-full rounded-full bg-amber-400"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percentage}%` }}
                                      transition={{ duration: 0.5, delay: 0.08 * (5 - star) }}
                                    />
                                  </div>

                                  <span className="w-8 text-right text-xs text-gray-500">{count}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-6 flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">Sort by:</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "recent", label: "Most Recent" },
                          { key: "highest", label: "Highest Rated" },
                          { key: "lowest", label: "Lowest Rated" },
                        ].map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setReviewSortBy(option.key as "recent" | "highest" | "lowest")}
                            className={cn(
                              "rounded-full px-4 py-2 text-xs font-semibold transition-all",
                              reviewSortBy === option.key
                                ? "bg-[#8B1538] text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isLoadingReviews ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#8B1538] border-t-transparent" />
                        <p className="mt-4 text-sm text-gray-500">Loading reviews...</p>
                      </div>
                    ) : reviewError ? (
                      <div className="py-12 text-center">
                        <Info className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                        <p className="font-semibold text-gray-900">Unable to load reviews</p>
                        <p className="mt-2 text-sm text-gray-500">{reviewError}</p>
                      </div>
                    ) : reviews.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                          <MessageSquare className="h-12 w-12 text-gray-400" />
                        </div>
                        <p className="text-xl font-bold text-gray-900">No reviews yet</p>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
                          Be the first to share your experience with this product!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(showAllReviews ? reviews : reviews.slice(0, 5)).map((review, index) => (
                          <motion.div
                            key={review.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className="rounded-2xl border border-gray-100 bg-gray-50 p-5"
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8B1538] to-[#6B1028]">
                                <span className="text-lg font-bold text-white">
                                  {review.user?.name?.charAt(0)?.toUpperCase() || "U"}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-gray-900">
                                    {review.user?.name || "Anonymous"}
                                  </span>

                                  {review.is_verified_purchase && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                                      <BadgeCheck className="h-3 w-3" />
                                      Verified
                                    </span>
                                  )}
                                </div>

                                <div className="mb-3 flex items-center gap-3">
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={cn(
                                          "h-4 w-4",
                                          star <= review.rating
                                            ? "fill-amber-400 text-amber-400"
                                            : "fill-gray-200 text-gray-200",
                                        )}
                                      />
                                    ))}
                                  </div>

                                  <span className="text-xs text-gray-400">{getTimeAgo(review.created_at)}</span>
                                </div>

                                {review.title && <h4 className="mb-2 font-semibold text-gray-900">{review.title}</h4>}

                                <p className="text-sm leading-relaxed text-gray-600">{review.comment}</p>

                                <button
                                  type="button"
                                  onClick={() => handleMarkHelpful(review.id)}
                                  className={cn(
                                    "mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all",
                                    likedReviews.has(review.id)
                                      ? "bg-[#8B1538] text-white"
                                      : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                                  )}
                                >
                                  <ThumbsUp className={cn("h-3.5 w-3.5", likedReviews.has(review.id) && "fill-current")} />
                                  Helpful ({(review.likes_count || 0) + (likedReviews.has(review.id) ? 1 : 0)})
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {reviews.length > 5 && (
                      <motion.button
                        type="button"
                        onClick={() => setShowAllReviews((prev) => !prev)}
                        whileTap={{ scale: 0.985 }}
                        className="mt-6 w-full rounded-xl border-2 border-[#8B1538] py-3.5 text-sm font-bold text-[#8B1538] transition-all hover:bg-[#8B1538] hover:text-white"
                      >
                        {showAllReviews ? "Show Less Reviews" : `View All ${reviews.length} Reviews`}
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {exploreProducts.length > 0 && (
          <motion.div {...motionVariants.fadeIn} className="mt-8">
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <h2 className="text-lg font-bold text-gray-900">Explore Your Interest</h2>
                <Link
                  href="/products"
                  className="flex items-center gap-1 text-sm font-semibold text-[#8B1538] hover:underline"
                >
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-[1px] bg-gray-100 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {exploreProducts.map((item, index) => {
                  const itemDiscount =
                    item?.sale_price && item?.price && item.sale_price < item.price
                      ? Math.round(((item.price - item.sale_price) / item.price) * 100)
                      : 0

                  const itemRating = getSafeRating(item?.rating, 4)
                  const isNewlyLoaded = newlyLoadedStartIndex !== null && index >= newlyLoadedStartIndex

                  return (
                    <Link key={`${item.id}-${index}`} href={`/product/${item.slug || item.id}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 110,
                          damping: 16,
                          delay: isNewlyLoaded
                            ? (index - (newlyLoadedStartIndex || 0)) * 0.04
                            : Math.min(index * 0.015, 0.12),
                        }}
                        whileHover={{ y: -4 }}
                        className="h-full"
                      >
                        <div className="group h-full overflow-hidden rounded-lg border border-gray-100 bg-white transition-all duration-300 hover:shadow-lg">
                          <div className="relative aspect-square overflow-hidden bg-[#f8f8f8]">
                            <Image
                              src={getProductImageUrl(item) || "/generic-product-display.png"}
                              alt={item?.name || "Product"}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              quality={75}
                            />

                            {item?.sale_price && itemDiscount > 0 && (
                              <div className="absolute left-0.5 top-0.5 z-20 rounded-sm bg-[#8B1538] px-1 py-0.5 text-[8px] font-medium text-white sm:left-1 sm:top-1 sm:px-1.5 sm:text-[10px] md:text-xs">
                                -{itemDiscount}%
                              </div>
                            )}
                          </div>

                          <div className="p-1.5 sm:p-2 md:p-3">
                            <h3 className="mb-1 line-clamp-2 min-h-[24px] text-[10px] leading-tight text-gray-800 sm:mb-1.5 sm:min-h-[32px] sm:text-xs md:min-h-[40px] md:text-sm">
                              {item?.name}
                            </h3>

                            <div className="mb-1 sm:mb-1.5">
                              <span className="text-[11px] font-semibold text-[#8B1538] sm:text-sm md:text-base">
                                KSh {Number(item?.sale_price || item?.price || 0).toLocaleString()}
                              </span>
                              {item?.sale_price && (
                                <span className="ml-1 text-[8px] text-gray-400 line-through sm:ml-1.5 sm:text-[10px] md:text-xs">
                                  KSh {Number(item?.price || 0).toLocaleString()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 sm:gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5",
                                    star <= Math.floor(itemRating)
                                      ? "fill-yellow-400 text-yellow-400"
                                      : star - 0.5 <= itemRating
                                        ? "fill-yellow-400/50 text-yellow-400"
                                        : "fill-gray-200 text-gray-200",
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  )
                })}
              </div>

              {exploreHasMore && (
                <div className="flex justify-center border-t border-gray-100 bg-white py-6 sm:py-8">
                  <button
                    type="button"
                    onClick={fetchMoreExploreProducts}
                    disabled={exploreLoading}
                    className="relative flex min-w-[180px] items-center justify-center rounded-full border border-gray-300 bg-white px-12 py-2.5 text-xs font-medium uppercase tracking-widest text-gray-600 transition-all duration-200 hover:border-gray-400 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[200px] sm:px-16 sm:py-3 sm:text-sm"
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                  >
                    <AnimatePresence mode="wait">
                      {exploreLoading ? (
                        <motion.div
                          key="spinner"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center"
                        >
                          <div className="relative h-5 w-5">
                            {Array.from({ length: 12 }).map((_, index) => (
                              <motion.span
                                key={index}
                                className="absolute left-1/2 top-0 h-[5px] w-[2px] rounded-full origin-[50%_10px]"
                                style={{
                                  transform: `translateX(-50%) rotate(${index * 30}deg)`,
                                  backgroundColor: BRAND_COLOR,
                                }}
                                animate={{ opacity: [0.15, 1, 0.15] }}
                                transition={{
                                  duration: 1,
                                  repeat: Number.POSITIVE_INFINITY,
                                  delay: index * (1 / 12),
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
          </motion.div>
        )}
      </div>

      <ImageZoomModal
        product={product}
        isOpen={isImageZoomModalOpen}
        onClose={() => setIsImageZoomModalOpen(false)}
        selectedImageIndex={zoomSelectedImage}
      />
    </div>
  )
}
