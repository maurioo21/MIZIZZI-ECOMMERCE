// Exact types for the backend /api/products/:id endpoint response
// Represents the complete product details payload with all nested structures

export interface ProductPricing {
  original_price: number
  current_price: number
  sale_price: number | null
  discount_percentage: number
}

export interface ProductStock {
  quantity: number
  is_in_stock: boolean
  is_low_stock: boolean
  stock_status: "in_stock" | "low_stock" | "out_of_stock"
  last_updated: string | null
}

export interface ProductRating {
  average: number
  total_reviews: number
  distribution: {
    five: number
    four: number
    three: number
    two: number
    one: number
  }
}

export interface ProductImageUrls {
  thumbnail: string
  medium: string
  large: string
  original: string
}

export interface ProductImage {
  id: string
  product_id: string
  filename: string
  is_primary: boolean
  sort_order: number
  urls: ProductImageUrls
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string
  color?: string
  size?: string
  price: number
  stock: number
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface ProductBrand {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

export interface ProductCategory {
  id: string
  name: string
  slug: string
  parent_id: string | null
}

export interface Review {
  id: string
  product_id: string
  user_id: string
  user_name: string
  rating: number
  title: string
  content: string
  verified_purchase: boolean
  helpful_count: number
  created_at: string
  updated_at: string
}

export interface ProductTimestamps {
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface ProductDetails {
  id: string
  name: string
  slug: string
  sku: string
  description: string
  short_description: string | null
  brand: ProductBrand
  category: ProductCategory
  pricing: ProductPricing
  stock: ProductStock
  ratings: ProductRating
  images: ProductImage[]
  reviews: Review[]
  variants: ProductVariant[]
  timestamps: ProductTimestamps
  is_featured: boolean
  is_new: boolean
  is_sale: boolean
  is_flash_sale: boolean
  is_luxury_deal: boolean
  is_trending: boolean
  is_top_pick: boolean
  is_daily_find: boolean
  is_new_arrival: boolean
  badge_text: string | null
  badge_color: string | null
  specifications: Record<string, string> | null
  warranty_info: string | null
  shipping_info: string | null
  weight: number | null
  dimensions: { length: number; width: number; height: number } | null
  video_url: string | null
  condition: "new" | "used" | "refurbished" | null
  is_preorder: boolean
  preorder_release_date: string | null
  preorder_message: string | null
}

export interface ProductDetailsResponse {
  success: boolean
  data: ProductDetails
  _cache?: {
    cache_key: string
    cached_at: string
    expires_at: string
    ttl_seconds: number
  }
}

// Helpers to safely extract nested data
export const getProductDisplayPrice = (product: ProductDetails): number => {
  return product?.pricing?.current_price || product?.pricing?.original_price || 0
}

export const getProductOriginalPrice = (product: ProductDetails): number => {
  return product?.pricing?.original_price || 0
}

export const getProductDiscount = (product: ProductDetails): number => {
  return product?.pricing?.discount_percentage || 0
}

export const getProductStock = (product: ProductDetails): number => {
  return product?.stock?.quantity || 0
}

export const isProductInStock = (product: ProductDetails): boolean => {
  return product?.stock?.is_in_stock || false
}

export const getProductRating = (product: ProductDetails): number => {
  return product?.ratings?.average || 0
}

export const getProductReviewCount = (product: ProductDetails): number => {
  return product?.ratings?.total_reviews || 0
}

export const getPrimaryImage = (product: ProductDetails): ProductImage | null => {
  if (!product?.images || product.images.length === 0) return null
  return product.images.find((img) => img.is_primary) || product.images[0] || null
}

export const getGalleryImages = (product: ProductDetails): ProductImage[] => {
  return product?.images || []
}
