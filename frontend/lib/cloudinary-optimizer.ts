/**
 * Cloudinary URL optimization utilities for fast CDN delivery
 */

/**
 * Optimizes Cloudinary URLs with CDN parameters for faster delivery
 * Adds automatic width, quality, and format optimization
 * 
 * @param url - The URL to optimize
 * @param options - Optional optimization parameters
 * @returns Optimized Cloudinary URL or original URL if not a Cloudinary URL
 */
export function optimizeCloudinaryUrl(
  url: string | undefined | null,
  options?: {
    width?: number
    height?: number
    quality?: 'auto' | number
    format?: 'auto' | string
    crop?: string
  }
): string | undefined {
  if (!url) return undefined
  
  // Only optimize Cloudinary URLs
  if (!url.includes("res.cloudinary.com")) {
    return url
  }
  
  try {
    const uploadIndex = url.indexOf("/upload/")
    if (uploadIndex === -1) return url
    
    const beforeUpload = url.substring(0, uploadIndex + "/upload/".length)
    const afterUpload = url.substring(uploadIndex + "/upload/".length)
    
    // Build transformation string
    const transformations: string[] = []
    
    // Add width (auto-responsive if not specified)
    if (options?.width) {
      transformations.push(`w_${options.width}`)
    } else {
      transformations.push("w_auto")
    }
    
    // Add height if specified
    if (options?.height) {
      transformations.push(`h_${options.height}`)
    }
    
    // Add crop mode if specified
    if (options?.crop) {
      transformations.push(`c_${options.crop}`)
    } else {
      transformations.push("c_fill") // Default fill crop
    }
    
    // Add quality (auto-optimize if not specified)
    if (typeof options?.quality === 'number') {
      transformations.push(`q_${options.quality}`)
    } else {
      transformations.push("q_auto") // Auto quality
    }
    
    // Add format (auto-optimize if not specified)
    if (options?.format) {
      transformations.push(`f_${options.format}`)
    } else {
      transformations.push("f_auto") // Auto format (WebP, etc.)
    }
    
    const transformationString = transformations.join(",")
    return `${beforeUpload}${transformationString}/${afterUpload}`
  } catch (error) {
    console.error("[v0] Error optimizing Cloudinary URL:", error)
    return url
  }
}

/**
 * Normalize image URLs - prioritizes Cloudinary URLs
 */
export function normalizeImageUrl(url: string | undefined | null): string | undefined {
  if (!url || url === "null" || url === "undefined" || url.trim() === "") {
    return undefined
  }
  
  // If it's already a Cloudinary URL, return as-is
  if (url.includes("res.cloudinary.com")) {
    return url
  }
  
  // If it's already an http/https URL, return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  
  // If it's a data URL, return as-is
  if (url.startsWith("data:")) {
    return url
  }
  
  return url
}

/**
 * Get optimized Cloudinary URL for product thumbnails
 * Smaller size for grid displays
 */
export function getProductThumbnailUrl(url: string | undefined | null): string | undefined {
  return optimizeCloudinaryUrl(url, {
    width: 400,
    height: 400,
    crop: "fill",
    quality: "auto",
  })
}

/**
 * Get optimized Cloudinary URL for product detail view
 * Larger size for single product display
 */
export function getProductDetailUrl(url: string | undefined | null): string | undefined {
  return optimizeCloudinaryUrl(url, {
    width: 800,
    height: 800,
    crop: "fill",
    quality: "auto",
  })
}

/**
 * Get optimized Cloudinary URL for category images
 * Optimized for category card displays
 */
export function getCategoryImageUrl(url: string | undefined | null): string | undefined {
  return optimizeCloudinaryUrl(url, {
    width: 600,
    height: 400,
    crop: "fill",
    quality: "auto",
  })
}

/**
 * Get optimized Cloudinary URL for carousel banners
 * Full width responsive sizing
 */
export function getCarouselImageUrl(url: string | undefined | null): string | undefined {
  return optimizeCloudinaryUrl(url, {
    width: 1200,
    crop: "fill",
    quality: "auto",
  })
}
