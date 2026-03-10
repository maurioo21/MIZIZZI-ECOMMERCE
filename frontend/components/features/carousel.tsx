"use client"

import { AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useEffect, useState, useMemo, memo, useReducedMotion } from "react"
import { useCarousel } from "@/hooks/use-carousel"
import { useResponsiveLayout } from "@/hooks/use-responsive-layout"
import { CarouselSlide } from "@/components/carousel/carousel-slide"
import { CarouselNavigation } from "@/components/carousel/carousel-navigation"
import { FeatureCards } from "@/components/carousel/feature-cards"
import { ContactCTA } from "@/components/carousel/contact-cta"
import { PremiumCustomerExperience } from "@/components/carousel/premium-customer-experience"
import { ProductShowcase } from "@/components/carousel/product-showcase"
import Image from "next/image"
import type {
  CarouselItem,
  PremiumExperience,
  ContactCTASlide,
  FeatureCard,
  ProductShowcaseCategory,
} from "@/lib/server/get-carousel-data"

interface CarouselProps {
  carouselItems?: CarouselItem[]
  premiumExperiences?: PremiumExperience[]
  contactCTASlides?: ContactCTASlide[]
  featureCards?: FeatureCard[]
  productShowcase?: ProductShowcaseCategory[]
}

/**
 * High-performance carousel component with hybrid rendering
 * - Uses memoization to prevent unnecessary re-renders
 * - Optimized image loading with priority for first slide
 * - Respects prefers-reduced-motion for accessibility & performance
 * - Fast rendering with useMemo for computed values
 */
export const Carousel = memo(function Carousel({
  carouselItems: serverCarouselItems = [],
  premiumExperiences = [],
  contactCTASlides = [],
  featureCards = [],
  productShowcase = [],
}: CarouselProps) {
  // Respect user's motion preferences for performance
  const prefersReducedMotion = useReducedMotion()

  // Use server items or fallback to contact CTA slides
  // Contact CTAs work well as main carousel content
  const displayItems = useMemo(() => {
    // Priority 1: Use carousel items if available
    if (serverCarouselItems && serverCarouselItems.length > 0) {
      return serverCarouselItems;
    }
    
    // Priority 2: Use contact CTA slides as carousel backup (they're designed for big display)
    if (contactCTASlides && contactCTASlides.length > 0) {
      return contactCTASlides.map(slide => ({
        image: slide.image || "/placeholder.svg",
        title: slide.subtitle || "Mizizzi",
        description: "",  // ContactCTASlide doesn't have description property
        buttonText: "Discover Now",
        href: "/products",
      }));
    }
    
    // Priority 3: Feature cards as minimal fallback (less ideal for carousel but shows something)
    if (featureCards && featureCards.length > 0) {
      return featureCards.slice(0, 3).map(card => ({
        image: "/placeholder.svg",
        title: card.title,
        description: card.description,
        buttonText: "Shop Now",
        href: card.href || "/products",
      }));
    }
    
    // Return empty - carousel will not render
    return [];
  }, [serverCarouselItems, contactCTASlides, featureCards]);

  const { sidePanelsVisible, isDesktop } = useResponsiveLayout()

  // Memoize carousel items to prevent unnecessary re-renders
  const carouselItems = useMemo(() => displayItems, [displayItems])

  const { currentSlide, direction, isPaused, nextSlide, prevSlide, pause, resume } = useCarousel({
    itemsLength: carouselItems.length || 1,
    autoPlay: carouselItems.length > 0 && !prefersReducedMotion,
  })

  const [prevSlideIndex, setPrevSlideIndex] = useState(currentSlide)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPrevSlideIndex(currentSlide)
    }, prefersReducedMotion ? 0 : 600)
    return () => clearTimeout(timer)
  }, [currentSlide, prefersReducedMotion])

  // Memoize active and previous items for performance
  const activeItem = useMemo(() => carouselItems[currentSlide], [carouselItems, currentSlide])
  const prevItem = useMemo(() => carouselItems[prevSlideIndex], [carouselItems, prevSlideIndex])

  if (carouselItems.length === 0) {
    return null
  }

  return (
    <div className="relative overflow-hidden">
      {isDesktop && sidePanelsVisible && (
        <div className="absolute left-0 top-0 z-10 hidden h-full w-[140px] transform p-2 xl:block xl:w-[220px]">
          <ProductShowcase categories={productShowcase} />
        </div>
      )}

      {isDesktop && sidePanelsVisible && (
        <div className="absolute right-0 top-0 z-10 hidden h-full w-[280px] transform p-2 xl:block xl:w-[220px]">
          <PremiumCustomerExperience experiences={premiumExperiences} />
        </div>
      )}

      {/* Main carousel content */}
      <div
        className={cn(
          "relative w-full",
          isDesktop && sidePanelsVisible
            ? "mx-auto max-w-[1200px] grid gap-3 sm:gap-4 xl:grid-cols-[1fr,280px] xl:px-2"
            : "sm:mx-auto sm:max-w-[1200px]",
          "transition-all duration-300",
        )}
      >
        {/* Enhanced main carousel */}
        <main
          className={cn(
            "relative w-full overflow-hidden",
            "rounded-xl border border-gray-100 shadow-sm",
            "h-[200px] xs:h-[220px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[400px]",
          )}
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
          role="region"
          aria-label="Featured products carousel"
          aria-live="polite"
        >
          <div className="absolute inset-0 z-0 bg-gray-100">
            {prevItem && (
              <Image
                src={prevItem.image || "/placeholder.svg"}
                alt=""
                fill
                className="object-cover"
                priority={currentSlide === 0}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1200px"
                quality={82}
                placeholder="empty"
              />
            )}
          </div>

          <AnimatePresence initial={false} custom={direction} mode="sync">
            {activeItem && (
              <CarouselSlide
                key={currentSlide}
                item={activeItem as any}
                isActive={true}
                index={currentSlide}
                direction={direction}
              />
            )}
          </AnimatePresence>

          {/* Navigation arrows */}
          {carouselItems.length > 1 && (
            <CarouselNavigation
              onPrevious={prevSlide}
              onNext={nextSlide}
              isPaused={isPaused}
              onPause={pause}
              onResume={resume}
            />
          )}
        </main>

        {/* Side cards - Large tablets and desktop only */}
        <aside className={cn("hidden flex-col gap-3 lg:flex xl:h-[400px]")} aria-label="Quick actions and promotions">
          <FeatureCards cards={featureCards} />
          <ContactCTA slides={contactCTASlides} />
        </aside>
      </div>
    </div>
  )
})
