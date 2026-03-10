"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useCart } from "@/contexts/cart/cart-context"
import { formatPrice } from "@/lib/utils"
import { WishlistButton } from "./wishlist-button"
import { useToast } from "@/components/ui/use-toast"
import { EnhancedImage } from "@/components/shared/enhanced-image"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

interface ProductCardProps {
  product: {
    id: number
    name: string
    slug: string
    price: number
    sale_price?: number | null
    image_urls: string[]
    thumbnail_url?: string
    category_id?: string
    category?: { name: string }
    stock?: number
    is_new?: boolean
    is_sale?: boolean
    is_featured?: boolean
    rating?: number
    review_count?: number
    seller?: {
      name?: string
      rating?: number
      verified?: boolean
    }
    is_flash_sale?: boolean
    is_luxury_deal?: boolean
    badge_text?: string
    badge_color?: string
  }
  variant?: "default" | "compact" | "featured"
  className?: string
}

const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function getValidImageUrls(imageUrls: string[] | undefined): string[] {
  if (!imageUrls || !Array.isArray(imageUrls)) return []
  return imageUrls.filter((url) => {
    if (typeof url !== "string") return false
    // Filter out blob URLs (temporary browser URLs)
    if (url.startsWith("blob:")) return false
    // Only allow http/https URLs or relative paths
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")
  })
}

function getFirstValidImage(product: ProductCardProps["product"]): string {
  const validUrls = getValidImageUrls(product.image_urls)

  // Try valid image_urls first
  if (validUrls.length > 0) {
    return validUrls[0]
  }

  // Try thumbnail_url if it's not a blob URL
  if (product.thumbnail_url && !product.thumbnail_url.startsWith("blob:")) {
    return product.thumbnail_url
  }

  // Fallback to placeholder
  return "/placeholder.svg"
}

export function ProductCard({ product, variant = "default", className = "" }: ProductCardProps) {
  const { addToCart } = useCart()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set())
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const { items: cartItems } = useCart()
  const { toast } = useToast()
  const isMobile = useMediaQuery("(max-width: 768px)")

  const validImages = getValidImageUrls(product.image_urls)
  const primaryImage = getFirstValidImage(product)
  const hasMultipleImages = validImages.length > 1
  
  // Determine which image to display
  const displayImage = isHovering && hasMultipleImages && validImages[1] ? validImages[1] : primaryImage
  
  // Preload secondary image on mount for desktop
  useEffect(() => {
    if (!isMobile && hasMultipleImages && validImages[1]) {
      const img = new window.Image()
      img.src = validImages[1]
      img.onload = () => {
        setPreloadedImages((prev) => new Set([...prev, validImages[1]]))
      }
    }
  }, [validImages, hasMultipleImages, isMobile])

  // Calculate discount percentage
  const discountPercentage =
    product.sale_price && product.price > product.sale_price
      ? Math.round(((product.price - product.sale_price) / product.price) * 100)
      : 0

  // Handle adding to cart with improved UX
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Check if product is already in cart
    const isInCart = cartItems.some(
      (item) => item.product_id !== null && item.product_id !== undefined && item.product_id === product.id,
    )

    setIsAddingToCart(true)
    try {
      if (isInCart) {
        toast({
          title: "Already in Cart",
          description: (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                <img
                  src={primaryImage || "/placeholder.svg"}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{product.name}</p>
                <p className="text-sm text-muted-foreground">This item is already in your cart</p>
              </div>
            </div>
          ),
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                document.dispatchEvent(new CustomEvent("open-sidebar-cart"))
              }}
              className="border-cherry-200 hover:bg-cherry-50 hover:text-cherry-700"
            >
              View Cart
            </Button>
          ),
          className: "animate-in slide-in-from-bottom-5 duration-300",
          variant: "default",
          duration: 4000,
        })
      } else {
        const result = await addToCart(product.id, 1)
        if (result?.success) {
          // Toast is now handled by the CartIndicator component
        }
      }
    } catch (error) {
      console.error("Failed to add product to cart:", error)
      toast({
        title: "Error",
        description: "Failed to add product to cart. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingToCart(false)
    }
  }

  const handleImageHover = () => {
    if (!isMobile && hasMultipleImages) {
      setIsHovering(true)
    }
  }

  const handleImageLeave = () => {
    setIsHovering(false)
  }

  // Star rating component
  const StarRating = ({ rating = 0 }) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-3 w-3 ${star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 fill-gray-300"}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        ))}
        {product.review_count && <span className="ml-1 text-xs text-muted-foreground">({product.review_count})</span>}
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <motion.div initial="hidden" animate="visible" variants={variants} className={`group ${className}`}>
        <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-cherry-50 transition-colors border border-transparent hover:border-cherry-100">
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
            <Image
              src={primaryImage || "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium line-clamp-1 group-hover:text-cherry-700">{product.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              {product.sale_price ? (
                <>
                  <span className="text-sm font-bold text-cherry-700">{formatPrice(product.sale_price)}</span>
                  <span className="text-xs line-through text-gray-400">{formatPrice(product.price)}</span>
                </>
              ) : (
                <span className="text-sm font-medium">{formatPrice(product.price)}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (variant === "featured") {
    return (
      <motion.div initial="hidden" animate="visible" variants={variants} className={`group ${className}`}>
        <Card className="overflow-hidden border-cherry-100 hover:shadow-lg transition-all duration-300 h-full">
          <div className="relative aspect-[4/5] bg-white overflow-hidden">
            <Image
              src={displayImage}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-all duration-500 ease-in-out"
              quality={90}
              priority={false}
              onMouseEnter={handleImageHover}
              onMouseLeave={handleImageLeave}
            />

            {/* Image Count Indicator */}
            {hasMultipleImages && !isMobile && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm">
                {isHovering ? "2" : "1"}/{validImages.length}
              </div>
            )}

            {/* Badges */}
            <div className="absolute left-3 top-3 flex flex-col gap-1 z-10">
              {discountPercentage > 0 && (
                <Badge className="bg-cherry-600 text-white border-0 px-2 py-1 rounded-md">-{discountPercentage}%</Badge>
              )}
              {product.is_new && <Badge className="bg-emerald-600 text-white border-0 px-2 py-1 rounded-md">NEW</Badge>}
              {product.is_featured && (
                <Badge className="bg-purple-600 text-white border-0 px-2 py-1 rounded-md">FEATURED</Badge>
              )}
            </div>

            {/* Gradient Overlay on Hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <div className="w-full">
                <h3 className="text-white font-semibold line-clamp-1 text-lg mb-1">{product.name}</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    {product.sale_price ? (
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{formatPrice(product.sale_price)}</span>
                        <span className="text-white/70 line-through text-sm">{formatPrice(product.price)}</span>
                      </div>
                    ) : (
                      <span className="text-white font-bold">{formatPrice(product.price)}</span>
                    )}
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-white text-cherry-800 hover:bg-cherry-50"
                    onClick={handleAddToCart}
                    disabled={isAddingToCart || product.stock === 0}
                  >
                    {isAddingToCart ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : product.stock === 0 ? (
                      "Out of Stock"
                    ) : (
                      "Add to Cart"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    )
  }

  // Default variant - redesigned for better visual appeal
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={`group ${className}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 h-full bg-white rounded-lg">
        <div className="relative">
          <Link href={`/product/${product.slug || product.id}`} className="block">
            <div
              ref={imageContainerRef}
              className="relative aspect-square overflow-hidden bg-gray-50"
              onMouseEnter={handleImageHover}
              onMouseLeave={handleImageLeave}
            >
              {/* Primary Image with smooth fade transition */}
              <Image
                src={displayImage}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={cn(
                  "w-full h-full object-cover transition-all duration-500 ease-in-out",
                  isHovering && hasMultipleImages ? "opacity-100" : "opacity-100",
                  "group-hover:scale-105",
                )}
                quality={90}
                priority={false}
              />

              {/* Image Count Indicator - only show if multiple images and clean */}
              {hasMultipleImages && !isMobile && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm">
                  {isHovering ? "2" : "1"}/{validImages.length}
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {product.is_new && (
                  <span className="inline-block bg-green-500 px-2 py-1 text-xs font-bold text-white rounded">New</span>
                )}
                {discountPercentage > 0 && (
                  <span className="inline-block bg-orange-500 px-2 py-1 text-xs font-bold text-white rounded">
                    -{discountPercentage}%
                  </span>
                )}
                {product.is_featured && (
                  <span className="inline-block bg-purple-500 px-2 py-1 text-xs font-bold text-white rounded">
                    Featured
                  </span>
                )}
                {product.is_luxury_deal && (
                  <span className="inline-block bg-amber-600 px-2 py-1 text-xs font-bold text-white rounded">
                    Luxury
                  </span>
                )}
                {product.is_flash_sale && (
                  <span className="inline-block bg-red-600 px-2 py-1 text-xs font-bold text-white rounded">
                    Flash Sale
                  </span>
                )}
                {product.badge_text && (
                  <span
                    className={cn(
                      "inline-block px-2 py-1 text-xs font-bold text-white rounded",
                      product.badge_color || "bg-gray-900",
                    )}
                  >
                    {product.badge_text}
                  </span>
                )}
              </div>

              {/* Wishlist Button */}
              <WishlistButton
                productId={product.id}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-sm"
              />
            </div>
          </Link>

          {/* Product Info */}
          <div className="p-3">
            {(product.category?.name || product.category_id) && (
              <div className="mb-2">
                <span className="text-xs text-gray-500 uppercase">
                  {product.category?.name || product.category_id || "Uncategorized"}
                </span>
              </div>
            )}

            <Link href={`/product/${product.slug || product.id}`} className="block">
              <h3 className="line-clamp-2 h-10 text-sm font-normal leading-tight text-gray-900 group-hover:text-gray-700 transition-colors">
                {product.name}
              </h3>

              {product.rating && (
                <div className="mt-2">
                  <StarRating rating={product.rating || 0} />
                </div>
              )}

              <div className="mt-2">
                {product.sale_price ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">{formatPrice(product.sale_price)}</span>
                    <span className="text-sm line-through text-gray-500">{formatPrice(product.price)}</span>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-gray-900">{formatPrice(product.price)}</span>
                )}
              </div>
            </Link>

            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full font-medium border-gray-200 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-colors bg-transparent"
                onClick={handleAddToCart}
                disabled={isAddingToCart || product.stock === 0}
              >
                {isAddingToCart ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...
                  </div>
                ) : product.stock === 0 ? (
                  <span className="text-muted-foreground">Out of Stock</span>
                ) : cartItems.some((item) =>
                    item.product_id !== null && item.product_id !== undefined ? item.product_id === product.id : false,
                  ) ? (
                  <div className="flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 mr-2" /> View in Cart
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
