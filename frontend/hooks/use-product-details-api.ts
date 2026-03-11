"""
Hook to fetch product details from the optimized backend API with Redis caching
and Cloudinary image optimization.
"""
import useSWR from 'swr'
import type { ProductDetailResponse } from '../types/product'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface UseProductDetailsOptions {
  includeRelated?: boolean
  includeReviews?: boolean
  revalidateOnFocus?: boolean
}

export function useProductDetails(productId: number | string, options: UseProductDetailsOptions = {}) {
  const {
    includeRelated = true,
    includeReviews = false,
    revalidateOnFocus = false
  } = options

  const url = productId
    ? `${API_BASE_URL}/api/product-details/${productId}?include_related=${includeRelated}&include_reviews=${includeReviews}`
    : null

  const { data, error, isLoading, mutate } = useSWR<ProductDetailResponse>(
    url,
    async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch product details: ${response.statusText}`)
      }
      return response.json()
    },
    {
      revalidateOnFocus: revalidateOnFocus,
      revalidateOnReconnect: true,
      revalidateOnMount: true,
      dedupingInterval: 60000, // 1 minute
      focusThrottleInterval: 300000, // 5 minutes
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      shouldRetryOnError: true,
      fallbackData: undefined
    }
  )

  return {
    product: data?.data,
    isLoading,
    error,
    mutate,
    isError: !!error
  }
}

export function useProductImages(productId: number | string) {
  const url = productId ? `${API_BASE_URL}/api/product-details/${productId}/images` : null

  const { data, error, isLoading } = useSWR(
    url,
    async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch images')
      return response.json()
    },
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      dedupingInterval: 60000,
      focusThrottleInterval: 600000 // 10 minutes
    }
  )

  return {
    images: data?.images || [],
    isLoading,
    error
  }
}

export function useProductInventory(productId: number | string) {
  const url = productId ? `${API_BASE_URL}/api/product-details/${productId}/inventory` : null

  const { data, error, isLoading, mutate } = useSWR(
    url,
    async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch inventory')
      return response.json()
    },
    {
      revalidateOnFocus: true, // Always refresh inventory
      revalidateOnMount: true,
      dedupingInterval: 30000, // 30 seconds for real-time inventory
      focusThrottleInterval: 60000 // 1 minute
    }
  )

  return {
    inventory: data,
    isLoading,
    error,
    mutate
  }
}
