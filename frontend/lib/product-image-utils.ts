import { cloudinaryService } from "@/services/cloudinary-service"

/**
 * Product image handling utilities
 * Consolidates all image URL generation and validation logic
 */

interface ImageOptions {
  highQuality?: boolean
  index?: number
}

/**
 * Get the primary display image for a product
 * Tries multiple fallbacks in order
 */
export function getProductImageUrl(product: any, options: ImageOptions = {}): string {
  const { highQuality = false, index = 0 } = options

  if (!product) return "/generic-product-display.png"

  // Try high-quality image URLs first
  if (product.image_urls && Array.isArray(product.image_urls)) {
    const imageUrl = product.image_urls[index]
    if (isValidImageUrl(imageUrl)) {
      return optimizeImageUrl(imageUrl, highQuality)
    }
  }

  // Fallback to thumbnail
  if (product.thumbnail_url && isValidImageUrl(product.thumbnail_url)) {
    return product.thumbnail_url
  }

  // Final fallback
  return "/generic-product-display.png"
}

/**
 * Get all valid image URLs for a product
 * Handles various API response formats
 */
export function getProductImages(product: any): string[] {
  if (!product) return ["/generic-product-display.png"]

  let imageUrls: string[] = []

  // Handle image_urls array
  if (product.image_urls) {
    if (Array.isArray(product.image_urls)) {
      imageUrls = parseImageUrlsArray(product.image_urls)
    } else if (typeof product.image_urls === "string") {
      imageUrls = parseImageUrlsString(product.image_urls)
    }
  }

  // Filter valid URLs and optimize
  const validUrls = imageUrls
    .filter(isValidImageUrl)
    .map((url) => optimizeImageUrl(url, false))

  // Fallback to thumbnail if no valid images
  if (validUrls.length === 0 && product.thumbnail_url && isValidImageUrl(product.thumbnail_url)) {
    return [product.thumbnail_url]
  }

  return validUrls.length > 0 ? validUrls : ["/generic-product-display.png"]
}

/**
 * Parse image URLs from array format
 * Handles both direct arrays and stringified JSON
 */
function parseImageUrlsArray(imageUrls: any[]): string[] {
  // Check if it's a fragmented array (each element is a character)
  if (imageUrls.length > 0 && typeof imageUrls[0] === "string" && imageUrls[0].length === 1) {
    try {
      const reconstructed = imageUrls.join("")
      const parsed = JSON.parse(reconstructed)
      if (Array.isArray(parsed)) {
        return parsed.map(String)
      }
    } catch {
      // Fall through to normal processing
    }
  }

  return imageUrls.map(String).filter(Boolean)
}

/**
 * Parse image URLs from string format
 * Handles JSON-stringified arrays
 */
function parseImageUrlsString(imageUrlString: string): string[] {
  // Try to parse as JSON array
  try {
    const parsed = JSON.parse(imageUrlString)
    if (Array.isArray(parsed)) {
      return parsed.map(String)
    }
  } catch {
    // Not JSON, treat as single URL
  }

  // Single URL string
  return [imageUrlString]
}

/**
 * Check if an image URL is valid and can be displayed
 */
function isValidImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false
  if (url.trim() === "") return false
  if (url.startsWith("blob:")) return false // Avoid blob URLs
  return true
}

/**
 * Optimize image URL with Cloudinary if needed
 */
function optimizeImageUrl(url: string, highQuality: boolean): string {
  // Already an external URL
  if (url.startsWith("http")) {
    return url
  }

  // Optimize with Cloudinary
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

/**
 * Generate a stable random rating for a product (for UI placeholder)
 * Generates once per session, not per render
 */
const ratingCache = new Map<number | string, number>()

export function getStableProductRating(productId: number | string, defaultRating: number = 3.5): number {
  if (!productId) return defaultRating

  if (!ratingCache.has(productId)) {
    // Generate a random rating between 3 and 5 (skewed towards 4+)
    const randomRating = 3.5 + Math.random() * 1.5
    ratingCache.set(productId, Math.round(randomRating * 10) / 10)
  }

  return ratingCache.get(productId) || defaultRating
}
