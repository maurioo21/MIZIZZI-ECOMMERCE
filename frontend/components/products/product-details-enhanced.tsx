"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { useAuth } from "@/contexts/auth/auth-context"
import { imageBatchService } from "@/services/image-batch-service"

interface ProductDetailsEnhancedProps {
  product: any
  initialReviews?: Review[]
  similarProducts?: any[]
  recentlyViewedProducts?: any[]
}

const PRIMARY_COLOR = "#8B1538" // Cherry red (brand color)
const PRIMARY_HOVER = "#6B1028"
const ACCENT_COLOR = "#FF6B35" // Vibrant orange accent
const SUCCESS_COLOR = "#10B981" // Emerald green

const appleVariants = {
  fadeIn: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.4,
      ease: [0.2, 0, 0.2, 1],
    },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.4,
      ease: [0.175, 0.885, 0.32, 1.275],
    },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

export default function ProductDetailsEnhanced({
  product: initialProduct,
  initialReviews,
  similarProducts,
  recentlyViewedProducts,
}: ProductDetailsEnhancedProps) {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()

  // State
  const [product, setProduct] = useState<any>(initialProduct)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [exploreProducts, setExploreProducts] = useState<any[]>(
    similarProducts && similarProducts.length > 0 ? similarProducts : [],
  )
  const [explorePage, setExplorePage] = useState(1)
  const [exploreHasMore, setExploreHasMore] = useState(true)
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
  const [showSpecifications, setShowSpecifications] = useState(true)
  const [reviewSortBy, setReviewSortBy] = useState<"recent" | "highest" | "lowest">("recent")
  const [likedReviews, setLikedReviews] = useState<Set<number>>(new Set())
  const [animatingReviews, setAnimatingReviews] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<"details" | "specs" | "reviews">("details")

  // Inventory state
  const [inventoryData, setInventoryData] = useState<{
    available_quantity: number
    is_in_stock: boolean
    is_low_stock: boolean
    stock_status: "in_stock" | "low_stock" | "out_of_stock"
    last_updated?: string
  }>({
    available_quantity: initialProduct?.stock || 0,
    is_in_stock: (initialProduct?.stock || 0) > 0,
    is_low_stock: (initialProduct?.stock || 0) > 0 && (initialProduct?.stock || 0) <= 5,
    stock_status:
      (initialProduct?.stock || 0) === 0
        ? "out_of_stock"
        : (initialProduct?.stock || 0) <= 5
          ? "low_stock"
          : "in_stock",
    last_updated: undefined,
  })
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  const [inventoryError, setInventoryError] = useState<string | null>(null)

  const [reviews, setReviews] = useState<Review[]>(initialReviews || [])
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null)
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Refs
  const addToCartInProgress = useRef(false)
  const lastAddToCartTime = useRef(0)
  const imageRef = useRef<HTMLDivElement>(null)
  const reviewSectionRef = useRef<HTMLDivElement>(null)

  // Contexts
  const { addToCart, items: cartItems } = useCart()
  const { isInWishlist, addToWishlist, removeProductFromWishlist } = useWishlist()
  const actualWishlistState = isInWishlist(Number(product?.id))
  const isProductInWishlist = optimisticWishlistState !== null ? optimisticWishlistState : actualWishlistState

  // Derived pricing
  const currentPrice = selectedVariant?.price ?? product?.sale_price ?? product?.price
  const originalPrice = product?.price
  const discountPercentage =
    originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0

  // Helpers
  const getProductImageUrl = (p: any, index = 0, highQuality = false): string => {
    // Try thumbnail_url first for grid items
    if (
      !highQuality &&
      p?.thumbnail_url &&
      typeof p.thumbnail_url === "string" &&
      !p.thumbnail_url.startsWith("blob:")
    ) {
      return p.thumbnail_url
    }

    if (p?.image_urls && p.image_urls.length > index) {
      const url = p.image_urls[index]
      if (typeof url === "string" && url.startsWith("blob:")) {
        return "/generic-product-display.png"
      }
      if (typeof url === "string" && url.trim() !== "" && !url.startsWith("http")) {
        if (highQuality) {
          return cloudinaryService.generateOptimizedUrl(url, {
            width: 2048,
            height: 2048,
            quality: 100,
            format: "auto",
            crop: "fit",
          })
        }
        return cloudinaryService.generateOptimizedUrl(url)
      }
      if (typeof url === "string" && url.startsWith("http")) {
        return url
      }
    }

    // Fallback to thumbnail_url
    if (p?.thumbnail_url && typeof p.thumbnail_url === "string" && !p.thumbnail_url.startsWith("blob:")) {
      return p.thumbnail_url
    }

    return "/generic-product-display.png"
  }

  const getProductImages = (p: any): string[] => {
    let imageUrls: string[] = []
    if (p?.image_urls) {
      if (Array.isArray(p.image_urls)) {
        if (p.image_urls.length > 0 && typeof p.image_urls[0] === "string" && p.image_urls[0].length === 1) {
          try {
            const reconstructed = p.image_urls.join("")
            const parsed = JSON.parse(reconstructed)
            if (Array.isArray(parsed)) {
              imageUrls = parsed
                .filter((u: unknown): u is string => typeof u === "string" && u.trim() !== "" && !u.startsWith("blob:"))
                .map((u: string) => (u.startsWith("http") ? u : cloudinaryService.generateOptimizedUrl(u)))
            }
          } catch {
            imageUrls = []
          }
        } else {
          imageUrls = p.image_urls
            .filter((u: string): u is string => typeof u === "string" && u.trim() !== "" && !u.startsWith("blob:"))
            .map((u: string) => (u.startsWith("http") ? u : cloudinaryService.generateOptimizedUrl(u)))
        }
      } else if (typeof p.image_urls === "string") {
        try {
          const parsed = JSON.parse(p.image_urls)
          if (Array.isArray(parsed)) {
            imageUrls = parsed
              .filter((u): u is string => typeof u === "string" && u.trim() !== "" && !u.startsWith("blob:"))
              .map((u) => (u.startsWith("http") ? u : cloudinaryService.generateOptimizedUrl(u)))
          }
        } catch {
          if (!p.image_urls.startsWith("blob:")) {
            imageUrls = [
              p.image_urls.startsWith("http") ? p.image_urls : cloudinaryService.generateOptimizedUrl(p.image_urls),
            ]
          }
        }
      }
    }
    const valid = imageUrls.filter((u): u is string => Boolean(u && typeof u === "string" && u.trim() !== ""))
    // Fallback to thumbnail_url if no image_urls found
    if (valid.length === 0 && p?.thumbnail_url && typeof p.thumbnail_url === "string") {
      return [p.thumbnail_url]
    }
    // Final fallback to generic placeholder
    return valid.length ? valid : ["/generic-product-display.png"]
  }

  const productImages = useMemo(() => {
    const images = getProductImages(product)
    return images
  }, [product])

  // Effects
  useEffect(() => {
    setProduct(initialProduct)
  }, [initialProduct])

  useEffect(() => {
    if (optimisticWishlistState !== null && optimisticWishlistState === actualWishlistState) {
      setOptimisticWishlistState(null)
    }
  }, [actualWishlistState, optimisticWishlistState])

  // Real-time product updates via WebSocket and polling
  useEffect(() => {
    if (!product?.id) return

    const productId = String(product.id)
    
    // Subscribe to product updates
    const handleProductUpdate = (updatedProduct: any) => {
      if (String(updatedProduct.id) === productId) {
        console.log("[v0] Real-time product update received from admin:", updatedProduct)
        setProduct(updatedProduct)
      }
    }

    // Listen for product_updated events
    websocketService.on("product_updated", handleProductUpdate)

    // Polling fallback for guaranteed instant updates
    const pollInterval = setInterval(async () => {
      try {
        const latestProduct = await productService.getProduct(productId)
        if (latestProduct) {
          // Check if key product info changed (description, images, price, name)
          if (
            latestProduct.description !== product.description ||
            latestProduct.name !== product.name ||
            latestProduct.price !== product.price ||
            latestProduct.sale_price !== product.sale_price ||
            JSON.stringify(latestProduct.image_urls) !== JSON.stringify(product.image_urls)
          ) {
            console.log("[v0] Product changes detected via polling, updating display instantly")
            setProduct(latestProduct)
          }
        }
      } catch (error) {
        console.error("[v0] Error polling for product updates:", error)
      }
    }, 3000) // Poll every 3 seconds for instant updates

    return () => {
      websocketService.off("product_updated", handleProductUpdate)
      clearInterval(pollInterval)
    }
  }, [product?.id])

  const fetchInventoryData = useCallback(async () => {
    if (!product?.id) return
    setInventoryError(null)
    try {
      const summary = await inventoryService.getProductInventorySummary(Number(product.id), selectedVariant?.id)
      const available = summary.total_available_quantity ?? 0
      const stock_status: "in_stock" | "low_stock" | "out_of_stock" =
        available === 0 ? "out_of_stock" : summary.is_low_stock ? "low_stock" : "in_stock"
      setInventoryData({
        available_quantity: available,
        is_in_stock: !!summary.is_in_stock,
        is_low_stock: !!summary.is_low_stock,
        stock_status,
        last_updated: summary.items?.[0]?.last_updated,
      })
    } catch (error: any) {
      console.error("[v0] Background inventory fetch error:", error)
    }
  }, [product?.id, product?.stock, selectedVariant?.id])

  useEffect(() => {
    fetchInventoryData()
  }, [fetchInventoryData])

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      // Only fetch if we don't have products already and some initial products are not enough
      if (exploreProducts.length >= 12) {
        setExploreLoading(false)
        return
      }

      setExploreLoading(true)
      try {
        let allProducts: any[] = []

        // First: Try to get products from the same category
        if (product?.category_id) {
          try {
            const categoryProducts = await productService.getProductsByCategory(String(product.category_id))
            allProducts = categoryProducts.filter((p: any) => p.id !== product.id)
          } catch (e) {
            console.error("[v0] Error fetching category products:", e)
          }
        }

        // If not enough from category, fetch more general products
        if (allProducts.length < 12) {
          try {
            const response = await fetch(`/api/products?limit=30&page=1`)
            const data = await response.json()
            const generalProducts = (data?.products || data?.items || data || []).filter(
              (p: any) => p.id !== product.id && !allProducts.some((ap: any) => ap.id === p.id),
            )
            allProducts = [...allProducts, ...generalProducts]
          } catch (e) {
            console.error("[v0] Error fetching general products:", e)
          }
        }

        // Smart sorting: prioritize by category match, then price similarity, then rating
        const productPrice = product?.sale_price || product?.price || 0
        const sortedProducts = allProducts.sort((a: any, b: any) => {
          // Same category gets priority
          const aCategoryMatch = a.category_id === product?.category_id ? 1 : 0
          const bCategoryMatch = b.category_id === product?.category_id ? 1 : 0
          if (aCategoryMatch !== bCategoryMatch) return bCategoryMatch - aCategoryMatch

          // Then sort by price similarity (closer price = higher priority)
          const aPriceDiff = Math.abs((a.sale_price || a.price || 0) - productPrice)
          const bPriceDiff = Math.abs((b.sale_price || b.price || 0) - productPrice)
          if (aPriceDiff !== bPriceDiff) return aPriceDiff - bPriceDiff

          // Finally by rating
          return (b.rating || 0) - (a.rating || 0)
        })

        setExploreProducts(sortedProducts.slice(0, 12))
        setExploreHasMore(sortedProducts.length > 12)
      } catch (error) {
        console.error("[v0] Error in fetchRelatedProducts:", error)
      } finally {
        setExploreLoading(false)
      }
    }

    if (product?.id && exploreProducts.length < 12) {
      fetchRelatedProducts()
    } else if (!product?.id) {
      // Handle case where product might be null initially
      setExploreLoading(false)
    }
  }, [product?.id, product?.category_id, product?.price, product?.sale_price, exploreProducts.length])

  useEffect(() => {
    const run = async () => {
      // Removed redundant check for similarProducts.length > 0 as initial state handles it.
      // The fetchRelatedProducts hook now handles populating exploreProducts.
      if (!product?.category_id && exploreProducts.length === 0) {
        setExploreLoading(false)
        return
      }
      // Set loading true only if we actually need to fetch
      if (exploreProducts.length < 12 && !exploreLoading) {
        setExploreLoading(true)
      }

      // The logic for fetching 'exploreProducts' is now handled by the 'fetchRelatedProducts' effect.
      // This block is kept for the 'recently viewed' logic.
      try {
        const recentItems = JSON.parse(localStorage.getItem("recentlyViewed") || "[]")
        const exists = recentItems.some((i: any) => i.id === product.id)
        if (!exists) {
          const updated = [
            {
              id: product.id,
              name: product.name,
              price: currentPrice,
              image: productImages[0] || "/placeholder-rhtiu.png",
              slug: product.slug || product.id,
              image_urls: productImages,
              thumbnail_url: product.thumbnail_url,
            },
            ...recentItems,
          ].slice(0, 6)
          localStorage.setItem("recentlyViewed", JSON.stringify(updated)) // Fixed typo JSON.JSON to JSON
          setRecentlyViewed(updated)
        } else {
          setRecentlyViewed(recentItems)
        }
      } catch {}
    }
    run()
  }, [
    product.id,
    product.category_id,
    product.name,
    currentPrice,
    product.slug,
    product.thumbnail_url,
    productImages,
    similarProducts, // Keep this for potential future use or if initial state needs re-evaluation
    exploreProducts.length, // Dependency to ensure re-evaluation if exploreProducts changes
    exploreLoading, // Dependency to manage loading state correctly
  ])

  useEffect(() => {
    const handleProductUpdate = (event: CustomEvent) => {
      const { id, product: updatedProduct } = event.detail
      if (id === product?.id?.toString()) {
        fetchInventoryData()
      }
    }

    const handleInventoryUpdate = (event: CustomEvent) => {
      const { product_id, stock, is_low_stock } = event.detail
      if (product_id === product?.id) {
        setInventoryData((prev) => ({
          ...prev,
          available_quantity: stock,
          is_in_stock: stock > 0,
          is_low_stock: is_low_stock,
          stock_status: stock === 0 ? "out_of_stock" : is_low_stock ? "low_stock" : "in_stock",
          last_updated: new Date().toISOString(),
        }))
      }
    }

    window.addEventListener("product-updated", handleProductUpdate as EventListener)
    window.addEventListener("inventory-updated", handleInventoryUpdate as EventListener)

    return () => {
      window.removeEventListener("product-updated", handleProductUpdate as EventListener)
      window.removeEventListener("inventory-updated", handleInventoryUpdate as EventListener)
    }
  }, [product?.id, fetchInventoryData])

  useEffect(() => {
    const handleProductImagesUpdated = (event: CustomEvent) => {
      const { productId: updatedProductId } = event.detail || {}

      if (updatedProductId && updatedProductId.toString() === product.id.toString()) {
        imageBatchService.invalidateCache(product.id.toString())
        fetchInventoryData()

        productService
          .getProduct(product.id.toString())
          .then((updatedProduct) => {
            if (updatedProduct) {
              return imageBatchService.fetchProductImages(product.id.toString()).then((images: any[]) => {
                if (images && images.length > 0) {
                  updatedProduct.image_urls = images.map((img: any) => img.url || img.image_url).filter(Boolean)
                }
                setProduct(updatedProduct)
                setSelectedImage(0)
              })
            }
          })
          .catch((error) => {
            console.error("[v0] Error refreshing product:", error)
          })
      }
    }

    window.addEventListener("productImagesUpdated", handleProductImagesUpdated as EventListener)

    return () => {
      window.removeEventListener("productImagesUpdated", handleProductImagesUpdated as EventListener)
    }
  }, [product.id, fetchInventoryData])

  useEffect(() => {
    const fetchAllProductImages = async () => {
      try {
        imageBatchService.invalidateCache(product.id.toString())

        const images: any[] = await imageBatchService.fetchProductImages(product.id.toString())

        if (images && images.length > 0) {
          const imageUrls = images.map((img: any) => img.url || img.image_url).filter(Boolean)

          setProduct((prev: any) => ({
            ...prev,
            image_urls: imageUrls,
          }))
        } else {
          setProduct((prev: any) => ({
            ...prev,
            image_urls: [],
          }))
        }
      } catch (error) {
        console.error("[v0] Error fetching product images:", error)
        setProduct((prev: any) => ({
          ...prev,
          image_urls: [],
        }))
      }
    }

    if (product?.id) {
      fetchAllProductImages()
    }
  }, [product?.id])

  // Actions
  const handleVariantSelection = (variant: any) => setSelectedVariant(variant)
  const handleImageClick = () => {
    setZoomSelectedImage(selectedImage)
    setIsImageZoomModalOpen(true)
  }

  const StarRating = ({
    rating,
    onRatingChange,
    interactive = false,
    size = 16,
  }: {
    rating: number
    onRatingChange?: (rating: number) => void
    interactive?: boolean
    size?: number
  }) => {
    const [hoverRating, setHoverRating] = useState(0)

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            onClick={() => interactive && onRatingChange?.(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={cn(
              "transition",
              interactive && "cursor-pointer",
              (hoverRating || rating) >= star ? "text-amber-400" : "text-gray-200",
            )}
            disabled={!interactive}
            whileHover={interactive ? { scale: 1.1 } : undefined}
          >
            <Star size={size} fill={(hoverRating || rating) >= star ? "currentColor" : "none"} strokeWidth={1.5} />
          </motion.button>
        ))}
      </div>
    )
  }

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
      setReviews(reviewsResponse.items)
      setReviewSummary(summaryResponse)
    } catch (error: any) {
      console.error("[v0] Error fetching reviews:", error)
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

  useEffect(() => {
    if (product?.id) {
      fetchReviews()
    }
  }, [fetchReviews, product?.id])

  const handleMarkHelpful = useCallback(
    async (reviewId: number) => {
      if (animatingReviews.has(reviewId)) return

      setAnimatingReviews((prev) => new Set(prev).add(reviewId))

      const isCurrentlyLiked = likedReviews.has(reviewId)
      setLikedReviews((prev) => {
        const newSet = new Set(prev)
        if (isCurrentlyLiked) {
          newSet.delete(reviewId)
        } else {
          newSet.add(reviewId)
        }
        return newSet
      })

      try {
        await reviewService.markReviewHelpful(reviewId)
        await fetchReviews()
      } catch (error: any) {
        console.error("[v0] Error marking review helpful:", error)
        setLikedReviews((prev) => {
          const newSet = new Set(prev)
          if (isCurrentlyLiked) {
            newSet.add(reviewId)
          } else {
            newSet.delete(reviewId)
          }
          return newSet
        })
        toast({
          title: "Error",
          description: error?.message || "Failed to mark review as helpful",
          variant: "destructive",
        })
      } finally {
        setTimeout(() => {
          setAnimatingReviews((prev) => {
            const newSet = new Set(prev)
            newSet.delete(reviewId)
            return newSet
          })
        }, 300)
      }
    },
    [animatingReviews, likedReviews, fetchReviews, toast],
  )

  const handleAddToCart = async (): Promise<boolean> => {
    if (!inventoryData?.is_in_stock) {
      toast({ title: "Out of Stock", description: "This product is currently out of stock", variant: "destructive" })
      return false
    }
    try {
      const fresh = await inventoryService.checkAvailability(Number(product.id), quantity, selectedVariant?.id)
      if (!fresh.is_available || quantity > fresh.available_quantity) {
        setInventoryData({
          available_quantity: fresh.available_quantity,
          is_in_stock: fresh.available_quantity > 0,
          is_low_stock: !!fresh.is_low_stock,
          stock_status: fresh.available_quantity === 0 ? "out_of_stock" : fresh.is_low_stock ? "low_stock" : "in_stock",
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
    } catch {}
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
    if (now - lastAddToCartTime.current < 1200) return false
    if ((product.variants?.length ?? 0) > 0 && !selectedVariant) {
      toast({
        title: "Select Options",
        description: "Please choose the required product options before adding to cart",
        variant: "destructive",
      })
      return false
    }
    if (quantity <= 0) {
      toast({ title: "Invalid quantity", description: "Please select at least 1 item", variant: "destructive" })
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
          name: product.name,
          price: currentPrice,
          quantity,
          thumbnail_url: productImages[0] || "/shopping-cart-thumbnail.png",
        })
        setShowCartNotification(true)
        setTimeout(() => setShowCartNotification(false), 4500)

        // Check if this is guest mode and show appropriate message
        if (result.message && result.message.includes("guest")) {
          toast({
            title: "Added to Cart",
            description: "Item added to your cart. Log in to proceed to checkout.",
            variant: "default",
          })
        }

        return true
      } else {
        // Check if it's an auth error and provide helpful message
        const message = result.message || "Failed to add item to cart"
        const isAuthError = message.toLowerCase().includes("log in") || message.toLowerCase().includes("auth")

        toast({
          title: isAuthError ? "Cart Ready" : "Error",
          description: isAuthError ? "Item added to your cart. Log in to complete your purchase." : message,
          variant: isAuthError ? "default" : "destructive",
        })
        return !isAuthError // Treat auth cases as success since item was added to guest cart
      }
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
      setTimeout(() => {
        addToCartInProgress.current = false
        setIsAddingToCart(false)
      }, 1200)
    }
  }

  const handleToggleWishlist = async () => {
    if (isTogglingWishlist) return

    try {
      setIsTogglingWishlist(true)

      const newState = !isProductInWishlist
      setOptimisticWishlistState(newState)

      if (isProductInWishlist) {
        await removeProductFromWishlist(Number(product.id))
      } else {
        await addToWishlist({ product_id: Number(product.id) })
      }
    } catch (error: any) {
      setOptimisticWishlistState(null)

      console.error("[v0] Error toggling wishlist:", error)

      if (!error.message?.includes("already")) {
        toast({
          title: "Error",
          description: "Failed to update wishlist. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setTimeout(() => {
        setIsTogglingWishlist(false)
      }, 500)
    }
  }

  const handleShare = () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    if ((navigator as any).share) {
      ;(navigator as any).share({ title: product.name, text: product.description, url }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
      toast({ title: "Link copied", description: "Product link copied to clipboard" })
    }
  }

  const getProductSpecifications = (p: any) => {
    if (p?.specifications) {
      let specs = p.specifications
      if (typeof specs === "string") {
        try {
          specs = JSON.parse(specs)
        } catch (e) {
          console.error("[v0] Failed to parse specifications JSON:", e)
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

      if (typeof specs === "object" && !Array.isArray(specs)) {
        const categorizedSpecs: Array<{ category: string; items: Array<{ label: string; value: string }> }> = []

        const categoryOrder = ["product_identification", "specifications", "what's_in_the_box", "options"]

        categoryOrder.forEach((categoryKey) => {
          const categoryData = specs[categoryKey]
          if (categoryData && typeof categoryData === "object") {
            const displayName = categoryKey
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")

            const items: Array<{ label: string; value: string }> = []
            Object.entries(categoryData).forEach(([key, value]) => {
              const fieldName = key
                .split("_")
                .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
                .join(" ")

              if (value && typeof value === "string") {
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

        if (categorizedSpecs.length > 0) {
          return categorizedSpecs
        }
      }
    }

    const specs: Array<{ category: string; items: Array<{ label: string; value: string }> }> = []

    const identificationItems: Array<{ label: string; value: string }> = []
    if (p?.brand?.name) identificationItems.push({ label: "Brand", value: p.brand.name })
    if (p?.name) identificationItems.push({ label: "Model", value: p.name })
    if (p?.sku) identificationItems.push({ label: "SKU", value: p.sku })

    if (identificationItems.length > 0) {
      specs.push({
        category: "Product Identification",
        items: identificationItems,
      })
    }

    const physicalItems: Array<{ label: string; value: string }> = []
    if (p?.weight) physicalItems.push({ label: "Weight", value: `${p.weight}kg` })
    if (p?.dimensions) {
      if (typeof p.dimensions === "object" && p.dimensions !== null) {
        const { height, length, width } = p.dimensions as any
        if (height && length && width) {
          physicalItems.push({ label: "Dimensions", value: `${length}L × ${width}W × ${height}H cm` })
        }
      } else if (typeof p.dimensions === "string" && p.dimensions) {
        physicalItems.push({ label: "Dimensions", value: p.dimensions })
      }
    }
    if (p?.material) physicalItems.push({ label: "Material", value: p.material })
    if (p?.color) physicalItems.push({ label: "Color", value: p.color })

    if (physicalItems.length > 0) {
      specs.push({ category: "Specifications", items: physicalItems })
    }

    const packageItems: Array<{ label: string; value: string }> = []
    if (p?.package_contents && Array.isArray(p.package_contents)) {
      p.package_contents.forEach((item: string, idx: number) => {
        packageItems.push({ label: `Item ${idx + 1}`, value: item })
      })
    }

    if (packageItems.length > 0) {
      specs.push({ category: "What's in the Box", items: packageItems })
    }

    if (p?.variants && p.variants.length) {
      const colors = [...new Set(p.variants.map((v: any) => v.color).filter(Boolean))]
      const sizes = [...new Set(p.variants.map((v: any) => v.size).filter(Boolean))]
      const variantItems: Array<{ label: string; value: string }> = []
      if (colors.length) variantItems.push({ label: "Available Colors", value: colors.join(", ") })
      if (sizes.length) variantItems.push({ label: "Available Sizes", value: sizes.join(", ") })
      if (variantItems.length) specs.push({ category: "Available Options", items: variantItems })
    }

    return specs
  }
  const specifications = getProductSpecifications(product)

  const calculateAverageRating = () => {
    return reviewSummary?.average_rating || 0
  }

  const stockDisplay = (() => {
    if (inventoryError)
      return {
        icon: AlertTriangle,
        text: "Unable to check stock",
        cls: "text-orange-600 bg-orange-50 border-orange-200",
        ic: "text-orange-600",
      }
    if (!inventoryData)
      return {
        icon: XCircle,
        text: "Stock information unavailable",
        cls: "text-gray-500 bg-gray-50 border-gray-200",
        ic: "text-gray-500",
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
        return { icon: XCircle, text: "Out of stock", cls: "text-red-600 bg-red-50 border-red-200", ic: "text-red-600" }
      default:
        return {
          icon: Info,
          text: "Stock status unknown",
          cls: "text-gray-500 bg-gray-50 border-gray-200",
          ic: "text-gray-500",
        }
    }
  })()

  const handleBuyViaWhatsApp = () => {
    const whatsappNumber = "254746741719"
    const message = encodeURIComponent(
      `I'm interested in buying ${product.name}. Price: ${formatPrice(currentPrice)}. Quantity: ${quantity}. Please assist me with the purchase.`,
    )
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank")
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return "Today"
    if (diffInDays === 1) return "Yesterday"
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`
    return `${Math.floor(diffInDays / 365)} years ago`
  }

  const fetchMoreExploreProducts = useCallback(async () => {
    if (exploreLoading || !exploreHasMore) return

    setExploreLoading(true)
    try {
      const nextPage = explorePage + 1
      const response = await fetch(
        `/api/products?limit=12&page=${nextPage}${product?.category?.slug ? `&category_slug=${product.category.slug}` : ""}`,
      )
      const data = await response.json()

      const products = data?.products || data?.items || data || []
      const filteredData = products.filter((p: any) => p.id !== product?.id)

      if (filteredData.length > 0) {
        setExploreProducts((prev) => {
          setNewlyLoadedStartIndex(prev.length)
          return [...prev, ...filteredData]
        })
        setExplorePage(nextPage)
        setExploreHasMore(filteredData.length >= 12)
      } else {
        setExploreHasMore(false)
      }
    } catch (error) {
      console.error("[v0] Error fetching more explore products:", error)
      setExploreHasMore(false)
    } finally {
      setExploreLoading(false)
    }
  }, [exploreLoading, exploreHasMore, explorePage, product?.id, product?.category?.slug])

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Cart Toast */}
      <AnimatePresence>
        {showCartNotification && cartNotificationData && (
          <motion.div
            {...appleVariants.scaleIn}
            exit={{ opacity: 0, scale: 0.95, y: 24 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm"
            role="status"
            aria-live="polite"
          >
            <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                  <Image
                    src={cartNotificationData?.thumbnail_url || "/generic-product-display.png"}
                    alt={cartNotificationData?.name || "Product"}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight">
                    {cartNotificationData?.name}
                  </p>
                  <div className="flex items-center gap-2 text-sm mt-1.5">
                    <span className="font-bold text-[#8B1538]">{formatPrice(cartNotificationData?.price || 0)}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">Qty: {cartNotificationData?.quantity || 1}</span>
                  </div>
                </div>
                <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCartNotification(false)}
                  className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Continue
                </button>
                <Link href="/cart" className="flex-1">
                  <button className="w-full h-11 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#6B1028] transition-colors">
                    View Cart ({cartItems.length})
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breadcrumbs */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center text-sm text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="flex items-center hover:text-[#8B1538] transition-colors">
              <Home className="mr-1.5 h-4 w-4" />
              Home
            </Link>
            <ChevronRight className="mx-2 h-4 w-4 text-gray-300" />
            <Link href="/products" className="hover:text-[#8B1538] transition-colors">
              Products
            </Link>
            <ChevronRight className="mx-2 h-4 w-4 text-gray-300" />
            <span className="text-gray-900 font-medium truncate max-w-[200px]">{product?.name}</span>
          </nav>
        </div>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Image Gallery */}
          <motion.div {...appleVariants.fadeIn} className="lg:col-span-5">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm sticky top-6">
              <div className="relative aspect-[4/3] cursor-zoom-in group bg-gray-50" ref={imageRef} onClick={handleImageClick}>
                <Image
                  src={productImages[selectedImage] || "/generic-product-display.png"}
                  alt={product?.name || "Product image"}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-contain p-6 transition-transform duration-500 group-hover:scale-105"
                  priority
                  loading="eager"
                  quality={85}
                  onError={() => {
                    // Fallback to generic image if specific image fails
                    console.log("[v0] Image failed to load:", productImages[selectedImage])
                  }}
                />

                {/* Discount Badge */}
                {discountPercentage > 0 && (
                  <div className="absolute top-4 left-4 bg-[#FF6B35] text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    -{discountPercentage}%
                  </div>
                )}

                {/* Navigation Arrows */}
                {productImages.length > 1 && (
                  <>
                    <button
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedImage((prev) => (prev === 0 ? productImages.length - 1 : prev - 1))
                      }}
                    >
                      <ArrowLeft className="h-5 w-5 text-gray-700" />
                    </button>
                    <button
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedImage((prev) => (prev === productImages.length - 1 ? 0 : prev + 1))
                      }}
                    >
                      <ArrowRight className="h-5 w-5 text-gray-700" />
                    </button>
                  </>
                )}

                {/* Zoom hint */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Click to zoom</span>
                </div>
              </div>

              {/* Thumbnails */}
              <div className="p-4 border-t border-gray-100">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {productImages.map((img, i) => (
                    <button
                      key={i}
                      className={cn(
                        "relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all bg-gray-50",
                        selectedImage === i
                          ? "border-[#8B1538] ring-2 ring-[#8B1538]/20"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                      onClick={() => setSelectedImage(i)}
                    >
                      <Image
                        src={img || "/generic-product-display.png"}
                        alt={`Thumbnail ${i + 1}`}
                        fill
                        sizes="80px"
                        className="object-cover"
                        loading={i === 0 ? "eager" : "lazy"}
                        quality={75}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* CENTER COLUMN: Product Info */}
          <motion.div {...appleVariants.fadeIn} className="lg:col-span-4 space-y-4">
            {/* Product Title & Rating */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {product?.is_flash_sale && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FF6B35]/10 text-[#FF6B35] text-xs font-semibold rounded-full">
                    <Zap className="w-3 h-3" />
                    Flash Sale
                  </span>
                )}
                {product?.is_luxury_deal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-600 text-xs font-semibold rounded-full">
                    <Award className="w-3 h-3" />
                    Premium
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-gray-900 leading-tight mb-3">{product?.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <StarRating rating={calculateAverageRating()} size={16} />
                  <span className="text-sm font-semibold text-gray-900">{calculateAverageRating().toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">({reviewSummary?.total_reviews || 0} reviews)</span>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-black text-[#8B1538]">{formatPrice(currentPrice)}</span>
                {currentPrice < originalPrice && (
                  <span className="text-lg text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                )}
              </div>

              {/* Stock Status */}
              <div
                className={cn(
                  "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full border",
                  stockDisplay.cls,
                )}
              >
                <stockDisplay.icon className={cn("h-4 w-4 mr-1.5", stockDisplay.ic)} />
                {stockDisplay.text}
              </div>
            </div>

            {/* Seller Info */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#8B1538]/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-[#8B1538]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Mizizzi Store</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">
                        Official
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">Verified Seller</p>
                  </div>
                </div>
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Shipping & Returns */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Free Delivery</p>
                    <p className="text-xs text-gray-500">Orders over KSh 2,000</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Easy Returns</p>
                    <p className="text-xs text-gray-500">14-day return policy</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">100% Genuine</p>
                    <p className="text-xs text-gray-500">Verified quality products</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: Purchase Panel (Sticky) */}
          <motion.div {...appleVariants.slideUp} className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm sticky top-6">
              <div className="p-5 space-y-5">
                {/* Variants */}
                {product?.variants?.length > 0 && (
                  <div className="space-y-4">
                    {/* Color Variants */}
                    {Array.from(new Set(product.variants.map((v: any) => v.color))).filter(Boolean).length > 0 && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Color</label>
                        <div className="flex flex-wrap gap-2">
                          {(Array.from(new Set(product.variants.map((v: any) => v.color))) as string[])
                            .filter(Boolean)
                            .map((color, i) => {
                              const active = selectedVariant?.color === color
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    const v = product.variants.find((x: any) => x.color === color)
                                    if (v) handleVariantSelection(v)
                                  }}
                                  className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
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

                    {/* Size Variants */}
                    {Array.from(new Set(product.variants.map((v: any) => v.size))).filter(Boolean).length > 0 && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Size</label>
                        <div className="flex flex-wrap gap-2">
                          {(Array.from(new Set(product.variants.map((v: any) => v.size))) as string[])
                            .filter(Boolean)
                            .map((size, i) => {
                              const active = selectedVariant?.size === size
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    const v = product.variants.find((x: any) => x.size === size)
                                    if (v) handleVariantSelection(v)
                                  }}
                                  className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
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

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Quantity</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="w-12 h-10 flex items-center justify-center border-l border-r border-gray-200 bg-gray-50">
                        <span className="text-sm font-bold text-gray-900">{quantity}</span>
                      </div>
                      <button
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        onClick={() => setQuantity((q) => Math.min(inventoryData?.available_quantity || 0, q + 1))}
                        disabled={!inventoryData?.is_in_stock || quantity >= (inventoryData?.available_quantity || 0)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">{inventoryData?.available_quantity || 0} available</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  <motion.button
                    onClick={handleAddToCart}
                    disabled={isAddingToCart || !inventoryData?.is_in_stock}
                    className={cn(
                      "w-full h-12 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all",
                      isAddingToCart || !inventoryData?.is_in_stock
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-[#8B1538] hover:bg-[#6B1028] shadow-lg shadow-[#8B1538]/20",
                    )}
                    whileTap={inventoryData?.is_in_stock ? { scale: 0.98 } : {}}
                  >
                    {isAddingToCart ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                    onClick={handleBuyViaWhatsApp}
                    className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    <FaWhatsapp className="h-5 w-5" />
                    Buy via WhatsApp
                  </motion.button>

                  <motion.button
                    onClick={handleToggleWishlist}
                    disabled={isTogglingWishlist}
                    className={cn(
                      "w-full h-12 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all",
                      isProductInWishlist
                        ? "border-[#8B1538] bg-[#8B1538]/5 text-[#8B1538]"
                        : "border-gray-200 text-gray-700 hover:border-[#8B1538] hover:text-[#8B1538]",
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Heart className={cn("h-4 w-4", isProductInWishlist && "fill-current")} />
                    {isProductInWishlist ? "Saved to Wishlist" : "Add to Wishlist"}
                  </motion.button>
                </div>

                {/* Payment Methods */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <CreditCard className="h-4 w-4" />
                    <span>Visa, Mastercard, M-Pesa, Airtel Money</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Product Details Tabs */}
        <motion.div {...appleVariants.fadeIn} className="mt-8">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Tab Headers */}
            <div className="border-b border-gray-100">
              <div className="flex">
                {["details", "specs", "reviews"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={cn(
                      "flex-1 py-4 px-6 text-sm font-semibold transition-all relative",
                      activeTab === tab ? "text-[#8B1538]" : "text-gray-500 hover:text-gray-700",
                    )}
                  >
                    {tab === "details" && "Product Details"}
                    {tab === "specs" && "Specifications"}
                    {tab === "reviews" && `Reviews (${reviewSummary?.total_reviews || 0})`}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B1538]"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {activeTab === "details" && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {/* // Added inline style tag with !important rules to force images full-width */}
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
                      {product?.description ? (
                        <div
                          className="product-description-content text-gray-700 space-y-6
                            [&>p]:leading-relaxed [&>p]:text-[15px] [&>p]:text-gray-600 [&>p]:mb-4
                            [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mt-8 [&>h2]:mb-4
                            [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mt-6 [&>h3]:mb-3
                            [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2 [&>ul>li]:text-gray-600
                            [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:space-y-2 [&>ol>li]:text-gray-600"
                          dangerouslySetInnerHTML={{
                            __html: product.description,
                          }}
                        />
                      ) : (
                        <div className="text-center py-12">
                          <Info className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-900 font-semibold">No description available</p>
                          <p className="text-sm text-gray-500 mt-2">Product details will be updated soon.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "specs" && (
                  <motion.div
                    key="specs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {specifications.length > 0 ? (
                      <div className="grid gap-6 md:grid-cols-2">
                        {specifications.map(
                          (spec: { category: string; items: { label: string; value: string }[] }, idx: number) => (
                            <div key={idx} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                                <div className="w-10 h-10 rounded-xl bg-[#8B1538]/10 flex items-center justify-center">
                                  <Shield className="w-5 h-5 text-[#8B1538]" />
                                </div>
                                <h4 className="font-bold text-gray-900">{spec.category}</h4>
                              </div>
                              <div className="space-y-3">
                                {spec.items.map((item: { label: string; value: string }, itemIdx: number) => (
                                  <div key={itemIdx} className="flex justify-between items-start gap-4">
                                    <span className="text-sm text-gray-500 flex-shrink-0">{item.label}</span>
                                    <span className="text-sm text-gray-900 font-medium text-right">{item.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                          <Info className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-gray-900 font-semibold text-lg">No specifications available</p>
                        <p className="text-sm text-gray-500 mt-2">Product specifications will be updated soon.</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "reviews" && (
                  <motion.div
                    key="reviews"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {reviewSummary && reviewSummary.total_reviews > 0 && (
                      <div className="grid md:grid-cols-2 gap-6 mb-8">
                        {/* Overall Rating Card */}
                        <div className="bg-gradient-to-br from-[#8B1538] to-[#6B1028] rounded-2xl p-6 text-white">
                          <h3 className="text-sm font-medium opacity-80 mb-2">Overall Rating</h3>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-5xl font-black">{calculateAverageRating().toFixed(1)}</span>
                            <span className="text-lg opacity-70">/ 5</span>
                          </div>
                          <div className="flex gap-1 mb-3">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "h-5 w-5",
                                  star <= Math.round(calculateAverageRating())
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-white/20 text-white/20",
                                )}
                              />
                            ))}
                          </div>
                          <p className="text-sm opacity-80">Based on {reviewSummary.total_reviews} reviews</p>
                        </div>

                        {/* Rating Distribution Card */}
                        <div className="bg-gray-50 rounded-2xl p-6">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Rating Distribution</h3>
                          <div className="space-y-3">
                            {[5, 4, 3, 2, 1].map((star) => {
                              const distribution = reviewSummary?.rating_distribution as
                                | Record<string, number>
                                | undefined
                              const count = distribution?.[star.toString()] ?? 0
                              const percentage =
                                reviewSummary && reviewSummary.total_reviews > 0
                                  ? (count / reviewSummary.total_reviews) * 100
                                  : 0
                              return (
                                <div key={star} className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 w-8">
                                    <span className="text-sm font-bold text-gray-700">{star}</span>
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  </div>
                                  <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                    <motion.div
                                      className="h-full bg-amber-400 rounded-full"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percentage}%` }}
                                      transition={{ duration: 0.6, delay: 0.1 * (5 - star) }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sort Options */}
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-sm text-gray-600 font-medium">Sort by:</span>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { key: "recent", label: "Most Recent" },
                          { key: "highest", label: "Highest Rated" },
                          { key: "lowest", label: "Lowest Rated" },
                        ].map((option) => (
                          <button
                            key={option.key}
                            onClick={() => setReviewSortBy(option.key as any)}
                            className={cn(
                              "px-4 py-2 text-xs font-semibold rounded-full transition-all",
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

                    {/* Reviews List */}
                    {isLoadingReviews ? (
                      <div className="py-16 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-3 border-[#8B1538] border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-500 mt-4">Loading reviews...</p>
                      </div>
                    ) : reviews.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                          <MessageSquare className="h-12 w-12 text-gray-400" />
                        </div>
                        <p className="text-gray-900 font-bold text-xl">No reviews yet</p>
                        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                          Be the first to share your experience with this product!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(showAllReviews ? reviews : reviews.slice(0, 5)).map((review, index) => (
                          <motion.div
                            key={review.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-gray-50 rounded-2xl p-5 border border-gray-100"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B1538] to-[#6B1028] flex items-center justify-center flex-shrink-0">
                                <span className="text-lg font-bold text-white">
                                  {review.user?.name?.charAt(0)?.toUpperCase() || "U"}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <span className="font-bold text-gray-900">{review.user?.name || "Anonymous"}</span>
                                  {review.is_verified_purchase && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                                      <BadgeCheck className="w-3 h-3" />
                                      Verified
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mb-3">
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
                                {review.title && <h4 className="font-semibold text-gray-900 mb-2">{review.title}</h4>}
                                <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                                <button
                                  onClick={() => handleMarkHelpful(review.id)}
                                  className={cn(
                                    "mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all",
                                    likedReviews.has(review.id)
                                      ? "bg-[#8B1538] text-white"
                                      : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300",
                                  )}
                                >
                                  <ThumbsUp
                                    className={cn("h-3.5 w-3.5", likedReviews.has(review.id) && "fill-current")}
                                  />
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
                        onClick={() => setShowAllReviews(!showAllReviews)}
                        whileTap={{ scale: 0.98 }}
                        className="mt-6 w-full py-3.5 text-sm font-bold text-[#8B1538] border-2 border-[#8B1538] rounded-xl hover:bg-[#8B1538] hover:text-white transition-all"
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
          <motion.div {...appleVariants.fadeIn} className="mt-8">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Explore Your Interest</h2>
                <Link
                  href="/products"
                  className="text-sm font-semibold text-[#8B1538] hover:underline flex items-center gap-1"
                >
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Products Grid - Same as product-grid.tsx */}
              {/* Changed grid columns to reflect 12 products (2 rows of 6) */}
              <div className="grid grid-cols-2 gap-[1px] bg-gray-100 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {exploreProducts.map((item, index) => {
                  const itemDiscount = item.sale_price
                    ? Math.round(((item.price - item.sale_price) / item.price) * 100)
                    : 0
                  const itemRating = item.rating || 3 + Math.random() * 2
                  const isNewlyLoaded = newlyLoadedStartIndex !== null && index >= newlyLoadedStartIndex

                  return (
                    <Link key={`${item.id}-${index}`} href={`/product/${item.slug || item.id}`} prefetch={false}>
                      <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 100,
                          damping: 15,
                          delay: isNewlyLoaded ? (index - (newlyLoadedStartIndex || 0)) * 0.05 : index * 0.02,
                        }}
                        whileHover={{ y: -8 }}
                        className="h-full"
                      >
                        <div className="group h-full overflow-hidden bg-white border border-gray-100 rounded-lg transition-all duration-300 hover:shadow-lg">
                          <div className="relative aspect-square overflow-hidden bg-[#f8f8f8]">
                            <Image
                              src={getProductImageUrl(item) || "/logo.png"}
                              alt={item.name}
                              fill
                              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                // Fallback to Mizizzi logo if image fails to load
                                const target = e.target as HTMLImageElement
                                target.src = "/logo.png"
                              }}
                            />

                            {item.sale_price && itemDiscount > 0 && (
                              <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 bg-[#8B1538] text-white text-[8px] sm:text-[10px] md:text-xs font-medium px-1 sm:px-1.5 py-0.5 rounded-sm z-20">
                                -{itemDiscount}%
                              </div>
                            )}
                          </div>

                          <div className="p-1.5 sm:p-2 md:p-3">
                            <h3 className="text-gray-800 text-[10px] sm:text-xs md:text-sm line-clamp-2 leading-tight mb-1 sm:mb-1.5 min-h-[24px] sm:min-h-[32px] md:min-h-[40px]">
                              {item.name}
                            </h3>

                            <div className="mb-1 sm:mb-1.5">
                              <span className="font-semibold text-[#8B1538] text-[11px] sm:text-sm md:text-base">
                                KSh {(item.sale_price || item.price).toLocaleString()}
                              </span>
                              {item.sale_price && (
                                <span className="text-gray-400 line-through ml-1 sm:ml-1.5 text-[8px] sm:text-[10px] md:text-xs">
                                  KSh {item.price.toLocaleString()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 ${
                                      star <= Math.floor(itemRating)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : star - 0.5 <= itemRating
                                          ? "fill-yellow-400/50 text-yellow-400"
                                          : "fill-gray-200 text-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  )
                })}
              </div>

              {/* Show More Button - Same as product-grid.tsx with loading state */}
              {exploreHasMore && (
                <div className="flex justify-center py-6 sm:py-8 bg-white border-t border-gray-100">
                  <button
                    onClick={fetchMoreExploreProducts}
                    disabled={exploreLoading}
                    className="relative flex items-center justify-center px-12 sm:px-16 py-2.5 sm:py-3 bg-white text-gray-600 font-medium rounded-full border border-gray-300 hover:border-gray-400 hover:text-gray-800 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed min-w-[180px] sm:min-w-[200px] tracking-widest uppercase text-xs sm:text-sm"
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
          </motion.div>
        )}
      </div>

      {/* Image Zoom Modal */}
      <ImageZoomModal
        product={product}
        isOpen={isImageZoomModalOpen}
        onClose={() => setIsImageZoomModalOpen(false)}
        selectedImageIndex={zoomSelectedImage}
      />
    </div>
  )
}
