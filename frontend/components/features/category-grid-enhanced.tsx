"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import type { Category } from "@/lib/server/get-categories"
import { onCategoriesUpdated } from "@/lib/category-cache-utils"

interface CategoryGridProps {
  categories?: Category[]
}

const CategoryCard = ({
  category,
  index,
}: {
  category: Category
  index: number
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = category.image_url && category.image_url.trim() !== "" ? category.image_url : null

    useEffect(() => {
    if (!imageUrl) {
      setImageFailed(true)
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => setImageLoaded(true)
    img.onerror = () => {
      console.log("[v0] Image failed to load:", imageUrl)
      setImageFailed(true)
    }
    img.src = imageUrl

    // If image loads within 100ms, mark as loaded immediately
    const timeout = setTimeout(() => {
      if (!imageLoaded && !imageFailed) {
        // Image is taking too long, show it anyway (it will appear when ready)
        setImageLoaded(true)
      }
    }, 100)

    return () => clearTimeout(timeout)
  }, [imageUrl])

  return (
    <Link
      href={`/category/${category.slug}`}
      className="flex-shrink-0 min-w-[120px] sm:min-w-[150px] md:min-w-[180px] flex-1"
      prefetch={true}
    >
      <div className="group relative overflow-hidden rounded-lg w-full h-full bg-white shadow-sm hover:shadow-md hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200">
        <div className="aspect-square w-full overflow-hidden relative bg-gradient-to-br from-gray-200 to-gray-300">
          {imageUrl && !imageFailed && (
            <div
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-200"
              style={{
                backgroundImage: `url(${imageUrl})`,
                opacity: 1,
              }}
            />
          )}

          {(!imageUrl || imageFailed) && (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <img src="/logo.png" alt={category.name} className="w-full h-full object-contain opacity-50" />
            </div>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20 pointer-events-none" />

        {/* Category name */}
        <div className="absolute bottom-0 left-0 w-full p-2 sm:p-3">
          <h3 className="text-xs font-semibold text-white sm:text-sm md:text-base group-hover:text-cherry-200 transition-colors">
            {category.name}
          </h3>
          <div className="flex items-center text-xs text-white/90 mt-0.5 sm:mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Shop Now</span>
            <ArrowRight className="ml-1 h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  )
}

export function CategoryGrid({ categories = [] }: CategoryGridProps) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    // Listen for category cache updates from admin
    const unsubscribe = onCategoriesUpdated(() => {
      console.log("[v0] CategoryGrid: Categories updated event received, performing hard refresh...")
      // Wait a moment for all event listeners to process, then reload
      setTimeout(() => {
        console.log("[v0] CategoryGrid: Hard refreshing page with cache buster...")
        const currentUrl = window.location.pathname + window.location.search
        const separator = currentUrl.includes('?') ? '&' : '?'
        window.location.href = `${currentUrl}${separator}_cache_bust=${Date.now()}`
      }, 500)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (categories.length === 0) return
    
    console.log("[v0] CategoryGrid received", categories.length, "categories")
    console.log("[v0] First category:", categories[0])

    // Preload first 12 category images
    categories.slice(0, 12).forEach((category) => {
      if (category.image_url) {
        console.log("[v0] Preloading image for", category.name, ":", category.image_url)
        const link = document.createElement("link")
        link.rel = "preload"
        link.as = "image"
        link.href = category.image_url
        document.head.appendChild(link)
      }
    })
  }, [categories])

  const scrollCarousel = useCallback((direction: "left" | "right") => {
    if (!carouselRef.current) return
    const scrollAmount = carouselRef.current.clientWidth * 0.75
    const currentScroll = carouselRef.current.scrollLeft
    carouselRef.current.scrollTo({
      left: direction === "left" ? currentScroll - scrollAmount : currentScroll + scrollAmount,
      behavior: "smooth",
    })
  }, [])

  if (!categories || categories.length === 0) {
    return null
  }

  return (
    <div className="w-full max-w-full">
      <div className="bg-[#8B1538] py-3 sm:py-4 mb-3 sm:mb-4 sm:rounded-t-lg">
        <div className="flex items-center justify-between px-3 sm:px-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Shop By Category</h2>
          <Link
            href="/categories"
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs sm:text-sm font-medium transition-colors duration-200"
            prefetch={true}
          >
            <span>View All</span>
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </div>
      </div>

      <div className="relative px-1 sm:px-4 group overflow-hidden">
        <div
          ref={carouselRef}
          className="flex overflow-x-auto scrollbar-hide gap-2 sm:gap-3 md:gap-4 pb-3 sm:pb-4 w-full overscroll-x-contain max-w-full"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            scrollBehavior: "smooth",
          }}
        >
          {categories.map((category, index) => (
            <CategoryCard key={category.id || `category-${index}`} category={category} index={index} />
          ))}
        </div>

        {/* Left scroll button */}
        <button
          onClick={() => scrollCarousel("left")}
          className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-gray-50 hover:shadow-xl z-10"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5 text-gray-800" />
        </button>

        {/* Right scroll button */}
        <button
          onClick={() => scrollCarousel("right")}
          className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-gray-50 hover:shadow-xl z-10"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5 text-gray-800" />
        </button>
      </div>
    </div>
  )
}
