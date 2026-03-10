'use client'

import Link from "next/link"
import { NetworkStatus } from "@/components/shared/network-status"
import { CategoryGrid } from "@/components/features/category-grid-enhanced"
import { Carousel } from "@/components/features/carousel"
import { useCategoriesCache } from "@/hooks/use-categories-cache"
import type { Product } from "@/types"
import type { Category } from "@/lib/server/get-categories"
import type {
  CarouselItem,
  PremiumExperience,
  ContactCTASlide,
  FeatureCard,
  ProductShowcaseCategory,
} from "@/lib/server/get-carousel-data"

interface CriticalSectionsProps {
  categories?: Category[]
  carouselItems?: CarouselItem[]
  premiumExperiences?: PremiumExperience[]
  contactCTASlides?: ContactCTASlide[]
  featureCards?: FeatureCard[]
  productShowcase?: ProductShowcaseCategory[]
}

/**
 * Critical sections rendered immediately for fast FCP and SEO.
 * These sections are server-rendered and appear in initial HTML.
 *
 * Includes:
 * - Carousel (all slide types)
 * - Category Grid
 * - Feature Cards (within carousel)
 * - Product Showcase (within carousel)
 * - Premium Experiences (within carousel)
 * - Contact CTA (within carousel)
 */
export function CriticalSections({
  categories = [],
  carouselItems = [],
  premiumExperiences = [],
  contactCTASlides = [],
  featureCards = [],
  productShowcase = [],
}: CriticalSectionsProps) {
  // Apply 3-layer cache strategy: sessionStorage > localStorage > server data
  const { categories: cachedCategories } = useCategoriesCache(categories)

  return (
    <>
      {/* Network Status Indicator */}
      <NetworkStatus className="mx-auto w-full max-w-[1200px] px-1 sm:px-2 md:px-4 pt-2" />

      {/* Carousel Section - All slide types (critical for FCP & SEO) */}
      <div className="w-full mt-2 sm:mt-3 sm:py-2" style={{ backgroundColor: "var(--color-background)" }}>
        <Carousel
          carouselItems={carouselItems}
          premiumExperiences={premiumExperiences}
          contactCTASlides={contactCTASlides}
          featureCards={featureCards}
          productShowcase={productShowcase}
        />
      </div>

      {/* Category Grid - Critical for product discovery */}
      <div className="mx-auto w-full max-w-[1200px] px-0 sm:px-3 md:px-4 mt-3 sm:mt-4">
        <div className="mb-3 sm:rounded-lg bg-white overflow-hidden shadow-sm">
          <CategoryGrid categories={cachedCategories} />
        </div>
      </div>
    </>
  )
}
