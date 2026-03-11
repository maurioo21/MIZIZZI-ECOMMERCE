"use client"

import { useState, useCallback, useMemo } from "react"
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
import { cloudinaryService } from "@/services/cloudinary-service"
import { ImageZoomModal } from "./image-zoom-modal"

interface ProductDetailsEnhancedProps {
  product: any
  similarProducts?: any[]
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
    transition: { duration: 0.35, ease: [0.2, 0, 0.2, 1] },
  },
  slideUp: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.175, 0.885, 0.32, 1.08] },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

function getInitialInventory(product: any): InventoryState {
  // Backend returns stock.quantity or stock_quantity
  const stockQuantity = product?.stock?.quantity || product?.stock_quantity || product?.stock || 0
  const stock = Number(stockQuantity)
  const isInStock = product?.stock?.is_in_stock ?? product?.is_in_stock ?? stock > 0
  
  return {
    available_quantity: stock,
    is_in_stock: isInStock,
    is_low_stock: isInStock && stock > 0 && stock <= 5,
    stock_status: !isInStock ? "out_of_stock" : stock <= 5 ? "low_stock" : "in_stock",
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

function getProductImageUrl(product: any, index = 0, highQuality = false): string {
  if (!highQuality && product?.thumbnail_url && typeof product.thumbnail_url === "string" && !product.thumbnail_url.startsWith("blob:")) {
    return product.thumbnail_url
  }

  const images = product?.image_urls || product?.images || []
  if (Array.isArray(images) && images.length > index && typeof images[index] === "string") {
    return images[index]
  }

  return "/generic-product-display.png"
}

export default function ProductDetailsEnhanced({ product, similarProducts = [] }: ProductDetailsEnhancedProps) {
  const { addItem, items } = useCart()
  const { addItem: addToWishlist, removeItem: removeFromWishlist, items: wishlistItems } = useWishlist()
  const { toast } = useToast()
  
  const [zoomModalOpen, setZoomModalOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  const productId = String(product?.id || "")
  const isInWishlist = wishlistItems.some((item: any) => String(item.id) === productId)
  const inventory = useMemo(() => getInitialInventory(product), [product])

  const images = useMemo(() => {
    if (Array.isArray(product?.images)) return product.images
    if (Array.isArray(product?.image_urls)) return product.image_urls
    return []
  }, [product?.images, product?.image_urls])

  const primaryImage = useMemo(() => getProductImageUrl(product, selectedImageIndex, true), [product, selectedImageIndex])

  const currentPrice = product?.pricing?.current_price || product?.sale_price || product?.price || 0
  const originalPrice = product?.pricing?.original_price || product?.price || 0
  const discountPercent = originalPrice > currentPrice && currentPrice > 0 ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0
  const rating = getSafeRating(product?.ratings?.average || product?.rating || product?.average_rating, 4)
  const reviewCount = product?.ratings?.total_reviews || product?.review_count || product?.reviews?.length || 0

  const handleAddToCart = useCallback(async () => {
    if (!product?.id) return
    setIsAddingToCart(true)
    try {
      addItem({ ...product, quantity })
      toast({ title: "Added to cart", description: `${product.name} added successfully` })
      setQuantity(1)
    } catch (error) {
      toast({ title: "Error", description: "Failed to add to cart", variant: "destructive" })
    } finally {
      setIsAddingToCart(false)
    }
  }, [product, quantity, addItem, toast])

  const handleToggleWishlist = useCallback(() => {
    if (isInWishlist) {
      removeFromWishlist(productId)
      toast({ title: "Removed from wishlist" })
    } else {
      addToWishlist(product)
      toast({ title: "Added to wishlist" })
    }
  }, [isInWishlist, productId, product, addToWishlist, removeFromWishlist, toast])

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: product?.name || "Product",
        text: product?.short_description || "Check out this product",
        url: typeof window !== "undefined" ? window.location.href : "",
      })
    } else {
      toast({ title: "Copy link", description: "Share link copied to clipboard" })
      navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "")
    }
  }, [product?.name, product?.short_description, toast])

  const handleWhatsAppClick = useCallback(() => {
    const message = `Hi, I'm interested in ${product?.name} priced at ${formatPrice(currentPrice)}. Can you help me with more details?`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }, [product?.name, currentPrice])

  if (!product) return <div className="text-center py-12">Product not found</div>

  return (
    <motion.main className="min-h-screen bg-white" variants={motionVariants.fadeIn} initial="initial" animate="animate">
      {/* Breadcrumb */}
      <div className="border-b px-4 py-3 flex items-center gap-2 text-sm text-gray-600">
        <Link href="/" className="flex items-center gap-1 hover:text-brand-dark">
          <Home size={16} />
          <span>Home</span>
        </Link>
        <ChevronRight size={16} />
        <span className="text-gray-900 font-medium truncate">{product?.name}</span>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Images Section */}
          <motion.div variants={motionVariants.slideUp}>
            <div className="space-y-4">
              <div
                className="bg-gray-100 rounded-lg overflow-hidden cursor-pointer relative group"
                onClick={() => setZoomModalOpen(true)}
              >
                <Image
                  src={safeCloudinaryUrl(primaryImage)}
                  alt={product?.name || "Product"}
                  width={500}
                  height={500}
                  className="w-full h-auto"
                  priority
                />
                <div className="absolute top-4 right-4 bg-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition">
                  <Maximize2 size={20} className="text-gray-700" />
                </div>
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={cn(
                        "rounded-lg overflow-hidden border-2 transition-all",
                        selectedImageIndex === idx ? "border-brand" : "border-gray-200"
                      )}
                    >
                      <Image
                        src={safeCloudinaryUrl(typeof img === "string" ? img : img?.url)}
                        alt={`Thumbnail ${idx + 1}`}
                        width={100}
                        height={100}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Product Info Section */}
          <motion.div className="space-y-6" variants={motionVariants.slideUp}>
            {/* Title & Rating */}
            <div>
              <h1 className="text-3xl font-bold mb-2">{product?.name}</h1>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">({reviewCount} reviews)</span>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-brand">{formatPrice(currentPrice)}</span>
                {discountPercent > 0 && (
                  <>
                    <span className="text-xl text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                    <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-medium">{discountPercent}% OFF</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">{product?.short_description}</p>
            </div>

            {/* Stock Status */}
            <div className={cn("p-3 rounded-lg flex items-center gap-2", inventory.is_in_stock ? "bg-green-50" : "bg-red-50")}>
              {inventory.is_in_stock ? (
                <>
                  <CheckCircle size={18} className="text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {inventory.is_low_stock ? `Only ${inventory.available_quantity} left in stock` : "In Stock"}
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={18} className="text-red-600" />
                  <span className="text-sm font-medium text-red-600">Out of Stock</span>
                </>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity === 1}
                    className="p-2 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="px-4 font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(inventory.available_quantity, quantity + 1))}
                    disabled={quantity >= inventory.available_quantity || !inventory.is_in_stock}
                    className="p-2 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!inventory.is_in_stock || isAddingToCart}
                  className="bg-brand hover:bg-brand-hover disabled:bg-gray-300 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition"
                >
                  <ShoppingCart size={18} />
                  {isAddingToCart ? "Adding..." : "Add to Cart"}
                </button>

                <button
                  onClick={handleToggleWishlist}
                  className={cn(
                    "border-2 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition",
                    isInWishlist ? "border-red-500 bg-red-50 text-red-500" : "border-gray-300 hover:border-gray-400"
                  )}
                >
                  <Heart size={18} fill={isInWishlist ? "currentColor" : "none"} />
                  {isInWishlist ? "Saved" : "Save"}
                </button>
              </div>
            </div>

            {/* More Actions */}
            <div className="grid grid-cols-2 gap-2 pt-4 border-t">
              <button
                onClick={handleWhatsAppClick}
                className="py-2 px-4 flex items-center justify-center gap-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
              >
                <FaWhatsapp size={16} />
                <span className="text-sm font-medium">WhatsApp</span>
              </button>

              <button
                onClick={handleShare}
                className="py-2 px-4 flex items-center justify-center gap-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                <Share2 size={16} />
                <span className="text-sm font-medium">Share</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Description */}
        {product?.description && (
          <motion.div variants={motionVariants.slideUp} className="bg-gray-50 p-6 rounded-lg mb-12">
            <h2 className="text-xl font-bold mb-4">Product Details</h2>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
            />
          </motion.div>
        )}

        {/* Info Cards */}
        <motion.div variants={motionVariants.slideUp} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div className="border rounded-lg p-4 text-center">
            <Truck className="mx-auto mb-2 text-brand" size={24} />
            <p className="text-sm font-medium">Free Shipping</p>
            <p className="text-xs text-gray-600">On orders over $50</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <RotateCcw className="mx-auto mb-2 text-brand" size={24} />
            <p className="text-sm font-medium">Easy Returns</p>
            <p className="text-xs text-gray-600">30-day return policy</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <ShieldCheck className="mx-auto mb-2 text-brand" size={24} />
            <p className="text-sm font-medium">Secure Payment</p>
            <p className="text-xs text-gray-600">100% secure checkout</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <Award className="mx-auto mb-2 text-brand" size={24} />
            <p className="text-sm font-medium">Quality Guarantee</p>
            <p className="text-xs text-gray-600">2-year warranty</p>
          </div>
        </motion.div>

        {/* Image Zoom Modal */}
        <ImageZoomModal open={zoomModalOpen} onOpenChange={setZoomModalOpen} images={images.map((img: any) => safeCloudinaryUrl(typeof img === "string" ? img : img?.url))} initialIndex={selectedImageIndex} />
      </div>
    </motion.main>
  )
}
