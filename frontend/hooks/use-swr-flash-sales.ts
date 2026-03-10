import useSWR, { type SWRConfiguration, mutate as globalMutate } from "swr"
import type { Product } from "@/types"
import { productService } from "@/services/product"
import { cloudinaryService } from "@/services/cloudinary-service"
import { quickFetchProducts, eagerPrefetchProducts } from "@/lib/cache/products-quick-fetch"

// Process product images
const processProducts = (products: Product[]): Product[] => {
  return products.map((product) => ({
    ...product,
    image_urls: (product.image_urls || []).map((url) => {
      if (typeof url === "string" && !url.startsWith("http")) {
        return cloudinaryService.generateOptimizedUrl(url)
      }
      return url
    }),
  }))
}

const flashSalesFetcher = async (): Promise<Product[]> => {
  try {
    // Try flash sales first, then fallback to sales products
    let products = await quickFetchProducts({
      limit: 12,
      flash_sale: true,
    })

    if (!products || products.length === 0) {
      console.log("[v0] No flash sale products found, fetching sale products as fallback")
      products = await productService.getProducts({
        limit: 12,
        sale: true,
        sort_by: "price",
        sort_order: "asc",
      })
    }

    const processed = processProducts(products || []).slice(0, 12)
    return processed
  } catch (error) {
    console.error("Error fetching flash sales:", error)
    throw error
  }
}

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000,
  focusThrottleInterval: 300000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  revalidateIfStale: true,
  keepPreviousData: true,
  refreshInterval: 0,
  shouldRetryOnError: true,
}

export function useFlashSales(config?: SWRConfiguration) {
  // Fetch fresh data from backend/Redis without frontend caching
  const { data, error, isLoading, isValidating, mutate } = useSWR<Product[]>("flash-sales", flashSalesFetcher, {
    ...defaultConfig,
    ...config,
  })

  return {
    flashSales: data || [],
    isLoading,
    isValidating,
    isError: error,
    mutate,
    hasCachedData: !!data,
  }
}

export async function prefetchFlashSales(): Promise<void> {
  try {
    await eagerPrefetchProducts({
      limit: 12,
      flash_sale: true,
    })

    const data = await flashSalesFetcher()
    await globalMutate("flash-sales", data, false)
  } catch (error) {
    console.warn("Failed to prefetch flash sales:", error)
  }
}

// Invalidate cache - useful when admin updates flash sales
export async function invalidateFlashSales(): Promise<void> {
  await globalMutate("flash-sales")
}

// Get cached flash sales without triggering fetch (returns null - no frontend cache)
export function getCachedFlashSales(): Product[] | null {
  return null
}
