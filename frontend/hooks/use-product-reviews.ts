import { useState, useEffect, useCallback, useRef } from "react"
import { reviewService, type Review, type ReviewSummary } from "@/services/review-service"
import { useToast } from "@/components/ui/use-toast"

/**
 * Custom hook for managing product reviews
 * Handles fetching, sorting, pagination, and optimistic updates
 */
export function useProductReviews(productId: number | undefined) {
  const { toast } = useToast()

  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest">("recent")
  const [likedReviews, setLikedReviews] = useState<Set<number>>(new Set())
  const [animatingReviews, setAnimatingReviews] = useState<Set<number>>(new Set())

  // Track pending requests to deduplicate
  const pendingFetch = useRef(false)

  const fetchReviews = useCallback(async () => {
    if (!productId || pendingFetch.current) return

    pendingFetch.current = true
    setError(null)
    setIsLoading(true)

    try {
      const [reviewsResponse, summaryResponse] = await Promise.all([
        reviewService.getProductReviews(Number(productId), {
          page: 1,
          per_page: showAllReviews ? 50 : 5,
          sort_by: sortBy === "recent" ? "created_at" : "rating",
          sort_order: sortBy === "lowest" ? "asc" : "desc",
        }),
        reviewService.getProductReviewSummary(Number(productId)),
      ])

      setReviews(reviewsResponse.items)
      setReviewSummary(summaryResponse)
    } catch (err: any) {
      console.error("[v0] Error fetching reviews:", err)
      setError(err?.message || "Failed to load reviews")
      setReviews([])
      setReviewSummary({
        total_reviews: 0,
        average_rating: 0,
        verified_reviews: 0,
        rating_distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
      })
    } finally {
      setIsLoading(false)
      pendingFetch.current = false
    }
  }, [productId, showAllReviews, sortBy])

  // Fetch reviews when productId changes or filters change
  useEffect(() => {
    if (productId) {
      fetchReviews()
    }
  }, [productId, fetchReviews])

  const handleMarkHelpful = useCallback(
    async (reviewId: number) => {
      if (animatingReviews.has(reviewId)) return

      setAnimatingReviews((prev) => new Set(prev).add(reviewId))

      const isCurrentlyLiked = likedReviews.has(reviewId)

      // Optimistic update
      setLikedReviews((prev) => {
        const newSet = new Set(prev)
        if (isCurrentlyLiked) {
          newSet.delete(reviewId)
        } else {
          newSet.add(reviewId)
        }
        return newSet
      })

      try {
        await reviewService.markReviewHelpful(reviewId)
        // Silently succeed - optimistic update is already applied
      } catch (err: any) {
        console.error("[v0] Error marking review helpful:", err)

        // Revert optimistic update on error
        setLikedReviews((prev) => {
          const newSet = new Set(prev)
          if (isCurrentlyLiked) {
            newSet.add(reviewId)
          } else {
            newSet.delete(reviewId)
          }
          return newSet
        })

        toast({
          title: "Error",
          description: err?.message || "Failed to mark review as helpful",
          variant: "destructive",
        })
      } finally {
        setTimeout(() => {
          setAnimatingReviews((prev) => {
            const newSet = new Set(prev)
            newSet.delete(reviewId)
            return newSet
          })
        }, 300)
      }
    },
    [likedReviews, animatingReviews, toast],
  )

  return {
    reviews,
    reviewSummary,
    isLoading,
    error,
    showAllReviews,
    setShowAllReviews,
    sortBy,
    setSortBy,
    likedReviews,
    animatingReviews,
    handleMarkHelpful,
    refetch: fetchReviews,
  }
}
