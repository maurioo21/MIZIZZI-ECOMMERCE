import { useState, useEffect, useCallback, useRef } from "react"
import { inventoryService } from "@/services/inventory-service"

interface InventoryData {
  available_quantity: number
  is_in_stock: boolean
  is_low_stock: boolean
  stock_status: "in_stock" | "low_stock" | "out_of_stock"
  last_updated?: string
}

/**
 * Custom hook for managing product inventory data
 * Deduplicates API calls and caches results
 */
export function useProductInventory(productId: number | undefined, variantId?: number) {
  const [inventoryData, setInventoryData] = useState<InventoryData>({
    available_quantity: 0,
    is_in_stock: false,
    is_low_stock: false,
    stock_status: "out_of_stock",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track in-flight requests to deduplicate
  const lastRequestKey = useRef<string>("")
  const lastFetchTime = useRef<number>(0)

  const fetchInventory = useCallback(async () => {
    if (!productId) return

    const requestKey = `${productId}-${variantId || "default"}`
    const now = Date.now()

    // Deduplicate: Skip if same request within 2 seconds
    if (requestKey === lastRequestKey.current && now - lastFetchTime.current < 2000) {
      return
    }

    lastRequestKey.current = requestKey
    lastFetchTime.current = now

    setError(null)
    setIsLoading(true)

    try {
      const summary = await inventoryService.getProductInventorySummary(productId, variantId)
      const available = summary.total_available_quantity ?? 0
      const stock_status: "in_stock" | "low_stock" | "out_of_stock" =
        available === 0 ? "out_of_stock" : summary.is_low_stock ? "low_stock" : "in_stock"

      setInventoryData({
        available_quantity: available,
        is_in_stock: !!summary.is_in_stock,
        is_low_stock: !!summary.is_low_stock,
        stock_status,
        last_updated: summary.items?.[0]?.last_updated,
      })
    } catch (err: any) {
      console.error("[v0] Error fetching inventory:", err)
      setError(err?.message || "Failed to load inventory")
    } finally {
      setIsLoading(false)
    }
  }, [productId, variantId])

  // Fetch on mount and when productId changes
  useEffect(() => {
    if (productId) {
      fetchInventory()
    }
  }, [productId, fetchInventory])

  return {
    inventoryData,
    isLoading,
    error,
    refetch: fetchInventory,
  }
}
