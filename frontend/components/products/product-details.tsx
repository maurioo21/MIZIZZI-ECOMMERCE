"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Heart,
  Share2,
  Star,
  Minus,
  Plus,
  ShoppingCart,
  Truck,
  RotateCcw,
  Shield,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"

import { useCart } from "@/contexts/cart/cart-context"
import { useWishlist } from "@/contexts/wishlist/wishlist-context"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice, cn } from "@/lib/utils"
import { productService } from "@/services/product"
import type { ProductDetails, ProductImage as BackendProductImage } from "@/types/product-details"
import {
  getProductDisplayPrice,
  getProductOriginalPrice,
  getProductDiscount,
  getProductStock,
  isProductInStock,
  getProductRating,
  getProductReviewCount,
  getPrimaryImage,
  getGalleryImages,
} from "@/types/product-details"

interface ProductDetailsProps {
  productId: string | number
}

export function ProductDetails({ productId }: ProductDetailsProps) {
  const { addToCart } = useCart()
  const { toggleWishlist, isInWishlist } = useWishlist()
  const { toast } = useToast()

  // State
  const [product, setProduct] = useState<ProductDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch product details on mount or when ID changes
  useEffect(() => {
    abortControllerRef.current = new AbortController()
    const controller = abortControllerRef.current

    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await productService.getProductDetails(productId)

        // Only update state if request wasn't aborted
        if (!controller.signal.aborted) {
          if (!data) {
            setError("Product not found")
            setProduct(null)
          } else {
            setProduct(data)
            setQuantity(1)
            setSelectedVariant(null)
            setCurrentImageIndex(0)
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error loading product:", err)
          setError("Failed to load product details")
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchProduct()

    // Cleanup: abort request if component unmounts
    return () => {
      controller.abort()
    }
  }, [productId])

  // Derived values (memoized to prevent unnecessary re-renders)
  const displayPrice = useMemo(() => {
    if (!product) return 0
    return getProductDisplayPrice(product)
  }, [product])

  const originalPrice = useMemo(() => {
    if (!product) return 0
    return getProductOriginalPrice(product)
  }, [product])

  const discountPercent = useMemo(() => {
    if (!product) return 0
    return getProductDiscount(product)
  }, [product])

  const stockQuantity = useMemo(() => {
    if (!product) return 0
    return getProductStock(product)
  }, [product])

  const inStock = useMemo(() => {
    if (!product) return false
    return isProductInStock(product)
  }, [product])

  const rating = useMemo(() => {
    if (!product) return 0
    return getProductRating(product)
  }, [product])

  const reviewCount = useMemo(() => {
    if (!product) return 0
    return getProductReviewCount(product)
  }, [product])

  const primaryImage = useMemo(() => {
    if (!product) return null
    return getPrimaryImage(product)
  }, [product])

  const galleryImages = useMemo(() => {
    if (!product) return []
    return getGalleryImages(product)
  }, [product])

  const currentImage = useMemo(() => {
    if (!galleryImages || galleryImages.length === 0) return null
    return galleryImages[currentImageIndex] || galleryImages[0]
  }, [galleryImages, currentImageIndex])

  // Event handlers
  const handleAddToCart = useCallback(() => {
    if (!product || !inStock) {
      toast({ description: "Product not available", variant: "destructive" })
      return
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: displayPrice,
      quantity,
      image: primaryImage?.urls?.thumbnail || "/placeholder.svg",
      variant: selectedVariant,
    })

    toast({ description: `${product.name} added to cart` })
    setQuantity(1)
  }, [product, inStock, quantity, selectedVariant, displayPrice, primaryImage, toast, addToCart])

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(prev + delta, Math.max(1, stockQuantity))))
  }, [stockQuantity])

  const handleWishlist = useCallback(() => {
    if (!product) return
    toggleWishlist({
      id: product.id,
      name: product.name,
      price: displayPrice,
      image: primaryImage?.urls?.thumbnail || "/placeholder.svg",
    })
  }, [product, displayPrice, primaryImage, toggleWishlist])

  const handleShare = useCallback(async () => {
    if (!product) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.short_description || product.name,
          url: window.location.href,
        })
      } catch (err) {
        console.error("Share failed:", err)
      }
    } else {
      toast({ description: "Share not supported on this browser" })
    }
  }, [product, toast])

  const handleWhatsApp = useCallback(() => {
    if (!product) return
    const message = `Hi, I'm interested in ${product.name}. Price: ${formatPrice(displayPrice)}. Link: ${window.location.href}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }, [product, displayPrice])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div>
      </div>
    )
  }

  // Error state
  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg font-semibold">{error || "Product not found"}</p>
        <Link href="/products" className="mt-4 text-blue-600 hover:underline">
          Back to products
        </Link>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl mx-auto px-4 py-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          {currentImage && (
            <motion.div
              key={currentImage.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
            >
              <Image
                src={currentImage.urls.large || currentImage.urls.original}
                alt={product.name}
                fill
                className="object-contain"
                priority
              />
              {discountPercent > 0 && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full font-semibold">
                  -{discountPercent}%
                </div>
              )}
            </motion.div>
          )}

          {/* Thumbnail Gallery */}
          {galleryImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {galleryImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={cn(
                    "relative aspect-square bg-gray-100 rounded border-2 overflow-hidden",
                    currentImageIndex === idx ? "border-brand" : "border-transparent"
                  )}
                >
                  <Image
                    src={img.urls.thumbnail}
                    alt={`Product ${idx + 1}`}
                    fill
                    className="object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn("w-4 h-4", i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300")}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">{reviewCount} reviews</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-brand">{formatPrice(displayPrice)}</span>
              {originalPrice > displayPrice && (
                <span className="text-lg text-gray-500 line-through">{formatPrice(originalPrice)}</span>
              )}
            </div>
            {discountPercent > 0 && (
              <span className="text-sm text-green-600 font-semibold">Save {discountPercent}%</span>
            )}
          </div>

          {/* Stock Status */}
          <div className="flex items-center gap-2">
            {inStock ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium">In Stock ({stockQuantity} available)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium">Out of Stock</span>
              </>
            )}
          </div>

          {/* Description */}
          {product.short_description && (
            <p className="text-gray-600">{product.short_description}</p>
          )}

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Variant</label>
              <select
                value={selectedVariant || ""}
                onChange={(e) => setSelectedVariant(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select variant</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({formatPrice(v.price)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity & Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Quantity:</label>
              <div className="flex items-center gap-2 border rounded">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  className="p-1 hover:bg-gray-100"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center">{quantity}</span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  className="p-1 hover:bg-gray-100"
                  disabled={quantity >= stockQuantity}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!inStock}
                className={cn(
                  "flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2",
                  inStock
                    ? "bg-brand text-white hover:bg-brand/90"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                )}
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>

              <button
                onClick={handleWishlist}
                className={cn(
                  "px-4 py-3 rounded-lg border-2",
                  isInWishlist(product.id) ? "bg-red-50 border-red-300" : "border-gray-300"
                )}
              >
                <Heart
                  className={cn(
                    "w-5 h-5",
                    isInWishlist(product.id) ? "fill-red-500 text-red-500" : "text-gray-600"
                  )}
                />
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleWhatsApp}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-600"
              >
                <FaWhatsapp className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <div className="flex items-start gap-2">
              <Truck className="w-5 h-5 text-brand mt-0.5" />
              <div>
                <p className="text-sm font-medium">Fast Delivery</p>
                <p className="text-xs text-gray-600">2-3 business days</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="w-5 h-5 text-brand mt-0.5" />
              <div>
                <p className="text-sm font-medium">Easy Returns</p>
                <p className="text-xs text-gray-600">30-day guarantee</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-brand mt-0.5" />
              <div>
                <p className="text-sm font-medium">Secure Payment</p>
                <p className="text-xs text-gray-600">100% protected</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Description */}
      {product.description && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 space-y-4"
        >
          <h2 className="text-2xl font-bold">Product Details</h2>
          <div className="prose max-w-none">
            {product.description.split("\n").map((paragraph, idx) => (
              <p key={idx} className="text-gray-700 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
