/**
 * Cloudinary Image Handler
 * Utilities for optimizing and transforming Cloudinary URLs for CDN delivery
 */

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';

interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  gravity?: string;
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
  dpr?: 'auto' | number;
}

/**
 * Transform a Cloudinary URL with optimization parameters
 * @param url - Original Cloudinary URL or just the public_id
 * @param options - Transformation options
 * @returns Optimized URL with transformations
 */
export function transformCloudinaryUrl(url: string, options: CloudinaryTransformOptions = {}): string {
  if (!url) return '';
  
  const defaults = {
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  };
  
  const opts = { ...defaults, ...options };
  
  // Build transformation string
  const transforms: string[] = [];
  
  if (opts.width) transforms.push(`w_${opts.width}`);
  if (opts.height) transforms.push(`h_${opts.height}`);
  if (opts.crop) transforms.push(`c_${opts.crop}`);
  if (opts.gravity) transforms.push(`g_${opts.gravity}`);
  if (opts.quality !== undefined) transforms.push(`q_${opts.quality}`);
  if (opts.format) transforms.push(`f_${opts.format}`);
  if (opts.dpr && opts.dpr !== 'auto') transforms.push(`dpr_${opts.dpr}`);
  
  const transformString = transforms.join(',');
  
  // If URL already contains /upload/, insert transformation there
  if (url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/${transformString}/`);
  }
  
  // If it's just a public_id, construct full URL
  if (!url.includes('cloudinary')) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformString}/${url}`;
  }
  
  return url;
}

/**
 * Get optimized category image URL
 * @param publicId - Cloudinary public_id or full URL
 * @returns Optimized URL for thumbnail display (80x80)
 */
export function getCategoryThumbnailUrl(publicId: string): string {
  return transformCloudinaryUrl(publicId, {
    width: 80,
    height: 80,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto',
    format: 'auto',
  });
}

/**
 * Get optimized category image URL for list view
 * @param publicId - Cloudinary public_id or full URL
 * @returns Optimized URL for list display (200x150)
 */
export function getCategoryListImageUrl(publicId: string): string {
  return transformCloudinaryUrl(publicId, {
    width: 200,
    height: 150,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  });
}

/**
 * Get optimized category image URL for display
 * @param publicId - Cloudinary public_id or full URL
 * @returns Optimized URL for full display (600x400)
 */
export function getCategoryDisplayImageUrl(publicId: string): string {
  return transformCloudinaryUrl(publicId, {
    width: 600,
    height: 400,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  });
}

/**
 * Get optimized banner image URL
 * @param publicId - Cloudinary public_id or full URL
 * @returns Optimized URL for banner display (1200x400)
 */
export function getBannerImageUrl(publicId: string): string {
  return transformCloudinaryUrl(publicId, {
    width: 1200,
    height: 400,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  });
}

/**
 * Get responsive image URL with srcSet for different pixel densities
 * @param publicId - Cloudinary public_id or full URL
 * @param width - Base width
 * @param height - Base height
 * @returns Object with src and srcSet for responsive images
 */
export function getResponsiveImageUrls(publicId: string, width: number, height: number) {
  return {
    src: transformCloudinaryUrl(publicId, {
      width,
      height,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      format: 'auto',
      dpr: 1,
    }),
    srcSet: [
      {
        dpr: 1,
        url: transformCloudinaryUrl(publicId, {
          width,
          height,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto',
          format: 'auto',
          dpr: 1,
        }),
      },
      {
        dpr: 2,
        url: transformCloudinaryUrl(publicId, {
          width,
          height,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto',
          format: 'auto',
          dpr: 2,
        }),
      },
    ].map(({ dpr, url }) => `${url} ${dpr}x`).join(', '),
  };
}

/**
 * Validate file for upload
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }
  
  // Check MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed types: JPEG, PNG, WebP, GIF`,
    };
  }
  
  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file extension: .${extension}. Allowed: jpg, jpeg, png, webp, gif`,
    };
  }
  
  return { valid: true };
}

/**
 * Get image dimensions from file
 * @param file - Image file
 * @returns Promise with dimensions
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Create preview URL from file
 * @param file - Image file
 * @returns Promise with data URL
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to create preview'));
    };
    
    reader.readAsDataURL(file);
  });
}
