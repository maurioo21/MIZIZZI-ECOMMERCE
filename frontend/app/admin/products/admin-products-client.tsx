"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { adminService } from "@/services/admin"
import { useAdminAuth } from "@/contexts/admin/auth-context"
import { useMobile } from "@/hooks/use-mobile"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { imageBatchService } from "@/services/image-batch-service"
import { websocketService } from "@/services/websocket"
import type { Product } from "@/types"
import { ProductRow } from "@/components/admin/product-row"
import { ProductCard } from "@/components/admin/product-card"
import { ProductList } from "@/components/admin/product-list"
import { Button } from "@/components/ui/button"
import {
  Package,
  Star,
  Zap,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Sparkles,
  DollarSign,
  TrendingUp,
  Crown,
  Search,
  Filter,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Upload,
  Plus,
  XCircle,
  Percent,
  AlertCircle,
  PieChart,
} from "lucide-react"

// Define the filter and sort options
type SortOption =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "price_high"
  | "price_low"
  | "stock_high"
  | "stock_low"
  | "sales_high"
  | "sales_low"
  | "rating_high"
  | "rating_low"
  | "views_high"
  | "views_low"
  | "profit_high"
  | "profit_low"
type FilterOption =
  | "all"
  | "in_stock"
  | "out_of_stock"
  | "featured"
  | "on_sale"
  | "new"
  | "flash_sale"
  | "luxury_deal"
  | "trending"
  | "low_stock"
  | "high_performing"
  | "needs_attention"
  | "draft"
  | "archived"
type ViewMode = "list" | "grid" | "analytics" // Added grid and analytics to ViewMode

// Product Type (Redeclared, removed to avoid lint error)
// interface Product {
//   id: number | string
//   name: string
//   slug?: string
//   category?: { id: string | number; name: string } | string
//   category_id?: string | number
//   price: number
//   sale_price?: number | null
//   stock?: number
//   is_featured?: boolean
//   is_new?: boolean
//   is_sale?: boolean
//   is_flash_sale?: boolean
//   is_luxury_deal?: boolean
//   image_urls?: string[]
//   thumbnail_url?: string | null
//   description?: string
//   short_description?: string
//   created_at?: string
//   updated_at?: string
//   brand?: { id: string | number; name: string } | string
//   sku?: string
//   weight?: number
//   dimensions?: { length: number; width: number; height: number }
//   tags?: string[]
//   seo_title?: string
//   seo_description?: string
//   meta_keywords?: string[]
//   rating?: number
//   review_count?: number
//   total_sales?: number
//   views?: number
//   wishlist_count?: number
//   conversion_rate?: number
//   profit_margin?: number
//   cost_price?: number
//   supplier?: string
//   warranty?: string
//   return_policy?: string
//   shipping_class?: string
//   tax_class?: string
//   status?: "active" | "inactive" | "draft" | "archived"
//   visibility?: "public" | "private" | "password_protected"
//   featured_image?: string
//   gallery_images?: string[]
//   video_url?: string
//   downloadable?: boolean
//   virtual?: boolean
//   manage_stock?: boolean
//   stock_status?: "in_stock" | "out_of_stock" | "on_backorder"
//   backorders?: "no" | "notify" | "yes"
//   low_stock_threshold?: number
//   sold_individually?: boolean
//   purchase_note?: string
//   menu_order?: number
//   cross_sell_ids?: string[]
//   upsell_ids?: string[]
//   grouped_products?: string[]
//   external_url?: string
//   button_text?: string
//   attributes?: Array<{
//     name: string
//     value: string
//     visible: boolean
//     variation: boolean
//   }>
//   variations?: Array<{
//     id: string
//     attributes: Record<string, string>
//     price: number
//     sale_price?: number
//     stock?: number
//     image?: string
//   }>
//   // New properties for updated ProductStats calculation
//   stock_quantity?: number
//   discount_percentage?: number
//   // Added properties for the new table view
//   category_name?: string
//   compare_at_price?: number
// }

// Categories Type (Redeclared, removed to avoid lint error)
// interface Category {
//   id: number | string
//   name: string
//   slug?: string
// }

interface ProductStats {
  totalProducts: number
  inStock: number
  outOfStock: number
  lowStock: number
  onSale: number
  featured: number
  newProducts: number
  totalInventoryValue: number
  averagePrice: number
  categoriesCount: number
  luxuryDeal: number // Added luxuryDeal to ProductStats
}

const LoadingOverlay = ({ message }: { message: string }) => (
  <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-50 flex items-center justify-center">
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 flex flex-col items-center gap-6 max-w-sm mx-4">
      <div className="relative">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        <div
          className="absolute inset-0 w-12 h-12 border-3 border-transparent border-r-blue-500 rounded-full animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
        />
      </div>
      <div className="text-center">
        <p className="text-gray-900 font-semibold text-lg">{message}</p>
        <p className="text-gray-500 text-sm mt-1">Please wait...</p>
      </div>
    </div>
  </div>
)

const MiniSpinner = () => (
  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
)

const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = "bg-blue-500",
}: {
  title: string
  value: string | number
  subtitle: string
  icon: any
  colorClass?: string
}) => (
  <div className={`${colorClass} rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-200 text-white`}>
    <div className="flex items-start justify-between mb-3">
      <div className="p-2 bg-white/20 rounded-lg">
        <Icon className="h-4 w-4 text-white" strokeWidth={1.5} />
      </div>
    </div>
    <div className="space-y-1">
      <p className="text-xs font-medium text-white/85 uppercase tracking-wide">{title}</p>
      <p className="text-lg sm:text-xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-white/70">{subtitle}</p>
    </div>
  </div>
)

const EnhancedProductCard = ({
  product,
  isSelected,
  onSelect,
  onEdit,
  onView,
  onDelete,
}: {
  product: Product
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onView: () => void
  onDelete: () => void
}) => (
  <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm hover:shadow-md">
    <div className="relative aspect-square bg-gray-50">
      <OptimizedImage
        src={product.thumbnail_url || product.featured_image || "/placeholder.svg?height=300&width=300&query=product"}
        alt={product.name}
        className="w-full h-full object-cover"
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Package className="h-16 w-16 text-gray-400" />
          </div>
        }
      />

      {/* Selection checkbox */}
      <div className="absolute top-3 right-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="bg-white border-gray-300 shadow"
        />
      </div>

      {/* Status badges */}
      <div className="absolute top-3 left-3 flex flex-col gap-1">
        {product.is_featured && (
          <Badge className="bg-blue-500 text-white rounded-full text-xs px-2 py-0.5">
            <Star className="h-2.5 w-2.5 mr-0.5 fill-current" /> Featured
          </Badge>
        )}
        {product.is_flash_sale && (
          <Badge className="bg-amber-500 text-white rounded-full text-xs px-2 py-0.5">
            <Zap className="h-2.5 w-2.5 mr-0.5" /> Flash Sale
          </Badge>
        )}
      </div>
    </div>

    <div className="p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 line-clamp-2 text-sm">{product.name}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onView} className="text-xs">
                <Eye className="mr-2 h-3 w-3" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit} className="text-xs">
                <Edit className="mr-2 h-3 w-3" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pricing */}
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900">KSh {product.price?.toLocaleString() || 0}</div>
        {product.sale_price && product.sale_price < product.price && (
          <div className="text-xs text-gray-500 line-through">KSh {product.sale_price?.toLocaleString()}</div>
        )}
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-medium text-gray-900">{product.total_sales || 0}</div>
          <div className="text-gray-500">Sales</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-medium text-gray-900">{product.stock || 0}</div>
          <div className="text-gray-500">Stock</div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-1">
        {(product.stock || 0) > 0 ? (
          <Badge className="bg-green-50 text-green-700 text-xs rounded">In Stock</Badge>
        ) : (
          <Badge className="bg-red-50 text-red-700 text-xs rounded">Out of Stock</Badge>
        )}
      </div>
    </div>
  </div>
)

interface AdminProductsClientProps {
  initialProducts: Product[]
}

export default function AdminProductsClient({ initialProducts }: AdminProductsClientProps) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAdminAuth()
  const isMobile = useMobile()

  // Consolidated state management - reduced from 16+ to 8 main state objects
  // Separate search input state from filter state for better debouncing
  const [searchInput, setSearchInput] = useState("")
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  // Combined UI state
  const [uiState, setUiState] = useState({
    viewMode: "list" as "list" | "grid" | "analytics",
    isFilterSheetOpen: false,
    isRefreshing: false,
    isLoading: false,
    isDeleting: false,
    isLoadingCategories: true,
    isFilterActive: false,
    activeTab: "all",
  })

  // Combined filter/search state
  const [filterState, setFilterState] = useState({
    debouncedSearchQuery: "",
    sortOption: "newest" as SortOption,
    filterOption: "all" as FilterOption,
    categoryFilter: null as number | null,
    pageSize: isMobile ? 8 : 10,
  })

  // Combined dialog state
  const [dialogState, setDialogState] = useState({
    productToDelete: null as string | null,
    errorMessage: null as string | null,
    operationMessage: "",
    operationType: null as "refresh" | "fetch_images" | "bulk" | null,
    isBulkDeleteDialogOpen: false,
  })

  // Image and loading states
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [itemLoadingStates, setItemLoadingStates] = useState<Record<string, boolean>>({})

  // Auto-switch to list view on mobile
  useEffect(() => {
    if (isMobile && uiState.viewMode === "grid") {
      setUiState(prev => ({ ...prev, viewMode: "list" }))
    } else if (!isMobile && uiState.viewMode === "list" && !searchInput) {
      // Optional: switch back to grid on desktop (only if grid is preferred)
      // setUiState(prev => ({ ...prev, viewMode: "grid" }))
    }
  }, [isMobile])

  // Debounce search input (using ref for proper debouncing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterState(prev => ({ ...prev, debouncedSearchQuery: searchInput }))
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterState.debouncedSearchQuery, filterState.sortOption, filterState.filterOption, filterState.categoryFilter, uiState.activeTab])

  // Set page size based on screen size
  useEffect(() => {
    setFilterState(prev => ({ ...prev, pageSize: isMobile ? 8 : 10 }))
  }, [isMobile])

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login")
    }
  }, [isAuthenticated, authLoading, router])

  // Fetch categories - only after authentication
  useEffect(() => {
    const fetchCategories = async () => {
      // Only fetch if authenticated and not already loading
      if (!isAuthenticated || authLoading) return
      
      try {
        setUiState((prev) => ({ ...prev, isLoadingCategories: true }))
        const response = await adminService.getCategories({ per_page: 10000 })
        if (response && response.items) {
          setCategories(Array.isArray(response.items) ? response.items : [])
        }
      } catch (error) {
        // Silently handle errors (categories are optional)
        console.debug("Failed to fetch categories:", error instanceof Error ? error.message : "Unknown error")
        setCategories([])
      } finally {
        setUiState(prev => ({ ...prev, isLoadingCategories: false }))
      }
    }

    fetchCategories()
  }, [isAuthenticated, authLoading])

  // Memoized product filtering and sorting - compute derived values efficiently
  const filteredProducts = useMemo(() => {
    let result = [...allProducts]

    // Apply search filter
    if (filterState.debouncedSearchQuery) {
      const query = filterState.debouncedSearchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query),
      )
    }

    // Apply status filter
    switch (filterState.filterOption) {
      case "in_stock":
        result = result.filter((p) => (p.stock || 0) > 0)
        break
      case "out_of_stock":
        result = result.filter((p) => (p.stock || 0) <= 0)
        break
      case "featured":
        result = result.filter((p) => p.is_featured)
        break
      case "on_sale":
        result = result.filter((p) => p.is_sale)
        break
      case "new":
        result = result.filter((p) => p.is_new)
        break
      case "low_stock":
        result = result.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= 10)
        break
      case "draft":
        result = result.filter((p) => p.status === "draft")
        break
    }

    // Apply category filter
    if (filterState.categoryFilter) {
      result = result.filter((p) => p.category_id === filterState.categoryFilter)
    }

    // Apply sorting
    switch (filterState.sortOption) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        break
      case "oldest":
        result.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        break
      case "name_asc":
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "name_desc":
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case "price_high":
        result.sort((a, b) => b.price - a.price)
        break
      case "price_low":
        result.sort((a, b) => a.price - b.price)
        break
      case "stock_high":
        result.sort((a, b) => (b.stock || 0) - (a.stock || 0))
        break
      case "stock_low":
        result.sort((a, b) => (a.stock || 0) - (b.stock || 0))
        break
    }

    return result
  }, [
    allProducts,
    filterState.debouncedSearchQuery,
    filterState.filterOption,
    filterState.categoryFilter,
    filterState.sortOption,
  ])

  // Calculate stats from filtered products
  const productStats = useMemo(() => {
    const stats: ProductStats = {
      totalProducts: allProducts.length,
      inStock: allProducts.filter((p) => (p.stock || 0) > 0).length,
      outOfStock: allProducts.filter((p) => (p.stock || 0) <= 0).length,
      lowStock: allProducts.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= 10).length,
      onSale: allProducts.filter((p) => p.is_sale).length,
      featured: allProducts.filter((p) => p.is_featured).length,
      newProducts: allProducts.filter((p) => p.is_new).length,
      totalInventoryValue: allProducts.reduce((sum, p) => sum + (p.price || 0) * ((p.stock || 0) as number), 0),
      averagePrice: allProducts.length > 0 ? allProducts.reduce((sum, p) => sum + (p.price || 0), 0) / allProducts.length : 0,
      categoriesCount: categories.length,
      luxuryDeal: allProducts.filter((p) => p.is_luxury_deal).length,
    }
    return stats
  }, [allProducts, categories.length]) // Added categories.length as dependency

  const fetchProductImages = useCallback(async (products: Product[]) => {
    if (!products.length) return

    console.log("[v0] Starting to fetch images for", products.length, "products")

    // Get product IDs that need images
    const productIds = products.map((p) => p.id.toString())

    // Use imageBatchService to prefetch all images (this handles batching and caching)
    imageBatchService.prefetchProductImages(productIds)

    // Also fetch images individually and update state as we go for immediate feedback
    const newImages: Record<string | number, string> = {}

    // Process in smaller batches to update UI incrementally
    const batchSize = 5
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (product) => {
          try {
            // First check if imageBatchService already has cached images
            const cachedImages = imageBatchService.getCachedImages(product.id.toString())

            if (cachedImages && cachedImages.length > 0) {
              const primaryImage = cachedImages.find((img: any) => img.is_primary)
              const selectedImage = primaryImage || cachedImages[0]
              if (selectedImage && selectedImage.url) {
                newImages[product.id] = selectedImage.url
                console.log(`[v0] Got cached image for product ${product.id}: ${selectedImage.url}`)
              }
            } else {
              // Fetch from imageBatchService (which handles API calls and caching)
              const images = await imageBatchService.fetchProductImages(product.id.toString())

              if (images && images.length > 0) {
                const primaryImage = images.find((img: any) => img.is_primary)
                const selectedImage = primaryImage || images[0]
                if (selectedImage && selectedImage.url) {
                  newImages[product.id] = selectedImage.url
                  console.log(`[v0] Fetched image for product ${product.id}: ${selectedImage.url}`)
                }
              }
            }
          } catch (error) {
            console.error(`[v0] Error fetching images for product ${product.id}:`, error)
          }
        }),
      )

      // Update state after each batch for incremental loading
      if (Object.keys(newImages).length > 0) {
        setProductImages((prev) => ({ ...prev, ...newImages }))
      }
    }

    console.log("[v0] Finished fetching images for", Object.keys(newImages).length, "products")
  }, [])

  const fetchProducts = useCallback(async () => {
    // Renamed from fetchAllProducts
    if (!isAuthenticated) return

    try {
      setUiState((prev) => ({ ...prev, isLoading: true }))
      setDialogState((prev) => ({ ...prev, errorMessage: null }))

      // Fetch all products with a very large limit
      console.log("Fetching all products from database...")
      const response = await adminService.getProducts({ per_page: 10000 })

      const fetchedProducts = response.items || []
      console.log(`Successfully fetched ${fetchedProducts.length} products from database`)

      setAllProducts(fetchedProducts)
      // productStats will be computed by useMemo from the fetched products

      // Fetch images for the products (in batches to avoid too many requests)
      if (fetchedProducts.length > 0) {
        // setOperationLoading({ type: "fetch_images", message: "Loading product images..." })

        try {
          // Pass the actual product objects to fetchProductImages
          await fetchProductImages(fetchedProducts)
        } finally {
          // setOperationLoading({ type: null, message: "" })
        }
      }

      // Removed analytics fetching as it's no longer used
    } catch (error: any) {
      console.error("Error fetching products:", error)
      setDialogState((prev) => ({ ...prev, errorMessage: error.message || "Failed to load products. Please try again." }))
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUiState((prev) => ({ ...prev, isLoading: false, isRefreshing: false }))
    }
  }, [isAuthenticated, fetchProductImages])

  // Fetch products when authenticated - REMOVED since data is passed as props for SSR
  // useEffect(() => {
  //   if (isAuthenticated) {
  //     fetchProducts() // Use the renamed function
  //   }
  // }, [isAuthenticated, fetchProducts])

  useEffect(() => {
    if (!isAuthenticated) return

    const handleWebSocketProductUpdate = async (data: any) => {
      const productId = data.product_id || data.productId
      const eventType = data.type || data.event_type || data.action

      // Skip refetch for delete events — already handled client-side by handleDeleteProductFromList
      if (eventType === "delete" || eventType === "deleted" || eventType === "product_deleted") {
        if (productId) {
          setProductImages((prev) => {
            const updated = { ...prev }
            delete updated[productId]
            return updated
          })
          imageBatchService.invalidateCache(productId)
        }
        return
      }

      if (productId) {
        setProductImages((prev) => {
          const updated = { ...prev }
          delete updated[productId]
          return updated
        })

        imageBatchService.invalidateCache(productId)

        if (typeof localStorage !== "undefined") {
          try {
            localStorage.removeItem(`product_images_${productId}`)
          } catch (error) {
            // Ignore localStorage errors
          }
        }
      }

      // Wait a moment for backend to finish processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Refetch all products to get updated data
      await fetchProducts()
    }

    // Subscribe to WebSocket product_update events
    const unsubscribe = websocketService.on("product_update", handleWebSocketProductUpdate)

    return () => {
      unsubscribe()
    }
  }, [isAuthenticated])

  // Add event listener for product image updates
  useEffect(() => {
    const handleProductImagesUpdated = async (event: Event) => {
      const customEvent = event as CustomEvent<any>
      const { productId } = customEvent.detail || {}

      if (productId) {
        setProductImages((prev) => {
          const updated = { ...prev }
          delete updated[productId]
          return updated
        })

        imageBatchService.invalidateCache(productId)

        if (typeof localStorage !== "undefined") {
          try {
            localStorage.removeItem(`product_images_${productId}`)
          } catch (error) {
            // Ignore localStorage errors
          }
        }
      }

      // Wait a moment for backend to process image update
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Refetch all products to get updated data
      await fetchProducts()
    }
    window.addEventListener("productImagesUpdated", handleProductImagesUpdated)

    return () => {
      window.removeEventListener("productImagesUpdated", handleProductImagesUpdated)
    }
  }, [])

  // Calculate total pages
  const totalPages = Math.ceil(filteredProducts.length / filterState.pageSize)

  // Helper functions
  const getProductImage = (product: Product): string => {
    // First check cached images from state
    if (productImages[product.id]) {
      return productImages[product.id]
    }
    
    // Then check product.thumbnail_url
    if (product.thumbnail_url) {
      return product.thumbnail_url
    }
    
    // Check product.image_urls array
    if (product.image_urls && Array.isArray(product.image_urls) && product.image_urls.length > 0) {
      return product.image_urls[0]
    }
    
    // Check product.images array
    if (product.images && product.images.length > 0) {
      const firstImage = product.images[0]
      if (typeof firstImage === "string") {
        return firstImage
      }
      // handle { url: string } style image objects
      return (firstImage && (firstImage as any).url) || "/placeholder-product.png"
    }
    
    return "/placeholder-product.png"
  }

  const getCategoryName = (categoryId?: number | null): string => {
    if (!categoryId) return "Uncategorized"
    const category = categories.find((c: any) => c.id === categoryId)
    return category?.name || "Uncategorized"
  }

  // Get stock status with color
  const getStockStatus = (stock?: number) => {
    if (stock === undefined || stock <= 0) {
      return { label: "Out of Stock", color: "text-destructive bg-destructive/10 border-destructive/20" }
    } else if (stock < 10) {
      return { label: `Low: ${stock}`, color: "text-amber-600 bg-amber-50 border-amber-200" }
    } else {
      return { label: `${stock}`, color: "text-emerald-600 bg-emerald-50 border-emerald-200" }
    }
  }

  // Handle pagination
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  // Generate pagination items
  const getPaginationItems = () => {
    const items = []
    const maxVisiblePages = isMobile ? 3 : 5

    // Always show first page
    items.push(1)

    // Calculate range of pages to show
    let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3)

    // Adjust if we're near the beginning
    if (startPage === 2) {
      endPage = Math.min(totalPages - 1, maxVisiblePages - 1)
    }

    // Adjust if we're near the end
    if (endPage === totalPages - 1) {
      startPage = Math.max(2, totalPages - maxVisiblePages + 2)
    }

    // Add ellipsis after first page if needed
    if (startPage > 2) {
      items.push("ellipsis-start")
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      items.push(i)
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      items.push("ellipsis-end")
    }

    // Always show last page if there is more than one page
    if (totalPages > 1) {
      items.push(totalPages)
    }

    return items
  }

  // Check if any filters are active
  useEffect(() => {
    const isActive =
      filterState.debouncedSearchQuery !== "" ||
      uiState.activeTab !== "all" ||
      filterState.filterOption !== "all" ||
      filterState.categoryFilter !== null ||
      filterState.sortOption !== "newest"

    setUiState((prev: typeof uiState) => ({ ...prev, isFilterActive: isActive }))
  }, [filterState.debouncedSearchQuery, uiState.activeTab, filterState.filterOption, filterState.categoryFilter, filterState.sortOption])

  // Handler functions
  const handleRefresh = useCallback(async () => {
    setUiState((prev) => ({ ...prev, isRefreshing: true }))
    try {
      await fetchProducts()
      toast({
        title: "Success",
        description: "Products refreshed successfully.",
      })
    } finally {
      setUiState((prev) => ({ ...prev, isRefreshing: false }))
    }
  }, [fetchProducts])

  const handleFilterChange = useCallback((field: string, value: any) => {
    setFilterState((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const handleToggleTab = useCallback((tab: string) => {
    setUiState((prev) => ({ ...prev, activeTab: tab }))
  }, [])

  const handleUIStateChange = useCallback((field: string, value: any) => {
    setUiState((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setSearchInput("")
    setFilterState((prev) => ({
      ...prev,
      debouncedSearchQuery: "",
      filterOption: "all",
      categoryFilter: null,
      sortOption: "newest",
      pageSize: isMobile ? 8 : 10,
    }))
    setUiState((prev) => ({ ...prev, activeTab: "all" }))
    setCurrentPage(1)
  }, [isMobile])

  const handleSelectProduct = useCallback(
    (productId: string) => {
      setSelectedProducts((prev) =>
        prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
      )
    },
    []
  )

  const handleEditProduct = useCallback(
    (productId: string) => {
      router.push(`/admin/products/${productId}/edit`)
    },
    [router]
  )

  const handleViewProduct = useCallback(
    (productId: string) => {
      window.open(`/products/${productId}`, "_blank")
    },
    []
  )

  const handleOpenDeleteDialog = useCallback((productId: string) => {
    setDialogState((prev) => ({ ...prev, productToDelete: productId }))
  }, [])

  const handleCloseDeleteDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, productToDelete: null }))
  }, [])

  // Handle product deletion from ProductRow
  const handleDeleteProductFromList = useCallback((productId: string | number) => {
    const id = String(productId)
    
    // Remove product from all products list
    setAllProducts((prev) => prev.filter((p) => String(p.id) !== id))
    
    // Remove from selected products if it was selected
    setSelectedProducts((prev) => prev.filter((pId) => pId !== id))
    
    // Reset pagination if the current page would be empty after deletion
    setCurrentPage((prevPage) => {
      // Since we can't access allProducts here, we'll check if we need to go back
      // The ProductList will re-render with the filtered products anyway
      if (prevPage > 1) {
        return Math.max(1, prevPage - 1)
      }
      return prevPage
    })
  }, [filterState.pageSize])

  // Bulk delete selected products
  const handleBulkDelete = useCallback(async () => {
    if (selectedProducts.length === 0) {
      toast({ title: "No products selected", description: "Please select at least one product to delete" })
      return
    }

    setUiState((prev) => ({ ...prev, isBulkDeleteDialogOpen: true }))
  }, [selectedProducts.length])

  const confirmBulkDelete = useCallback(async () => {
    if (selectedProducts.length === 0) return

    try {
      setUiState((prev) => ({ ...prev, isDeleting: true, operationType: "bulk", operationMessage: "Deleting products..." }))

      // Delete each product
      for (const productId of selectedProducts) {
        await adminService.deleteProduct(productId)
      }

      // Remove from state
      setAllProducts((prev) =>
        prev.filter((p) => !selectedProducts.includes(p.id.toString()))
      )
      setSelectedProducts([])
      setUiState((prev) => ({ ...prev, isBulkDeleteDialogOpen: false, isDeleting: false, operationType: null }))

      toast({
        title: "Success",
        description: `${selectedProducts.length} product(s) deleted successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete products",
        variant: "destructive",
      })
      setUiState((prev) => ({ ...prev, isDeleting: false, operationType: null }))
    }
  }, [selectedProducts])

  const handleSelectAll = useCallback(() => {
    // Compute current page items directly to avoid referencing paginatedProducts (defined later)
    const startIndex = (currentPage - 1) * filterState.pageSize
    const endIndex = startIndex + filterState.pageSize
    const currentPageItems = filteredProducts.slice(startIndex, endIndex)

    if (selectedProducts.length === currentPageItems.length && selectedProducts.length > 0) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(currentPageItems.map((p) => p.id.toString()))
    }
  }, [selectedProducts.length, filteredProducts, currentPage, filterState.pageSize])

  // Duplicate handleSelectProduct removed — original definition is retained above.

  const handleDeleteProduct = useCallback(async () => {
    if (!dialogState.productToDelete) return

    try {
      setUiState((prev) => ({ ...prev, isDeleting: true }))
      await adminService.deleteProduct(dialogState.productToDelete)

      setAllProducts((prev) => prev.filter((p) => p.id?.toString() !== dialogState.productToDelete))

      toast({
        title: "Success",
        description: "Product deleted successfully.",
      })

      setDialogState((prev) => ({ ...prev, productToDelete: null }))
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete product",
        variant: "destructive",
      })
    } finally {
      setUiState((prev) => ({ ...prev, isDeleting: false }))
    }
  }, [dialogState.productToDelete])

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * filterState.pageSize
    const endIndex = startIndex + filterState.pageSize
    return filteredProducts.slice(startIndex, endIndex)
  }, [filteredProducts, currentPage, filterState.pageSize])

  return (
    <div className="min-h-screen bg-white p-2 sm:p-3 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-white rounded-lg p-3 sm:p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 text-xs sm:text-sm md:text-base mt-1">Manage your product catalog</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            {!isMobile && (
              <>
                <Button variant="outline" size="sm" className="rounded-lg text-xs h-8 sm:h-9">
                  <Download className="mr-1 h-3 md:h-4 w-3 md:w-4" />
                  <span className="hidden sm:inline text-xs md:text-sm">Export</span>
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg text-xs h-8 sm:h-9">
                  <Upload className="mr-1 h-3 md:h-4 w-3 md:w-4" />
                  <span className="hidden sm:inline text-xs md:text-sm">Import</span>
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={uiState.isLoading}
              className="rounded-lg text-xs h-8 sm:h-9"
            >
              {uiState.isLoading ? <MiniSpinner /> : <RefreshCw className="h-3 md:h-4 w-3 md:w-4" />}
              <span className="ml-1 hidden sm:inline text-xs md:text-sm">Refresh</span>
            </Button>
            <Button
              onClick={() => router.push("/admin/products/new")}
              size="sm"
              className="rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs h-8 sm:h-9"
            >
              <Plus className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Add Product</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid - Responsive with vibrant colors */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <StatsCard
          title="Total Products"
          value={productStats?.totalProducts || 0}
          subtitle={`${productStats?.categoriesCount || 0} categories`}
          icon={Package}
          colorClass="bg-blue-600 hover:bg-blue-700"
        />
        <StatsCard
          title="In Stock"
          value={productStats?.inStock || 0}
          subtitle="Available products"
          icon={CheckCircle2}
          colorClass="bg-green-600 hover:bg-green-700"
        />
        <StatsCard
          title="Low Stock"
          value={productStats?.lowStock || 0}
          subtitle="Need attention"
          icon={AlertTriangle}
          colorClass="bg-amber-500 hover:bg-amber-600"
        />
        <StatsCard
          title="On Sale"
          value={productStats?.onSale || 0}
          subtitle={`${productStats?.featured || 0} featured`}
          icon={Tag}
          colorClass="bg-purple-600 hover:bg-purple-700"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-8">
        <StatsCard
          title="New Products"
          value={productStats?.newProducts || 0}
          subtitle="Recently added"
          icon={Sparkles}
          colorClass="bg-indigo-600 hover:bg-indigo-700"
        />
        <StatsCard
          title="Inventory Value"
          value={`KSh ${(productStats?.totalInventoryValue || 0).toLocaleString()}`}
          subtitle="Total stock value"
          icon={DollarSign}
          colorClass="bg-emerald-600 hover:bg-emerald-700"
        />
        <StatsCard
          title="Average Price"
          value={`KSh ${(productStats?.averagePrice || 0).toLocaleString()}`}
          subtitle="Per product"
          icon={TrendingUp}
          colorClass="bg-rose-600 hover:bg-rose-700"
        />
        <StatsCard
          title="Luxury Deals"
          value={productStats?.luxuryDeal || 0}
          subtitle="Exclusive offers"
          icon={Crown}
          colorClass="bg-cyan-600 hover:bg-cyan-700"
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 w-80 rounded-full border-gray-200 focus:border-gray-300"
                />
              </div>
              <Sheet open={uiState.isFilterSheetOpen} onOpenChange={(open) => setUiState((prev) => ({ ...prev, isFilterSheetOpen: open }))}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "rounded-full border-gray-200 hover:bg-gray-50 transition-all duration-200",
                      uiState.isFilterActive && "bg-blue-50 border-blue-200 text-blue-700",
                    )}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filters{" "}
                    {uiState.isFilterActive &&
                      `(${Object.values({ searchQuery: filterState.debouncedSearchQuery, filterOption: filterState.filterOption, categoryFilter: filterState.categoryFilter }).filter(Boolean).length})`}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-96">
                  <SheetHeader>
                    <SheetTitle className="text-xl font-semibold">Filter Products</SheetTitle>
                    <SheetDescription className="text-gray-600">
                      Apply filters to narrow down your product list
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6 space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Category</h3>
                      <Select
                        value={filterState.categoryFilter?.toString() || "all"}
                        onValueChange={(value) => handleFilterChange("categoryFilter", value === "all" ? null : Number.parseInt(value))}
                      >
                        <SelectTrigger className="w-full rounded-full border-gray-200">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Product Status</h3>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-in-stock"
                            checked={uiState.activeTab === "in_stock"}
                            onCheckedChange={() => {
                              const newTab = uiState.activeTab === "in_stock" ? "all" : "in_stock"
                              setUiState((prev) => ({ ...prev, activeTab: newTab }))
                              handleFilterChange("filterOption", newTab === "all" ? "all" : "in_stock")
                            }}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-in-stock" className="ml-2 text-sm text-gray-700">
                            In Stock
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-out-of-stock"
                            checked={uiState.activeTab === "out_of_stock"}
                            onCheckedChange={() => handleToggleTab("out_of_stock")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-out-of-stock" className="ml-2 text-sm text-gray-700">
                            Out of Stock
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-featured"
                            checked={uiState.activeTab === "featured"}
                            onCheckedChange={() => handleToggleTab("featured")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-featured" className="ml-2 text-sm text-gray-700">
                            Featured
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-on-sale"
                            checked={uiState.activeTab === "on_sale"}
                            onCheckedChange={() => handleToggleTab("on_sale")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-on-sale" className="ml-2 text-sm text-gray-700">
                            On Sale
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-new"
                            checked={uiState.activeTab === "new"}
                            onCheckedChange={() => handleToggleTab(uiState.activeTab === "new" ? "all" : "new")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-new" className="ml-2 text-sm text-gray-700">
                            New Arrivals
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-flash-sale"
                            checked={uiState.activeTab === "flash_sale"}
                            onCheckedChange={() => handleToggleTab(uiState.activeTab === "flash_sale" ? "all" : "flash_sale")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-flash-sale" className="ml-2 text-sm text-gray-700">
                            Flash Sale
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-luxury-deal"
                            checked={uiState.activeTab === "luxury_deal"}
                            onCheckedChange={() => handleToggleTab(uiState.activeTab === "luxury_deal" ? "all" : "luxury_deal")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-50 text-purple-700 border border-purple-200">
                            <Crown className="h-3 w-3 mr-1" /> Luxury Deals ({productStats?.luxuryDeal || 0})
                          </Badge>
                          <Checkbox
                            checked={uiState.activeTab === "luxury_deal"}
                            onCheckedChange={() => handleToggleTab(uiState.activeTab === "trending" ? "all" : "trending")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-trending" className="ml-2 text-sm text-gray-700">
                            Trending
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-low-stock"
                            checked={uiState.activeTab === "low_stock"}
                            onCheckedChange={() => handleToggleTab(uiState.activeTab === "low_stock" ? "all" : "low_stock")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-low-stock" className="ml-2 text-sm text-gray-700">
                            Low Stock
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-high-performing"
                            checked={uiState.activeTab === "high_performing"}
                            onCheckedChange={() =>
                              handleToggleTab(uiState.activeTab === "high_performing" ? "all" : "high_performing")
                            }
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-high-performing" className="ml-2 text-sm text-gray-700">
                            High Performing
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-needs-attention"
                            checked={uiState.activeTab === "needs_attention"}
                            onCheckedChange={() =>
                              handleToggleTab(uiState.activeTab === "needs_attention" ? "all" : "needs_attention")
                            }
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-needs-attention" className="ml-2 text-sm text-gray-700">
                            Needs Attention
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-draft"
                            checked={uiState.activeTab === "draft"}
                            onCheckedChange={() => handleToggleTab(uiState.activeTab === "draft" ? "all" : "draft")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-draft" className="ml-2 text-sm text-gray-700">
                            Draft
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="filter-archived"
                            checked={uiState.activeTab === "archived"}
                            onCheckedChange={() => handleToggleTab(uiState.activeTab === "archived" ? "all" : "archived")}
                            className="h-4 w-4 rounded-md border-gray-300"
                          />
                          <label htmlFor="filter-archived" className="ml-2 text-sm text-gray-700">
                            Archived
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Sort By</h3>
                      <Select value={filterState.sortOption} onValueChange={(value: SortOption) => handleFilterChange("sortOption", value)}>
                        <SelectTrigger className="w-full rounded-full border-gray-200">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                          <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                          <SelectItem value="price_high">Price (High to Low)</SelectItem>
                          <SelectItem value="price_low">Price (Low to High)</SelectItem>
                          <SelectItem value="stock_high">Stock (High to Low)</SelectItem>
                          <SelectItem value="stock_low">Stock (Low to High)</SelectItem>
                          <SelectItem value="sales_high">Best Selling</SelectItem>
                          <SelectItem value="rating_high">Highest Rated</SelectItem>
                          <SelectItem value="profit_high">Most Profitable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SheetFooter className="gap-2 pt-4 border-t border-gray-100">
                    <Button variant="outline" onClick={resetFilters} className="rounded-full bg-transparent">
                      Reset Filters
                    </Button>
                    <SheetClose asChild>
                      <Button className="rounded-full bg-gray-900 hover:bg-gray-800">Apply Filters</Button>
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              {uiState.isFilterActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="rounded-full border-gray-200 hover:bg-gray-50 bg-transparent"
                >
                  <X className="h-4 w-4 mr-1" /> Clear Filters
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {selectedProducts.length > 0 && (
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
                  <Checkbox checked={true} className="h-4 w-4" onChange={handleSelectAll} title="Select all products on page" />
                  <span className="text-sm font-medium text-blue-900">{selectedProducts.length} selected</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProducts([])}
                    className="h-6 px-2 rounded-full"
                  >
                    Clear
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={uiState.isDeleting}
                    className="rounded-full"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete ({selectedProducts.length})
                  </Button>
                </div>
              )}

              <Select value={filterState.sortOption} onValueChange={(value: SortOption) => handleFilterChange("sortOption", value)}>
                <SelectTrigger className="w-[180px] rounded-full border-gray-200">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                  <SelectItem value="price_high">Price (High to Low)</SelectItem>
                  <SelectItem value="price_low">Price (Low to High)</SelectItem>
                  <SelectItem value="stock_high">Stock (High to Low)</SelectItem>
                  <SelectItem value="stock_low">Stock (Low to High)</SelectItem>
                  <SelectItem value="sales_high">Best Selling</SelectItem>
                  <SelectItem value="rating_high">Highest Rated</SelectItem>
                  <SelectItem value="profit_high">Most Profitable</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle - Hide grid/analytics on mobile */}
              <div className="flex items-center space-x-2">
                <Button
                  variant={uiState.viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUIStateChange("viewMode", "list")}
                  className="rounded-full"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                {/* Grid button - hidden on mobile */}
                <Button
                  variant={uiState.viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUIStateChange("viewMode", "grid")}
                  className="rounded-full hidden sm:inline-flex"
                >
                  <Package className="h-4 w-4" />
                </Button>
                {/* Analytics button - hidden on mobile */}
                <Button
                  variant={uiState.viewMode === "analytics" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUIStateChange("viewMode", "analytics")}
                  className="rounded-full hidden sm:inline-flex"
                >
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="all" value={uiState.activeTab} onValueChange={(value) => setUiState((prev) => ({ ...prev, activeTab: value }))}>
          <div className="px-6 py-4 border-b border-gray-100">
            <TabsList className="grid grid-cols-4 md:grid-cols-8 gap-1 bg-gray-50 p-1 rounded-2xl">
              {[
                { value: "all", label: "All", count: allProducts.length, icon: Package },
                { value: "in_stock", label: "In Stock", count: productStats?.inStock || 0, icon: CheckCircle2 },
                { value: "out_of_stock", label: "Out of Stock", count: productStats?.outOfStock || 0, icon: XCircle },
                { value: "featured", label: "Featured", count: productStats?.featured || 0, icon: Star },
                { value: "on_sale", label: "On Sale", count: productStats?.onSale || 0, icon: Percent },
                { value: "new", label: "New", count: productStats?.newProducts || 0, icon: Sparkles },
                { value: "trending", label: "Trending", count: 0, icon: TrendingUp }, // Placeholder count
                { value: "luxury_deal", label: "Luxury", count: productStats?.luxuryDeal || 0, icon: Crown }, // Use luxuryDeal count
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs md:text-sm rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2"
                >
                  <tab.icon className="h-3 w-3" />
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="md:hidden">{tab.label.slice(0, 3)}</span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {tab.count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="p-6">
            {dialogState.errorMessage ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertCircle className="h-16 w-16 text-red-500 mb-6" />
                <h3 className="text-2xl font-bold mb-3">Failed to load products</h3>
                <p className="text-gray-600 mb-6 max-w-md">{dialogState.errorMessage || "Failed to load products."}</p>
                <Button onClick={fetchProducts} className="rounded-full bg-gray-900 hover:bg-gray-800">
                  {" "}
                  {/* Use fetchProducts */}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="h-16 w-16 text-gray-400 mb-6" />
                <h3 className="text-2xl font-bold mb-3">No products found</h3>
                <p className="text-gray-600 mb-6 max-w-md">
                  {uiState.isFilterActive
                    ? "Try adjusting your filters to see more results"
                    : "Get started by adding your first product to the catalog"}
                </p>
                <div className="flex gap-3">
                  {uiState.isFilterActive && (
                    <Button variant="outline" onClick={resetFilters} className="rounded-full bg-transparent">
                      <X className="mr-2 h-4 w-4" />
                      Reset Filters
                    </Button>
                  )}
                  <Button
                    onClick={() => router.push("/admin/products/new")}
                    className="rounded-full bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Product
                  </Button>
                </div>
              </div>
            ) : uiState.viewMode === "analytics" ? (
              <div className="space-y-8">
                {/* Analytics dashboard content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="border-0 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Sales Performance
                      </CardTitle>
                      <CardDescription>Overview of your sales over time.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Chart component would go here */}
                      <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center">
                        <p className="text-gray-500">Sales chart visualization</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5" />
                        Category Distribution
                      </CardTitle>
                      <CardDescription>Breakdown of products by category.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center">
                        <p className="text-gray-500">Category chart visualization</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              // Responsive list view - use memoized paginatedProducts
              <ProductList
                products={paginatedProducts}
                selectedProducts={selectedProducts}
                viewMode={uiState.viewMode}
                isMobile={isMobile}
                productImages={productImages}
                onSelectProduct={handleSelectProduct}
                onDeleteProduct={handleDeleteProductFromList}
                getProductImage={getProductImage}
              />
            )}

            {/* Enhanced responsive pagination - compact on mobile */}
            {filteredProducts.length > 0 && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mt-3 sm:mt-8 pt-2 sm:pt-6 pb-2 sm:pb-0 border-t border-gray-100">
                {/* Info text - hidden on mobile, visible on sm+ */}
                <div className="hidden sm:block text-sm text-gray-600">
                  Showing <span className="font-semibold">{(currentPage - 1) * filterState.pageSize + 1}</span> to{" "}
                  <span className="font-semibold">{Math.min(currentPage * filterState.pageSize, filteredProducts.length)}</span> of{" "}
                  <span className="font-semibold">{filteredProducts.length}</span> products
                </div>

                {/* Mobile info - visible on mobile only */}
                <div className="sm:hidden text-xs text-gray-600 text-center w-full">
                  Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
                </div>

                {/* Pagination controls */}
                <div className="flex items-center justify-center sm:justify-end gap-1 sm:gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="rounded-lg h-7 w-7 sm:h-10 sm:w-10 sm:rounded-full p-0 text-xs sm:text-sm flex-shrink-0"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>

                  {/* Page numbers - hidden on mobile, visible on sm+ */}
                  <div className="hidden sm:flex gap-1">
                    {getPaginationItems().map((pageItem, index) =>
                      pageItem === "ellipsis-start" || pageItem === "ellipsis-end" ? (
                        <span
                          key={pageItem + index}
                          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm text-gray-500"
                        >
                          ...
                        </span>
                      ) : (
                        <Button
                          key={pageItem}
                          variant={currentPage === pageItem ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageItem as number)}
                          className="rounded-full w-8 h-8 sm:w-10 sm:h-10 p-0 text-xs sm:text-sm"
                        >
                          {pageItem}
                        </Button>
                      ),
                    )}
                  </div>

                  {/* Current page indicator - visible on mobile only */}
                  <div className="sm:hidden flex items-center justify-center h-7 min-w-7 rounded-lg bg-primary text-white text-xs font-semibold flex-shrink-0">
                    {currentPage}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="rounded-lg h-7 w-7 sm:h-10 sm:w-10 sm:rounded-full p-0 text-xs sm:text-sm flex-shrink-0"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            )}
        </div>
        </Tabs>
      </div>

      {/* Loading overlay - no AnimatePresence for better performance */}
      {dialogState.operationType && <LoadingOverlay message={dialogState.operationMessage || "Processing..."} />}
    </div>
  )
}
