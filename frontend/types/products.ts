/**
 * Product Types - Strict TypeScript definitions matching backend API response structure
 * All fields are properly typed to prevent `any` usage and ensure type safety
 */

// ============================================================================
// IMAGE TYPES
// ============================================================================

export interface ProductImageUrls {
  thumbnail: string;
  medium: string;
  large: string;
  original: string;
}

export interface ProductImage {
  id: number;
  product_id: number;
  urls: ProductImageUrls;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// PRICING TYPES
// ============================================================================

export interface ProductPricing {
  original_price: number;
  current_price: number;
  sale_price: number | null;
  discount_percentage: number;
  cost_price?: number;
  margin_percentage?: number;
}

// ============================================================================
// STOCK TYPES
// ============================================================================

export interface ProductStock {
  quantity: number;
  is_in_stock: boolean;
  is_low_stock: boolean;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';
  reorder_level?: number;
  max_stock?: number;
}

// ============================================================================
// RATING & REVIEW TYPES
// ============================================================================

export interface RatingDistribution {
  '5': number;
  '4': number;
  '3': number;
  '2': number;
  '1': number;
}

export interface ProductRatings {
  average: number;
  total_reviews: number;
  distribution: RatingDistribution;
}

export interface ProductReview {
  id: number;
  product_id: number;
  user_id: number;
  rating: number;
  title: string;
  comment: string;
  helpful_count: number;
  verified_purchase: boolean;
  created_at: string;
  user_name: string;
}

// ============================================================================
// BRAND & CATEGORY TYPES
// ============================================================================

export interface ProductBrand {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image_url?: string | null;
}

// ============================================================================
// VARIANT TYPES
// ============================================================================

export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  value: string;
  sku: string;
  price: number;
  stock: number;
  image_url?: string | null;
}

// ============================================================================
// TIMESTAMPS TYPES
// ============================================================================

export interface ProductTimestamps {
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// ============================================================================
// MAIN PRODUCT DETAILS TYPE
// ============================================================================

export interface ProductDetails {
  id: number;
  name: string;
  slug: string;
  sku: string;
  brand: ProductBrand;
  category: ProductCategory;
  description: string;
  short_description: string | null;
  images: ProductImage[];
  pricing: ProductPricing;
  stock: ProductStock;
  ratings: ProductRatings;
  reviews: ProductReview[];
  variants: ProductVariant[];
  timestamps: ProductTimestamps;
  // Feature flags
  is_featured?: boolean;
  is_new?: boolean;
  is_sale?: boolean;
  is_flash_sale?: boolean;
  is_luxury_deal?: boolean;
  is_trending?: boolean;
  is_top_pick?: boolean;
  is_daily_find?: boolean;
  is_new_arrival?: boolean;
  // Additional fields
  badge_text?: string;
  badge_color?: string;
  specifications?: Record<string, string>;
  warranty_info?: string;
  shipping_info?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  video_url?: string;
  condition?: 'new' | 'used' | 'refurbished';
  is_preorder?: boolean;
  preorder_release_date?: string;
  preorder_message?: string;
  // Backward compatibility: legacy properties (use pricing.* fields instead)
  price: number;  // Required for Product type compatibility
  sale_price?: number | null;
  thumbnail_url?: string;
  image_urls?: string[];
  // Cache metadata
  _cache?: {
    cache_key?: string;
    cached_at?: string;
    expires_at?: string;
    ttl_seconds?: number;
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ProductDetailsResponse {
  success: boolean;
  data: ProductDetails;
  _cache?: {
    cache_key?: string;
    cached_at?: string;
    expires_at?: string;
    ttl_seconds?: number;
  };
}

export interface ProductListResponse {
  success: boolean;
  data: ProductDetails[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  _cache?: {
    cache_key?: string;
    cached_at?: string;
    expires_at?: string;
    ttl_seconds?: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS & SELECTORS
// ============================================================================

/**
 * Get primary image from product images array
 */
export function getPrimaryImage(product: ProductDetails): ProductImage | undefined {
  return product.images?.find(img => img.is_primary) || product.images?.[0];
}

/**
 * Get all gallery images sorted by primary first
 */
export function getGalleryImages(product: ProductDetails): ProductImage[] {
  if (!product.images || product.images.length === 0) return [];
  const primary = product.images.find(img => img.is_primary);
  const rest = product.images.filter(img => !img.is_primary);
  return primary ? [primary, ...rest] : product.images;
}

/**
 * Get large image for gallery display
 */
export function getGalleryImageUrl(image: ProductImage): string {
  return image?.urls?.large || image?.urls?.original || '';
}

/**
 * Get original/high-quality image for zoom
 */
export function getZoomImageUrl(image: ProductImage): string {
  return image?.urls?.original || image?.urls?.large || '';
}

/**
 * Get thumbnail for listing
 */
export function getThumbnailImageUrl(image: ProductImage): string {
  return image?.urls?.thumbnail || image?.urls?.medium || '';
}

/**
 * Safely get current display price
 */
export function getCurrentDisplayPrice(product: ProductDetails): number {
  const pricing = product?.pricing;
  if (!pricing) return 0;
  return pricing.current_price || pricing.original_price || 0;
}

/**
 * Get sale discount info if applicable
 */
export function getDiscountInfo(product: ProductDetails): { hasDiscount: boolean; percentOff: number; savings: number } {
  const pricing = product?.pricing;
  if (!pricing) return { hasDiscount: false, percentOff: 0, savings: 0 };
  
  const hasDiscount = pricing.discount_percentage > 0 && pricing.current_price < pricing.original_price;
  const percentOff = pricing.discount_percentage;
  const savings = pricing.original_price - pricing.current_price;
  
  return { hasDiscount, percentOff, savings };
}

/**
 * Check if product is in stock
 */
export function isInStock(product: ProductDetails): boolean {
  return product?.stock?.is_in_stock === true;
}

/**
 * Check if product is low stock
 */
export function isLowStock(product: ProductDetails): boolean {
  return product?.stock?.is_low_stock === true;
}

/**
 * Get stock status display text
 */
export function getStockStatusText(product: ProductDetails): string {
  const status = product?.stock?.stock_status;
  const quantity = product?.stock?.quantity;
  
  if (status === 'out_of_stock') return 'Out of Stock';
  if (status === 'low_stock') return `Only ${quantity} left`;
  if (status === 'backorder') return 'Available on Backorder';
  return 'In Stock';
}

/**
 * Check if product has reviews
 */
export function hasReviews(product: ProductDetails): boolean {
  return (product?.reviews?.length ?? 0) > 0;
}

/**
 * Get display rating value (0-5)
 */
export function getDisplayRating(product: ProductDetails): number {
  const rating = product?.ratings?.average ?? 0;
  return Math.min(5, Math.max(0, rating));
}

/**
 * Get review count
 */
export function getReviewCount(product: ProductDetails): number {
  return product?.ratings?.total_reviews ?? 0;
}
