/**
 * Product Details Types - Frontend models for new backend API response
 * Matches the backend structure for /api/product-details/:id endpoint
 */

export interface ProductImageUrls {
  original: string
  large: string
  medium: string
  thumbnail: string
}

export interface ProductImage {
  id: number
  alt_text: string
  cloudinary_public_id: string | null
  display_order: number
  is_primary: boolean
  urls: ProductImageUrls
}

export interface ProductPricing {
  currency: string
  current_price: number
  discount_percentage: number
  original_price: number
  sale_price: number
}

export interface ProductStock {
  is_in_stock: boolean
  quantity: number
  stock_status: "in_stock" | "low_stock" | "out_of_stock"
}

export interface RatingDistribution {
  "1_star": number
  "2_star": number
  "3_star": number
  "4_star": number
  "5_star": number
}

export interface ProductRatings {
  average: number
  distribution: RatingDistribution
  total_reviews: number
}

export interface ProductReview {
  id: number
  rating: number
  title: string
  comment: string
  author: string
  created_at: string
}

export interface ProductBrand {
  id: number
  name: string
  slug: string
}

export interface ProductCategory {
  id: number
  name: string
  slug: string
}

export interface ProductVariant {
  id: number
  name: string
  value: string
  sku: string
  price: number
  stock: number
}

export interface ProductTimestamps {
  created: string
  updated: string
}

export interface ProductDetails {
  id: number
  name: string
  slug: string
  sku: string
  brand: ProductBrand
  category: ProductCategory
  short_description: string | null
  description: string
  images: ProductImage[]
  pricing: ProductPricing
  stock: ProductStock
  ratings: ProductRatings
  reviews: ProductReview[]
  variants: ProductVariant[]
  timestamps: ProductTimestamps
}

export interface CacheMetadata {
  key: string
  status: "HIT" | "MISS"
  timestamp: string
}

export interface ProductDetailsResponse {
  _cache: CacheMetadata
  data: ProductDetails
  success: boolean
  timestamp: string
}
