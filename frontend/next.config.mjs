import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://mizizzi-ecommerce-1.onrender.com',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://mizizzi-ecommerce-87pr-ffh57x9o6-jons-projects-a41f528c.vercel.app',
    NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://mizizzi-ecommerce-1.onrender.com',
    NEXT_PUBLIC_ENABLE_WEBSOCKET: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET || 'true',
  },
  // Performance: Aggressively optimize production builds
  productionBrowserSourceMaps: false,
  // Performance: Compress HTML
  compress: true,
  // Performance: Generate ETags
  generateEtags: true,
  // Performance: Poweredby header 
  poweredByHeader: false,
  // Performance: React strict mode OFF to reduce overhead (for performance, not best practice)
  reactStrictMode: false,
  // Performance: Parallel exports for faster builds
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'react-icons',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      'lucide-react',
    ],
  },
  images: {
    // Enable Next.js image optimization for proper serving, AVIF/WebP generation, and responsive sizing
    // For Cloudinary URLs, unoptimized=true is used since Cloudinary provides pre-optimized images
    unoptimized: false,
    
    remotePatterns: [
      // Cloudinary - Already optimized, disable Next.js optimization for these
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      // Pexels
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.pexels.com',
        pathname: '/**',
      },
      // Unsplash
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.unsplash.com',
        pathname: '/**',
      },
      // Vercel Blob Storage
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.vercel-storage.com',
        pathname: '/**',
      },
      // Placeholder services
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
      // Wikimedia
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      // Backend uploads
      {
        protocol: 'https',
        hostname: 'mizizzi-ecommerce-1.onrender.com',
        pathname: '/api/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/api/uploads/**',
      },
      // Fallback for any HTTPS domain (catch-all)
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 85],
    minimumCacheTTL: 31536000, // 1 year cache for optimized images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; img-src * data: blob: 'self'; script-src 'none'; sandbox;",
  },
  output: 'standalone',
  turbopack: {
    // When using a monorepo / npm workspaces the `next` package may be hoisted
    // to the repository root. Point Turbopack's root at the workspace root
    // so it can resolve the Next.js package correctly.
    root: path.resolve(process.cwd(), '..'),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://mizizzi-ecommerce-1.onrender.com'}/api/:path*`,
      },
      {
        source: '/api/mizizzi_admin/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://mizizzi-ecommerce-1.onrender.com'}/api/admin/:path*`,
      },
    ];
  },
  async headers() {
    return [
      // Static HTML pages - Cache with ISR
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=3600' },
        ],
      },
      // Static assets - Aggressive caching (1 year)
      {
        source: '/public/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Images - Long cache with ISR fallback
      {
        source: '/:path*\\.(png|jpg|jpeg|gif|svg|webp|avif|ico)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,HEAD,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Origin, X-Requested-With, Content-Type, Accept' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Font files - Very aggressive caching
      {
        source: '/:path*\\.(woff|woff2|ttf|otf|eot)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // API routes - Short cache with SWR
      {
        source: '/api/carousel/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/api/products/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS,HEAD' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin, Cache-Control' },
          { key: 'Access-Control-Max-Age', value: '86400' },
          { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
        ],
      },
      // Security headers
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    // Performance: Disable source maps in production
    if (!dev && !isServer) {
      config.devtool = false;
    }
    if (dev) {
      config.cache = false;
    }
    return config;
  },
}

export default nextConfig;
