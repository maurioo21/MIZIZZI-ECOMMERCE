/**
 * Cloudinary URL Builder - Generate optimized CDN URLs
 * 
 * Provides utilities for building responsive Cloudinary URLs
 * with automatic format selection, quality optimization, and caching
 */

export interface CloudinaryUrlOptions {
  width?: number
  height?: number
  crop?: "fill" | "fit" | "scale" | "thumb" | "pad"
  quality?: "auto" | number
  format?: "auto" | "webp" | "jpg" | "png" | "gif"
  dpr?: "auto" | number
  gravity?: string
  radius?: number | "max"
  opacity?: number
  background?: string
}

export interface CloudinaryResponsiveUrls {
  mobile: string
  tablet: string
  desktop: string
  ultrawide: string
}

/**
 * Parse Cloudinary URL to extract cloud name and public ID
 */
export function parseCloudinaryUrl(
  url: string
): { cloudName: string; publicId: string } | null {
  try {
    const urlObj = new URL(url)
    if (!urlObj.hostname.includes("cloudinary.com")) {
      return null
    }

    // Extract cloud name from subdomain (e.g., "da35rsdl0" from "da35rsdl0.res.cloudinary.com")
    const parts = urlObj.hostname.split(".")
    const cloudName = parts[0] // First part is the cloud name
    
    const pathParts = urlObj.pathname.split("/").filter(Boolean)
    
    // Find the public ID (everything after /upload/)
    const uploadIndex = pathParts.indexOf("upload")
    if (uploadIndex === -1) {
      return null
    }
    
    // Everything after /upload/ is potentially the public ID
    let remainingParts = pathParts.slice(uploadIndex + 1)
    
    // Skip version numbers (v123456, v1, etc.) - Cloudinary versions start with 'v' followed by digits
    if (remainingParts.length > 0 && /^v\d+$/.test(remainingParts[0])) {
      remainingParts = remainingParts.slice(1)
    }
    
    // Join the remaining parts to get the public ID
    let publicId = remainingParts.join("/")
    
    // Remove any transformation prefix (shouldn't normally be here, but just in case)
    publicId = publicId.replace(/^[a-z0-9_,]+\//, "")
    
    return { cloudName, publicId }
  } catch (error) {
    console.error("[v0] Error parsing Cloudinary URL:", error)
    return null
  }
}

    const cloudName = urlObj.hostname.split(".")[0]
    const pathParts = urlObj.pathname.split("/").filter(Boolean)
    
    // Find the public ID (everything after /upload/)
    const uploadIndex = pathParts.indexOf("upload")
    if (uploadIndex === -1) {
      console.warn("[v0] No /upload/ found in Cloudinary URL path:", urlObj.pathname)
      return null
    }
    
    // Everything after /upload/ is the public ID
    // This may include version info (v123) and file extension, which we should preserve
    const remainingParts = pathParts.slice(uploadIndex + 1)
    
    // Remove transformation parameters if they exist (they shouldn't in parsed URLs)
    let publicId = remainingParts.join("/")
    
    // Remove any transformation prefix (shouldn't normally be here, but just in case)
    // Transformations come after /upload/ and before the public ID
    // They look like: w_200,h_150,c_fill, etc.
    publicId = publicId.replace(/^[a-z0-9_,]+\//, "")
    
    console.log("[v0] Parsed Cloudinary URL - Cloud:", cloudName, "Public ID:", publicId)
    return { cloudName, publicId }
  } catch (error) {
    console.error("[v0] Error parsing Cloudinary URL:", error)
    return null
  }
}

/**
 * Build a Cloudinary transformation URL
 */
export function buildCloudinaryUrl(
  cloudName: string,
  publicId: string,
  options: CloudinaryUrlOptions = {}
): string {
  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
    dpr = "auto",
    gravity,
    radius,
    opacity,
    background,
  } = options

  // Validate inputs
  if (!cloudName || !publicId) {
    console.error("[v0] buildCloudinaryUrl: Missing cloudName or publicId", { cloudName, publicId })
    return ""
  }

  // Build transformation string
  const transforms: string[] = []

  // Dimensions
  if (width) transforms.push(`w_${width}`)
  if (height) transforms.push(`h_${height}`)
  
  // Crop mode
  transforms.push(`c_${crop}`)
  
  // Quality (auto optimizes for bandwidth)
  if (typeof quality === "number") {
    transforms.push(`q_${quality}`)
  } else {
    transforms.push(`q_${quality}`)
  }
  
  // Format (auto selects best format for browser)
  transforms.push(`f_${format}`)
  
  // Device pixel ratio
  if (dpr === "auto") {
    transforms.push("dpr_auto")
  } else if (typeof dpr === "number") {
    transforms.push(`dpr_${dpr}`)
  }
  
  // Additional transforms
  if (gravity) transforms.push(`g_${gravity}`)
  if (radius !== undefined) {
    transforms.push(`r_${radius}`)
  }
  if (opacity !== undefined) {
    transforms.push(`o_${opacity}`)
  }
  if (background) {
    transforms.push(`b_${background}`)
  }

  const transformString = transforms.join(",")
  
  // Ensure publicId is clean (no leading slashes)
  const cleanPublicId = publicId.startsWith("/") ? publicId.slice(1) : publicId
  
  // Build final URL
  const finalUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${cleanPublicId}`
  
  return finalUrl
}

/**
 * Build Cloudinary URL from full URL
 */
export function buildCloudinaryUrlFromFullUrl(
  url: string,
  options: CloudinaryUrlOptions = {}
): string {
  if (!url) {
    console.error("[v0] Empty URL provided to buildCloudinaryUrlFromFullUrl")
    return ""
  }
  
  const parsed = parseCloudinaryUrl(url)
  if (!parsed) {
    console.warn("[v0] Failed to parse Cloudinary URL, returning original:", url)
    return url
  }

  return buildCloudinaryUrl(parsed.cloudName, parsed.publicId, options)
}

/**
 * Generate responsive URLs for all common breakpoints
 */
export function generateResponsiveUrls(
  cloudinaryUrl: string,
  baseOptions: CloudinaryUrlOptions = {}
): CloudinaryResponsiveUrls {
  return {
    mobile: buildCloudinaryUrlFromFullUrl(cloudinaryUrl, {
      ...baseOptions,
      width: 800,
      height: 300,
    }),
    tablet: buildCloudinaryUrlFromFullUrl(cloudinaryUrl, {
      ...baseOptions,
      width: 1000,
      height: 400,
    }),
    desktop: buildCloudinaryUrlFromFullUrl(cloudinaryUrl, {
      ...baseOptions,
      width: 1400,
      height: 500,
    }),
    ultrawide: buildCloudinaryUrlFromFullUrl(cloudinaryUrl, {
      ...baseOptions,
      width: 1920,
      height: 600,
    }),
  }
}

/**
 * Carousel-specific URL builder
 */
export function getCarouselImageUrl(
  imageUrl: string,
  size: "mobile" | "tablet" | "desktop" | "ultrawide" = "desktop"
): string {
  const sizeMap = {
    mobile: { width: 800, height: 300 },
    tablet: { width: 1000, height: 400 },
    desktop: { width: 1400, height: 500 },
    ultrawide: { width: 1920, height: 600 },
  }

  const { width, height } = sizeMap[size]
  return buildCloudinaryUrlFromFullUrl(imageUrl, {
    width,
    height,
    crop: "fill",
    quality: "auto",
    format: "auto",
    dpr: "auto",
  })
}

/**
 * Thumbnail URL builder (for admin previews)
 */
export function getThumbnailUrl(imageUrl: string): string {
  return buildCloudinaryUrlFromFullUrl(imageUrl, {
    width: 200,
    height: 150,
    crop: "thumb",
    quality: "auto",
    format: "auto",
  })
}

/**
 * Low Quality Image Placeholder (LQIP) builder
 */
export function getLQIPUrl(imageUrl: string): string {
  return buildCloudinaryUrlFromFullUrl(imageUrl, {
    width: 100,
    height: 75,
    crop: "fill",
    quality: 20,
    format: "auto",
    dpr: "auto",
  })
}

/**
 * Picture element srcset builder
 */
export function buildSrcSet(
  imageUrl: string,
  sizes: Array<{ width: number; dpr?: number }>
): string {
  return sizes
    .map(({ width, dpr = 1 }) => {
      const url = buildCloudinaryUrlFromFullUrl(imageUrl, {
        width: Math.round(width / dpr),
        quality: "auto",
        format: "auto",
      })
      return `${url} ${width}w`
    })
    .join(", ")
}

/**
 * Get optimal image URL based on current viewport
 */
export function getOptimalImageUrl(
  imageUrl: string,
  viewportWidth: number = typeof window !== "undefined" ? window.innerWidth : 1400
): string {
  if (viewportWidth < 640) {
    return getCarouselImageUrl(imageUrl, "mobile")
  } else if (viewportWidth < 1024) {
    return getCarouselImageUrl(imageUrl, "tablet")
  } else if (viewportWidth < 1920) {
    return getCarouselImageUrl(imageUrl, "desktop")
  } else {
    return getCarouselImageUrl(imageUrl, "ultrawide")
  }
}

/**
 * Get all image variants for a responsive image solution
 */
export function getAllImageVariants(
  imageUrl: string
): {
  src: string
  srcSet: string
  placeholder: string
  responsive: CloudinaryResponsiveUrls
} {
  const responsive = generateResponsiveUrls(imageUrl)
  const srcSet = buildSrcSet(imageUrl, [
    { width: 800, dpr: 1 },
    { width: 800, dpr: 2 },
    { width: 1400, dpr: 1 },
    { width: 1400, dpr: 2 },
    { width: 1920, dpr: 1 },
    { width: 1920, dpr: 2 },
  ])

  return {
    src: responsive.desktop,
    srcSet,
    placeholder: getLQIPUrl(imageUrl),
    responsive,
  }
}

/**
 * Validate if URL is a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes("cloudinary.com")
  } catch {
    return false
  }
}

/**
 * Get Cloudinary cloud name from URL
 */
export function getCloudName(url: string): string | null {
  const parsed = parseCloudinaryUrl(url)
  return parsed?.cloudName || null
}

/**
 * Secure URL generator (for signed URLs)
 */
export function generateSecureCloudinaryUrl(
  cloudName: string,
  publicId: string,
  options: CloudinaryUrlOptions = {},
  signature?: string,
  timestamp?: number
): string {
  let url = buildCloudinaryUrl(cloudName, publicId, options)

  if (signature && timestamp) {
    // For signed URLs, append signature and timestamp
    url = url.replace("/upload/", `/upload/s_${signature},t_${timestamp}/`)
  }

  return url
}
