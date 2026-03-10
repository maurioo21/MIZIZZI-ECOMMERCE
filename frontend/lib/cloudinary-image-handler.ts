/**
 * Cloudinary Image Handler - FIXED VERSION
 * Properly handles Cloudinary URLs, public_ids, and backend image endpoints
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
 * Check if URL is a valid Cloudinary URL
 */
function isCloudinaryUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('res.cloudinary.com') && url.includes('/upload/');
}

/**
 * Check if URL is a Cloudinary public_id (no http/https, no domain)
 */
function isCloudinaryPublicId(url: string): boolean {
  if (!url) return false;
  // Public ID doesn't start with http:// or https:// and doesn't contain domain
  return !url.startsWith('http://') && !url.startsWith('https://') && !url.includes('/');
}

/**
 * Extract public_id from a full Cloudinary URL
 */
function extractPublicIdFromUrl(url: string): string | null {
  if (!url.includes('res.cloudinary.com')) return null;
  
  // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}
  const parts = url.split('/upload/');
  if (parts.length < 2) return null;
  
  let publicIdPart = parts[1];
  // Remove any query parameters
  publicIdPart = publicIdPart.split('?')[0];
  
  // Remove transformations if present
  const segments = publicIdPart.split('/');
  
  // If there are multiple segments, the last ones form the public_id
  if (segments.length > 1) {
    // Find where transformations end - typically look for common transformation parameters
    let startIdx = 0;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].includes('_') && !segments[i].includes('.')) {
        startIdx = i + 1;
      }
    }
    return segments.slice(startIdx).join('/').split('.')[0] || null;
  }
  
  return publicIdPart.split('.')[0] || null;
}

/**
 * Transform a URL to Cloudinary optimized format
 * Handles: Cloudinary URLs, public_ids, and passes through other URLs unchanged
 */
export function transformCloudinaryUrl(
  url: string,
  options: CloudinaryTransformOptions = {}
): string {
  if (!url || !CLOUDINARY_CLOUD_NAME) return url;

  const defaults = {
    quality: 'auto',
    format: 'auto',
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
  if (!transformString) return url;

  // CASE 1: Already a Cloudinary URL - insert transformations
  if (isCloudinaryUrl(url)) {
    return url.replace('/upload/', `/upload/${transformString}/`);
  }

  // CASE 2: Just a public_id - construct full URL
  if (isCloudinaryPublicId(url)) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformString}/${url}`;
  }

  // CASE 3: Backend image endpoint or external URL - DON'T transform, return as-is
  // (Next.js Image component will handle optimization)
  return url;
}

/**
 * Get optimized category image URL for list view
 * Smart handling: detects URL type and applies appropriate optimization
 */
export function getCategoryListImageUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return '';

  // If it's already a Cloudinary URL, just optimize it
  if (isCloudinaryUrl(urlOrPublicId)) {
    return transformCloudinaryUrl(urlOrPublicId, {
      width: 200,
      height: 150,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      format: 'auto',
    });
  }

  // If it's a public_id, transform it
  if (isCloudinaryPublicId(urlOrPublicId)) {
    return transformCloudinaryUrl(urlOrPublicId, {
      width: 200,
      height: 150,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      format: 'auto',
    });
  }

  // For backend endpoints or external URLs, return as-is
  // Next.js Image component or browser will handle them
  return urlOrPublicId;
}

/**
 * Get optimized category image URL for thumbnail
 */
export function getCategoryThumbnailUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return '';

  if (isCloudinaryUrl(urlOrPublicId) || isCloudinaryPublicId(urlOrPublicId)) {
    return transformCloudinaryUrl(urlOrPublicId, {
      width: 80,
      height: 80,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto',
      format: 'auto',
    });
  }

  return urlOrPublicId;
}

/**
 * Get optimized category image URL for full display
 */
export function getCategoryDisplayImageUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return '';

  if (isCloudinaryUrl(urlOrPublicId) || isCloudinaryPublicId(urlOrPublicId)) {
    return transformCloudinaryUrl(urlOrPublicId, {
      width: 600,
      height: 400,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      format: 'auto',
    });
  }

  return urlOrPublicId;
}

/**
 * Get optimized banner image URL
 */
export function getBannerImageUrl(urlOrPublicId: string): string {
  if (!urlOrPublicId) return '';

  if (isCloudinaryUrl(urlOrPublicId) || isCloudinaryPublicId(urlOrPublicId)) {
    return transformCloudinaryUrl(urlOrPublicId, {
      width: 1200,
      height: 400,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      format: 'auto',
    });
  }

  return urlOrPublicId;
}

/**
 * Get responsive image URLs with srcSet
 */
export function getResponsiveImageUrls(
  urlOrPublicId: string,
  width: number,
  height: number
) {
  if (!urlOrPublicId) {
    return { src: '', srcSet: '' };
  }

  // Only generate srcSet for Cloudinary URLs and public_ids
  if (!isCloudinaryUrl(urlOrPublicId) && !isCloudinaryPublicId(urlOrPublicId)) {
    return {
      src: urlOrPublicId,
      srcSet: `${urlOrPublicId} 1x`,
    };
  }

  return {
    src: transformCloudinaryUrl(urlOrPublicId, {
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
        url: transformCloudinaryUrl(urlOrPublicId, {
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
        url: transformCloudinaryUrl(urlOrPublicId, {
          width,
          height,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto',
          format: 'auto',
          dpr: 2,
        }),
      },
    ]
      .map(({ dpr, url }) => `${url} ${dpr}x`)
      .join(', '),
  };
}

/**
 * Validate file for upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPG, PNG, WebP, or GIF.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File is too large. Maximum size is 10MB.',
    };
  }

  return { valid: true };
}

/**
 * Get image dimensions from file
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
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
 * Generate data URL preview from file
 */
export async function generateImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };

    reader.onerror = () => {
      reject(new Error('Failed to generate preview'));
    };

    reader.readAsDataURL(file);
  });
}
