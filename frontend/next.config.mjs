import path from "path"

/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://mizizzi-ecommerce-1.onrender.com"
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://mizizzi-ecommerce-87pr-ffh57x9o6-jons-projects-a41f528c.vercel.app"
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "wss://mizizzi-ecommerce-1.onrender.com"
const ENABLE_WEBSOCKET = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET || "true"

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
    NEXT_PUBLIC_SITE_URL: SITE_URL,
    NEXT_PUBLIC_WEBSOCKET_URL: WEBSOCKET_URL,
    NEXT_PUBLIC_ENABLE_WEBSOCKET: ENABLE_WEBSOCKET,
  },

  compress: true,
  generateEtags: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: false,
  output: "standalone",

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "react-icons",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "lucide-react",
    ],
    optimizeCss: true,
    optimizeServerReact: true,
  },

  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ke.jumia.is",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.svgator.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mizizzi-ecommerce-1.onrender.com",
        pathname: "/api/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/api/uploads/**",
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  async rewrites() {
    return [
      {
        source: "/api/mizizzi_admin/:path*",
        destination: `${API_URL}/api/admin/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },

  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/:path*\\.(png|jpg|jpeg|gif|webp|avif|ico)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,HEAD,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Origin, X-Requested-With, Content-Type, Accept",
          },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*\\.(woff|woff2|ttf|otf|eot)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/api/carousel/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
      {
        source: "/api/products/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS,HEAD" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin, Cache-Control",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
          { key: "Cache-Control", value: "public, s-maxage=10, stale-while-revalidate=30" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
        ],
      },
    ]
  },

  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },

  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.devtool = false
    }

    if (dev) {
      config.cache = false
    }

    return config
  },
}

export default nextConfig
