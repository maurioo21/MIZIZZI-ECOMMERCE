import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { productService } from "@/services/product"

/**
 * Custom hook for managing explore/related products
 * Handles fetching, caching, and sorting
 */
export function useExploreProducts(product: any, similarProducts?: any[]) {
  const [exploreProducts, setExploreProducts] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache to avoid duplicate fetches
  const fetchCache = useRef<{ products: any[]; timestamp: number } | null>(null)
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  const fetchRelatedProducts = useCallback(async () => {
    if (!product?.id) return

    // Return cached results if still valid
    if (fetchCache.current && Date.now() - fetchCache.current.timestamp < CACHE_DURATION) {
      setExploreProducts(fetchCache.current.products.slice(0, 12))
      setHasMore(fetchCache.current.products.length > 12)
      return
    }

    // If we have similar products from props, use them
    if (similarProducts && similarProducts.length > 0) {
      const sliced = similarProducts.slice(0, 12)
      setExploreProducts(sliced)
      setHasMore(similarProducts.length > 12)

      // Cache the results
      fetchCache.current = { products: similarProducts, timestamp: Date.now() }
      return
    }

    // Only fetch if we don't already have enough cached
    if (exploreProducts.length >= 12) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let allProducts: any[] = []

      // First: Try to get products from the same category
      if (product?.category_id) {
        try {
          const categoryProducts = await productService.getProductsByCategory(String(product.category_id))
          allProducts = categoryProducts.filter((p: any) => p.id !== product.id)
        } catch (e) {
          console.error("[v0] Error fetching category products:", e)
        }
      }

      // If not enough from category, fetch more general products
      if (allProducts.length < 12) {
        try {
          const response = await fetch(`/api/products?limit=30&page=1`)
          const data = await response.json()

          // Safely extract products array
          let productsArray: any[] = []
          if (Array.isArray(data)) {
            productsArray = data
          } else if (Array.isArray(data?.products)) {
            productsArray = data.products
          } else if (Array.isArray(data?.items)) {
            productsArray = data.items
          } else if (Array.isArray(data?.data)) {
            productsArray = data.data
          }

          if (Array.isArray(productsArray)) {
            const generalProducts = productsArray.filter(
              (p: any) => p?.id && p.id !== product.id && !allProducts.some((ap: any) => ap.id === p.id),
            )
            allProducts = [...allProducts, ...generalProducts]
          }
        } catch (e) {
          console.error("[v0] Error fetching general products:", e)
          setError("Failed to load related products")
        }
      }

      // Smart sorting: by category match, then price similarity, then rating
      const sortedProducts = sortProducts(allProducts, product)

      // Cache results
      fetchCache.current = { products: sortedProducts, timestamp: Date.now() }

      setExploreProducts(sortedProducts.slice(0, 12))
      setHasMore(sortedProducts.length > 12)
    } catch (err) {
      console.error("[v0] Error fetching related products:", err)
      setError("Failed to load related products")
    } finally {
      setIsLoading(false)
    }
  }, [product?.id, product?.category_id, product?.price, product?.sale_price, similarProducts, exploreProducts.length])

  // Fetch on mount and when product changes
  useEffect(() => {
    if (product?.id) {
      fetchRelatedProducts()
    }
  }, [product?.id, fetchRelatedProducts])

  return {
    products: exploreProducts,
    hasMore,
    isLoading,
    error,
    refetch: fetchRelatedProducts,
  }
}

/**
 * Sort products by: category match > price similarity > rating
 */
function sortProducts(products: any[], referenceProduct: any): any[] {
  const productPrice = referenceProduct?.sale_price || referenceProduct?.price || 0

  return [...products].sort((a: any, b: any) => {
    // Priority 1: Category match
    const aCategoryMatch = a.category_id === referenceProduct?.category_id ? 1 : 0
    const bCategoryMatch = b.category_id === referenceProduct?.category_id ? 1 : 0
    if (aCategoryMatch !== bCategoryMatch) return bCategoryMatch - aCategoryMatch

    // Priority 2: Price similarity
    const aPriceDiff = Math.abs((a.sale_price || a.price || 0) - productPrice)
    const bPriceDiff = Math.abs((b.sale_price || b.price || 0) - productPrice)
    if (aPriceDiff !== bPriceDiff) return aPriceDiff - bPriceDiff

    // Priority 3: Rating
    return (b.rating || 0) - (a.rating || 0)
  })
}
