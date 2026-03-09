/**
 * Cache Management Types
 * Defines all TypeScript interfaces for the cache management system
 */

export enum CacheGroupType {
  CRITICAL = "critical",
  DEFERRED = "deferred",
  HOMEPAGE = "homepage",
  ALL = "all",
}

export interface CachePattern {
  key: string
  name: string
  description: string
  group: CacheGroupType
  estimatedSize?: number
}

export interface CacheStatus {
  connected: boolean
  memoryUsage?: number
  keysCount?: number
  cacheGroups?: CacheGroupStatus[]
  lastUpdated: string
}

export interface CacheGroupStatus {
  group: CacheGroupType
  patterns: CachePattern[]
  count: number
  memoryUsage?: number
  description: string
}

export interface InvalidateCacheRequest {
  pattern: string
}

export interface InvalidateGroupRequest {
  group: CacheGroupType
}

export interface InvalidateAllRequest {
  confirmed: boolean
}

export interface CacheInvalidationResponse {
  success: boolean
  message: string
  deletedCount?: number
  affectedGroups?: string[]
  timestamp: string
  error?: string
}

export interface InvalidationHistoryEntry {
  id: string
  adminId: number
  adminName: string
  action: "invalidate_single" | "invalidate_group" | "rebuild" | "invalidate_all"
  cacheGroups: string[]
  redisPatterns: string[]
  keysDeleted: number
  status: "success" | "failed" | "partial"
  errorMessage?: string
  timestamp: string
  ipAddress?: string
}

export interface InvalidationHistoryResponse {
  items: InvalidationHistoryEntry[]
  total: number
  page: number
  perPage: number
}

export interface CacheRebuildRequest {
  force: boolean
}

export interface CacheRebuildResponse {
  success: boolean
  message: string
  timestamp: string
  rebuiltGroups?: string[]
  error?: string
}

export interface CacheManagementError {
  code: string
  message: string
  details?: Record<string, any>
}

// Predefined cache groups with their patterns
export const CACHE_GROUPS_CONFIG: Record<CacheGroupType, CacheGroupStatus> = {
  [CacheGroupType.CRITICAL]: {
    group: CacheGroupType.CRITICAL,
    patterns: [
      {
        key: "mizizzi:carousel:*",
        name: "Carousel Cache",
        description: "Homepage carousel items and images",
        group: CacheGroupType.CRITICAL,
      },
      {
        key: "mizizzi:categories:*",
        name: "Categories Cache",
        description: "Shop categories hierarchy and metadata",
        group: CacheGroupType.CRITICAL,
      },
      {
        key: "mizizzi:feature_cards:*",
        name: "Feature Cards Cache",
        description: "Feature cards displayed on homepage",
        group: CacheGroupType.CRITICAL,
      },
      {
        key: "mizizzi:topbar:*",
        name: "Top Bar Cache",
        description: "Top bar messaging and announcements",
        group: CacheGroupType.CRITICAL,
      },
    ],
    count: 4,
    description: "Critical caches affecting homepage appearance",
  },
  [CacheGroupType.DEFERRED]: {
    group: CacheGroupType.DEFERRED,
    patterns: [
      {
        key: "mizizzi:flash_sale:*",
        name: "Flash Sale Cache",
        description: "Flash sale products and timing",
        group: CacheGroupType.DEFERRED,
      },
      {
        key: "mizizzi:premium_experiences:*",
        name: "Premium Experiences Cache",
        description: "Premium/luxury product collections",
        group: CacheGroupType.DEFERRED,
      },
      {
        key: "mizizzi:product_showcase:*",
        name: "Product Showcase Cache",
        description: "Featured product showcase sections",
        group: CacheGroupType.DEFERRED,
      },
      {
        key: "mizizzi:brands:*",
        name: "Brands Cache",
        description: "Brand information and listings",
        group: CacheGroupType.DEFERRED,
      },
    ],
    count: 4,
    description: "Deferred caches for content that updates less frequently",
  },
  [CacheGroupType.HOMEPAGE]: {
    group: CacheGroupType.HOMEPAGE,
    patterns: [
      {
        key: "mizizzi:homepage:*",
        name: "Homepage Cache",
        description: "Complete homepage aggregate cache",
        group: CacheGroupType.HOMEPAGE,
      },
      {
        key: "mizizzi:contact_cta:*",
        name: "Contact CTA Cache",
        description: "Contact call-to-action sections",
        group: CacheGroupType.HOMEPAGE,
      },
      {
        key: "mizizzi:footer:*",
        name: "Footer Cache",
        description: "Footer content and links",
        group: CacheGroupType.HOMEPAGE,
      },
      {
        key: "mizizzi:side_panels:*",
        name: "Side Panel Cache",
        description: "Side panel content and navigation",
        group: CacheGroupType.HOMEPAGE,
      },
      {
        key: "mizizzi:theme:*",
        name: "Theme Cache",
        description: "Theme settings and customization",
        group: CacheGroupType.HOMEPAGE,
      },
      {
        key: "mizizzi:inventory:*",
        name: "Inventory Cache",
        description: "Product stock and inventory data",
        group: CacheGroupType.HOMEPAGE,
      },
      {
        key: "mizizzi:products:*",
        name: "Products Cache",
        description: "Product data and listings",
        group: CacheGroupType.HOMEPAGE,
      },
    ],
    count: 7,
    description: "Homepage section caches and global content",
  },
  [CacheGroupType.ALL]: {
    group: CacheGroupType.ALL,
    patterns: [],
    count: 15,
    description: "All caches (use with caution)",
  },
}

// Invalidation mapping: which caches to clear for each admin action
export const CACHE_INVALIDATION_MAP: Record<string, CacheGroupType[]> = {
  // Product actions
  "products:create": [CacheGroupType.CRITICAL, CacheGroupType.DEFERRED],
  "products:update": [CacheGroupType.CRITICAL, CacheGroupType.DEFERRED],
  "products:delete": [CacheGroupType.CRITICAL, CacheGroupType.DEFERRED],

  // Category actions
  "categories:create": [CacheGroupType.CRITICAL],
  "categories:update": [CacheGroupType.CRITICAL],
  "categories:delete": [CacheGroupType.CRITICAL],

  // Carousel actions
  "carousel:create": [CacheGroupType.CRITICAL],
  "carousel:update": [CacheGroupType.CRITICAL],
  "carousel:delete": [CacheGroupType.CRITICAL],

  // Feature cards
  "feature_cards:create": [CacheGroupType.CRITICAL],
  "feature_cards:update": [CacheGroupType.CRITICAL],
  "feature_cards:delete": [CacheGroupType.CRITICAL],

  // Premium experiences
  "premium_experiences:create": [CacheGroupType.DEFERRED],
  "premium_experiences:update": [CacheGroupType.DEFERRED],
  "premium_experiences:delete": [CacheGroupType.DEFERRED],

  // Product showcase
  "product_showcase:create": [CacheGroupType.DEFERRED],
  "product_showcase:update": [CacheGroupType.DEFERRED],
  "product_showcase:delete": [CacheGroupType.DEFERRED],

  // Flash sale
  "flash_sale:create": [CacheGroupType.DEFERRED],
  "flash_sale:update": [CacheGroupType.DEFERRED],
  "flash_sale:delete": [CacheGroupType.DEFERRED],

  // Contact CTA
  "contact_cta:create": [CacheGroupType.HOMEPAGE],
  "contact_cta:update": [CacheGroupType.HOMEPAGE],
  "contact_cta:delete": [CacheGroupType.HOMEPAGE],

  // Top bar
  "topbar:create": [CacheGroupType.CRITICAL],
  "topbar:update": [CacheGroupType.CRITICAL],
  "topbar:delete": [CacheGroupType.CRITICAL],

  // Footer
  "footer:create": [CacheGroupType.HOMEPAGE],
  "footer:update": [CacheGroupType.HOMEPAGE],
  "footer:delete": [CacheGroupType.HOMEPAGE],

  // Side panels
  "side_panels:create": [CacheGroupType.HOMEPAGE],
  "side_panels:update": [CacheGroupType.HOMEPAGE],
  "side_panels:delete": [CacheGroupType.HOMEPAGE],

  // Theme
  "theme:update": [CacheGroupType.HOMEPAGE],

  // Brands
  "brands:create": [CacheGroupType.DEFERRED],
  "brands:update": [CacheGroupType.DEFERRED],
  "brands:delete": [CacheGroupType.DEFERRED],

  // Inventory
  "inventory:update": [CacheGroupType.HOMEPAGE],
}
