"use client"
import { useState, useMemo } from "react"
import NextImage from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Heart,
  Share2,
  ChevronRight,
  Star,
  ShoppingCart,
  CreditCard,
  Maximize2,
  CheckCircle,
  XCircle,
  Truck,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { useCart } from "@/contexts/cart/cart-context"
import { useWishlist } from "@/contexts/wishlist/wishlist-context"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice, cn } from "@/lib/utils"
import { ImageZoomModal } from "./image-zoom-modal"

interface ProductDetailsEnhancedProps {
  product: any
  initialReviews?: any[]
  similarProducts?: any[]
}

const PRIMARY_COLOR = "#8B1538"
const PRIMARY_HOVER = "#6B1028"
const ACCENT_COLOR = "#FF6B35"
const SUCCESS_COLOR = "#10B981"

export default function ProductDetailsEnhanced({
  product: initialProduct,
  initialReviews = [],
  similarProducts = [],
}: ProductDetailsEnhancedProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { addItem } = useCart()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()

  // State
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [showImageZoom, setShowImageZoom] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)

  const product = initialProduct

  // Extract images from backend Cloudinary URLs
  const productImages = useMemo(() => {
    if (!product?.images || !Array.isArray(product.images)) {
      return ["/generic-product-display.png"]
    }
    
    return product.images
      .filter((img: any) => img?.urls?.large || img?.urls?.original)
      .map((img: any) => img.urls?.large || img.urls?.original || "")
      .filter((url: string) => url && typeof url === "string")
  }, [product])

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.sale_price || product.price,
      quantity,
      image: productImages[0],
    })
    toast({
      title: "Added to cart",
      description: `${product.name} added successfully`,
    })
  }

  const handleBuyNow = () => {
    handleAddToCart()
    router.push("/checkout")
  }

  const handleWishlist = async () => {
    setIsWishlisted(!isWishlisted)
    if (!isWishlisted) {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: product.sale_price || product.price,
        image: productImages[0],
      })
      toast({ title: "Added to wishlist" })
    } else {
      removeFromWishlist(product.id)
      toast({ title: "Removed from wishlist" })
    }
  }

  const mainImage = productImages[selectedImage] || productImages[0]
  const inStock = product?.stock > 0
  const stockStatus = inStock ? "in_stock" : "out_of_stock"

  return (
    <main className="min-h-screen bg-background">
      {/* Product Section */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Main Image */}
            <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square">
              <NextImage
                src={mainImage}
                alt={product?.name || "Product"}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <button
                onClick={() => setShowImageZoom(true)}
                className="absolute top-4 right-4 bg-white rounded-lg p-2 hover:bg-gray-100"
              >
                <Maximize2 size={20} />
              </button>
            </div>

            {/* Thumbnail Images */}
            {productImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {productImages.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={cn(
                      "flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                      selectedImage === idx
                        ? "border-red-600"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <NextImage
                      src={img}
                      alt={`${product?.name} ${idx + 1}`}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Details Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Title and Rating */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {product?.name}
              </h1>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={18}
                      className={
                        i < Math.round(product?.rating || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  ({product?.reviews_count || 0} reviews)
                </span>
              </div>
            </div>

            {/* Price and Stock */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold" style={{ color: PRIMARY_COLOR }}>
                  {formatPrice(product?.sale_price || product?.price || 0)}
                </span>
                {product?.sale_price && product?.price > product?.sale_price && (
                  <span className="text-xl text-muted-foreground line-through">
                    {formatPrice(product?.price)}
                  </span>
                )}
              </div>

              {/* Stock Status */}
              <div className="flex items-center gap-2">
                {inStock ? (
                  <>
                    <CheckCircle size={18} className="text-green-600" />
                    <span className="text-sm font-medium text-green-600">
                      {product?.stock} in stock
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={18} className="text-red-600" />
                    <span className="text-sm font-medium text-red-600">
                      Out of stock
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quantity and Actions */}
            <div className="space-y-4">
              {/* Quantity Selector */}
              {inStock && (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Quantity:</span>
                  <div className="flex items-center border rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="px-4 py-2 font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-2 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="py-3 px-4 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: inStock ? PRIMARY_COLOR : "#ccc",
                    cursor: inStock ? "pointer" : "not-allowed",
                  }}
                >
                  <ShoppingCart size={18} />
                  Add to Cart
                </button>
                <button
                  onClick={handleWishlist}
                  className="py-3 px-4 rounded-lg font-semibold border-2 transition-all flex items-center justify-center gap-2"
                  style={{
                    borderColor: isWishlisted ? PRIMARY_COLOR : "#ddd",
                    color: isWishlisted ? PRIMARY_COLOR : "#666",
                    backgroundColor: isWishlisted ? `${PRIMARY_COLOR}15` : "transparent",
                  }}
                >
                  <Heart size={18} fill={isWishlisted ? PRIMARY_COLOR : "none"} />
                </button>
              </div>

              <button
                onClick={handleBuyNow}
                disabled={!inStock}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor: inStock ? ACCENT_COLOR : "#ccc",
                  cursor: inStock ? "pointer" : "not-allowed",
                }}
              >
                <CreditCard size={18} />
                Buy Now
              </button>
            </div>

            {/* Seller Info */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Sold by</p>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-primary rounded-full" />
                <div>
                  <p className="font-medium text-sm">{product?.seller_name || "Mizizzi Store"}</p>
                  <p className="text-xs text-muted-foreground">Official Retailer</p>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t">
              <div className="text-center">
                <Truck className="mx-auto mb-2 text-primary" size={20} />
                <p className="text-xs font-medium">Free Delivery</p>
                <p className="text-xs text-muted-foreground">Orders over 2000</p>
              </div>
              <div className="text-center">
                <RotateCcw className="mx-auto mb-2 text-primary" size={20} />
                <p className="text-xs font-medium">Easy Returns</p>
                <p className="text-xs text-muted-foreground">14-day policy</p>
              </div>
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2 text-primary" size={20} />
                <p className="text-xs font-medium">100% Genuine</p>
                <p className="text-xs text-muted-foreground">Verified products</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Product Description */}
        {product?.description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-16 border-t pt-12"
          >
            <h2 className="text-2xl font-bold mb-6">Product Description</h2>
            <div
              className="prose max-w-none text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </motion.div>
        )}

        {/* Similar Products */}
        {similarProducts && similarProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-16 border-t pt-12"
          >
            <h2 className="text-2xl font-bold mb-8">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similarProducts.slice(0, 8).map((prod: any) => (
                <Link
                  key={prod.id}
                  href={`/product/${prod.slug || prod.id}`}
                  className="group bg-white rounded-lg overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    <NextImage
                      src={
                        prod.images?.[0]?.urls?.large ||
                        prod.images?.[0]?.urls?.original ||
                        "/generic-product-display.png"
                      }
                      alt={prod.name}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium line-clamp-2">{prod.name}</p>
                    <p className="text-sm font-bold text-primary mt-2">
                      {formatPrice(prod.sale_price || prod.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {showImageZoom && (
          <ImageZoomModal
            images={productImages}
            initialIndex={selectedImage}
            onClose={() => setShowImageZoom(false)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
