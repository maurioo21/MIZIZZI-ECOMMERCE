"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Heart,
  Share2,
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingCart,
  Truck,
  RotateCcw,
  ShieldCheck,
  Star,
  CheckCircle,
  Zap,
  Award,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { useCart } from "@/contexts/cart/cart-context"
import { useWishlist } from "@/contexts/wishlist/wishlist-context"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice, cn } from "@/lib/utils"
import { productService } from "@/services/product"
import { inventoryService } from "@/services/inventory-service"
import { cloudinaryService } from "@/services/cloudinary-service"
import { reviewService, type ReviewSummary } from "@/services/review-service"
import { useAuth } from "@/contexts/auth/auth-context"

interface ProductDetailsMobileProps {
  product: any
}

const PRIMARY_COLOR = "#8B1538"
const PRIMARY_HOVER = "#6B1028"
const ACCENT_COLOR = "#FF6B35"
const SUCCESS_COLOR = "#10B981"

export default function ProductDetailsMobile({ product: initialProduct }: ProductDetailsMobileProps) {
  const { toast } = useToast()
  const { isAuthenticated, user } = useAuth()

  // State
  const [product, setProduct] = useState<any>(initialProduct)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [optimisticWishlistState, setOptimisticWishlistState] = useState<boolean | null>(null)
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false)
  const [showCartNotification, setShowCartNotification] = useState(false)
  const [cartNotificationData, setCartNotificationData] = useState<any>(null)
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null)

  // Inventory state
  const [inventoryData, setInventoryData] = useState<{
    available_quantity: number
    is_in_stock: boolean
    is_low_stock: boolean
    stock_status: "in_stock" | "low_stock" | "out_of_stock"
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
  })

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

  // Product images
  const productImages = useMemo(() => {
    const images: string[] = []
    if (product?.image_urls && Array.isArray(product.image_urls)) {
      product.image_urls.forEach((url: any) => {
        if (typeof url === "string" && url.trim() !== "" && !url.startsWith("blob:")) {
          images.push(
            url.startsWith("http")
              ? url
              : cloudinaryService.generateOptimizedUrl(url, {
                  width: 1024,
                  height: 1024,
                  quality: 85,
                  crop: "fit",
                }),
          )
        }
      })
    }
    return images.length > 0 ? images : ["/generic-product-display.png"]
  }, [product?.image_urls])

  // Rating calculation
  const calculateAverageRating = useCallback(() => {
    if (!reviewSummary) return 0
    return (reviewSummary.average_rating || 0) / 10
  }, [reviewSummary])

  // Load reviews and inventory
  useEffect(() => {
    const loadData = async () => {
      try {
        if (product?.id) {
          const [reviewsData, inventoryUpdate] = await Promise.all([
            reviewService.getProductReviewSummary(product.id),
            inventoryService.getInventoryStats(),
          ])

          if (reviewsData) setReviewSummary(reviewsData)
          if (inventoryUpdate)
            setInventoryData((prev) => ({
              ...prev,
              ...inventoryUpdate,
            }))
        }
      } catch (error) {
        console.error("[v0] Error loading product data:", error)
      }
    }

    loadData()
  }, [product?.id])

  // Handlers
  const handleAddToCart = useCallback(async () => {
    if (!isAuthenticated) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to add items to cart",
        variant: "destructive",
      })
      return
    }

    if (!inventoryData.is_in_stock) {
      toast({
        title: "Out of stock",
        description: "This product is currently unavailable",
        variant: "destructive",
      })
      return
    }

    setIsAddingToCart(true)
    try {
      const cartItem = {
        productId: product.id,
        variantId: selectedVariant?.id || null,
        quantity,
        price: currentPrice,
        name: product.name,
        thumbnail_url: productImages[0],
      }

      addToCart(cartItem)
      setCartNotificationData({ ...product, quantity })
      setShowCartNotification(true)
      setTimeout(() => setShowCartNotification(false), 4000)

      toast({
        title: "Added to cart!",
        description: `${quantity}x ${product.name}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive",
      })
    } finally {
      setIsAddingToCart(false)
    }
  }, [isAuthenticated, inventoryData, selectedVariant, quantity, currentPrice, product, productImages, addToCart, toast])

  const handleBuyViaWhatsApp = useCallback(() => {
    const message = `Hi! I'm interested in buying: ${product.name} (${selectedVariant?.color || ""})\nQuantity: ${quantity}\nPrice: ${formatPrice(currentPrice * quantity)}`
    const whatsappUrl = `https://wa.me/254712345678?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }, [product.name, selectedVariant, quantity, currentPrice])

  const handleToggleWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to use wishlist",
        variant: "destructive",
      })
      return
    }

    setIsTogglingWishlist(true)
    setOptimisticWishlistState(!isProductInWishlist)

    try {
      if (isProductInWishlist) {
        await removeProductFromWishlist(Number(product.id))
      } else {
        await addToWishlist({
          product_id: Number(product.id),
        })
      }
    } catch (error) {
      setOptimisticWishlistState(null)
      toast({
        title: "Error",
        description: "Failed to update wishlist",
        variant: "destructive",
      })
    } finally {
      setIsTogglingWishlist(false)
    }
  }, [isAuthenticated, product.id, isProductInWishlist, addToWishlist, removeProductFromWishlist, toast])

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out this product: ${product.name}`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: "Link copied!",
        description: "Product link copied to clipboard",
      })
    }
  }, [product.name, toast])

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Cart Toast */}
      <AnimatePresence>
        {showCartNotification && cartNotificationData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-4 right-4 z-50"
            role="status"
            aria-live="polite"
          >
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Added to cart</p>
                <p className="text-xs text-gray-500">{quantity} × {product.name}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Gallery - Full Width with Optimal Aspect Ratio */}
      <div className="w-full bg-white">
        <div className="relative w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
          <Image
            src={productImages[selectedImage]}
            alt={product?.name}
            width={600}
            height={600}
            priority
            quality={90}
            className="w-full h-full object-contain"
            sizes="100vw"
          />

          {/* Discount Badge */}
          {discountPercentage > 0 && (
            <div className="absolute top-4 left-4 bg-[#FF6B35] text-white text-xs font-bold px-3 py-1 rounded-full">
              -{discountPercentage}%
            </div>
          )}

          {/* Image Navigation */}
          {productImages.length > 1 && (
            <>
              <button
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 flex items-center justify-center shadow-md hover:bg-white transition-all"
                onClick={() => setSelectedImage((prev) => (prev === 0 ? productImages.length - 1 : prev - 1))}
              >
                <ArrowLeft className="h-4 w-4 text-gray-700" />
              </button>
              <button
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 flex items-center justify-center shadow-md hover:bg-white transition-all"
                onClick={() => setSelectedImage((prev) => (prev === productImages.length - 1 ? 0 : prev + 1))}
              >
                <ArrowRight className="h-4 w-4 text-gray-700" />
              </button>
            </>
          )}

          {/* Image Counter */}
          {productImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
              {selectedImage + 1} / {productImages.length}
            </div>
          )}
        </div>

        {/* Thumbnail Gallery */}
        {productImages.length > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2 overflow-x-auto">
            {productImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(idx)}
                className={cn(
                  "w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all",
                  selectedImage === idx
                    ? "border-[#8B1538] ring-2 ring-[#8B1538]/20"
                    : "border-gray-200 hover:border-gray-300",
                )}
              >
                <Image
                  src={img}
                  alt={`View ${idx + 1}`}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info Section */}
      <div className="px-4 py-4 border-b border-gray-100">
        {/* Badges */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {product?.is_flash_sale && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF6B35]/10 text-[#FF6B35] text-xs font-semibold rounded-full">
              <Zap className="w-3 h-3" />
              Flash Sale
            </span>
          )}
          {product?.is_luxury_deal && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-600 text-xs font-semibold rounded-full">
              <Award className="w-3 h-3" />
              Premium
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-lg font-bold text-gray-900 leading-tight mb-2">{product?.name}</h1>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-3.5 w-3.5",
                  i < Math.floor(calculateAverageRating())
                    ? "fill-amber-400 text-amber-400"
                    : "text-gray-300",
                )}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-gray-900">{calculateAverageRating().toFixed(1)}</span>
          <span className="text-xs text-gray-500">({reviewSummary?.total_reviews || 0})</span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-black text-[#8B1538]">{formatPrice(currentPrice)}</span>
          {currentPrice < originalPrice && (
            <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>
          )}
        </div>

        {/* Stock Status */}
        <div
          className={cn(
            "inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full",
            inventoryData.is_in_stock
              ? inventoryData.is_low_stock
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700",
          )}
        >
          {inventoryData.is_in_stock ? (inventoryData.is_low_stock ? "Limited stock" : "In stock") : "Out of stock"}
        </div>
      </div>

      {/* Key Highlights for Phone Products */}
      <div className="px-4 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Key Features</h3>
        <div className="space-y-2">
          {product?.specs?.slice(0, 3).map((spec: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <div className="w-4 h-4 rounded-full bg-[#8B1538] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{spec.name}</p>
                <p className="text-gray-600">{spec.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Truck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Free Delivery</p>
              <p className="text-xs text-gray-500">Orders over KSh 2,000</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <RotateCcw className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Easy Returns</p>
              <p className="text-xs text-gray-500">14-day return policy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">100% Genuine</p>
              <p className="text-xs text-gray-500">Verified quality products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Variants Section */}
      {product?.variants && product.variants.length > 0 && (
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Options</h3>
          <div className="space-y-3">
            {/* Color Variants */}
            {Array.from(new Set(product.variants.map((v: any) => v.color))).filter(Boolean).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Color</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.from(new Set(product.variants.map((v: any) => v.color))) as string[])
                    .filter(Boolean)
                    .map((color, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const v = product.variants.find((x: any) => x.color === color)
                          if (v) setSelectedVariant(v)
                        }}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg font-medium transition-all",
                          selectedVariant?.color === color
                            ? "bg-[#8B1538] text-white"
                            : "bg-gray-100 text-gray-700",
                        )}
                      >
                        {color}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {/* Storage/Capacity Variants */}
            {Array.from(new Set(product.variants.map((v: any) => v.capacity))).filter(Boolean).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Capacity</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.from(new Set(product.variants.map((v: any) => v.capacity))) as string[])
                    .filter(Boolean)
                    .map((capacity, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const v = product.variants.find((x: any) => x.capacity === capacity)
                          if (v) setSelectedVariant(v)
                        }}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg font-medium transition-all",
                          selectedVariant?.capacity === capacity
                            ? "bg-[#8B1538] text-white"
                            : "bg-gray-100 text-gray-700",
                        )}
                      >
                        {capacity}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-2xl shadow-black/5 z-40">
        <div className="px-4 py-3 max-w-full">
          {/* Quantity and Price Row */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <button
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white rounded-md transition-colors disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-gray-900 w-6 text-center">{quantity}</span>
              <button
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white rounded-md transition-colors disabled:opacity-40"
                onClick={() =>
                  setQuantity((q) => Math.min(inventoryData.available_quantity || 0, q + 1))
                }
                disabled={!inventoryData.is_in_stock || quantity >= (inventoryData.available_quantity || 0)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-[#8B1538]">{formatPrice(currentPrice * quantity)}</div>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <motion.button
              onClick={handleAddToCart}
              disabled={isAddingToCart || !inventoryData.is_in_stock}
              className={cn(
                "flex-1 h-11 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all",
                isAddingToCart || !inventoryData.is_in_stock
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#8B1538] text-white hover:bg-[#6B1028] shadow-lg shadow-[#8B1538]/20",
              )}
              whileTap={inventoryData.is_in_stock ? { scale: 0.98 } : {}}
            >
              {isAddingToCart ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  <span>Add</span>
                </>
              )}
            </motion.button>

            <motion.button
              onClick={handleBuyViaWhatsApp}
              disabled={!inventoryData.is_in_stock}
              className={cn(
                "flex-1 h-11 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all",
                !inventoryData.is_in_stock
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#25D366] text-white hover:bg-[#20bd5a]",
              )}
              whileTap={inventoryData.is_in_stock ? { scale: 0.98 } : {}}
            >
              <FaWhatsapp className="h-4 w-4" />
              <span>WhatsApp</span>
            </motion.button>

            <motion.button
              onClick={handleToggleWishlist}
              disabled={isTogglingWishlist}
              className={cn(
                "w-11 h-11 rounded-lg border-2 flex items-center justify-center transition-all",
                isProductInWishlist
                  ? "border-[#8B1538] bg-[#8B1538]/5 text-[#8B1538]"
                  : "border-gray-200 text-gray-400 hover:border-[#8B1538] hover:text-[#8B1538]",
              )}
              whileTap={{ scale: 0.98 }}
            >
              <Heart className={cn("h-5 w-5", isProductInWishlist && "fill-current")} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
