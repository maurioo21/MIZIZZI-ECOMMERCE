"use client"
import { useAuth } from "@/contexts/auth/auth-context"
import { getCategoriesWithSubcategories } from "@/lib/server/get-categories"

import { useCallback, useEffect, useState, memo } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Menu, X, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { MobileNav } from "@/components/layout/mobile-nav"
import { AccountDropdown } from "@/components/auth/account-dropdown"
import { useStateContext } from "@/components/providers"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ErrorBoundary, type FallbackProps } from "react-error-boundary"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { CartIndicator } from "@/components/cart/cart-indicator"
import { HelpDropdown } from "@/components/layout/help-dropdown"
import { EnhancedSearchBar } from "@/components/layout/search-bar-enhanced"
import type { CategoryWithSubcategories } from "@/lib/server/get-categories"

// Error logging function (replace with your preferred logging service)
const logError = (error: Error, errorInfo?: any) => {
  console.error("Header Error:", error, errorInfo)
  // Add your error logging service here (e.g., Sentry)
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps & { resetErrorBoundary: () => void }) {
  // Only render error UI for non-extension errors
  if (error.message?.includes("chrome-extension://")) {
    return null
  }

  // Log the error
  logError(error)

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md" role="alert">
      <h2 className="text-red-800 font-semibold mb-2">Something went wrong with the header</h2>
      <p className="text-red-600 text-sm mb-3">We're sorry for the inconvenience. Please try refreshing the page.</p>
      <Button
        onClick={resetErrorBoundary}
        variant="outline"
        size="sm"
        className="text-red-700 border-red-300 hover:bg-red-50 bg-transparent"
      >
        Try again
      </Button>
    </div>
  )
}

// Memoized Logo Component - disable initial animations for performance
const Logo = memo(() => (
  <motion.div
    initial={false}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: "spring", stiffness: 200, damping: 15 }}
    className="relative h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 overflow-hidden rounded-xl bg-gradient-to-br from-cherry-800 to-cherry-900 p-1 shadow-lg flex-shrink-0"
  >
    <Link href="/" className="block h-full w-full" aria-label="Mizizzi Store - Go to homepage">
      <div className="h-full w-full rounded-xl bg-white p-1">
        <Image
          src="/images/screenshot-20from-202025-02-18-2013-30-22.png"
          alt="Mizizzi Store Logo - Premium E-commerce"
          width={48}
          height={48}
          className="h-full w-full object-contain"
          priority
        />
      </div>
    </Link>
  </motion.div>
))

Logo.displayName = "Logo"

// Memoized Brand Name Component
const BrandName = memo(() => (
  <div className="hidden sm:block flex-shrink-0">
    <Link href="/" className="block" aria-label="Mizizzi Store - Premium E-commerce">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-black tracking-tight leading-none font-serif">
        Mizizzi Store
      </h1>
      <p className="text-xs md:text-sm text-gray-600 font-medium tracking-wide">Premium E-commerce</p>
    </Link>
  </div>
))

BrandName.displayName = "BrandName"

interface HeaderProps {
  categories?: CategoryWithSubcategories[]
}

export function Header({ categories: serverCategories = [] }: HeaderProps) {
  const router = useRouter()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { state } = useStateContext()
  const { user, isAuthenticated } = useAuth()

  const shouldReduceMotion = useReducedMotion()
  const isMobile = useMediaQuery("(max-width: 640px)")
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1024px)")
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false)
  const cartCount = Array.isArray(state?.cart)
    ? state.cart.reduce((total, item) => total + (item?.quantity || 0), 0)
    : 0

  // Use server-passed categories or empty array
  const categories = serverCategories

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev)
  }, [])

  // Handle offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)
      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  const mobileSearchTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative w-10 h-10 rounded-full hover:bg-gray-100 transition-all duration-200"
      onClick={() => setIsSearchOpen(!isSearchOpen)}
      aria-label="Open search"
    >
      <Search className="h-5 w-5" />
    </Button>
  )

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={logError}>
      <header className="sticky top-0 z-50 w-full bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-4">
            {/* Left Section - Menu & Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden w-10 h-10 rounded-full hover:bg-gray-100 transition-all duration-200"
                    aria-label="Open navigation menu"
                    onClick={toggleMobileMenu}
                  >
                    <motion.div
                      animate={isMobileMenuOpen ? "open" : "closed"}
                      variants={{
                        open: { rotate: 90 },
                        closed: { rotate: 0 },
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </motion.div>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="p-0 w-[280px] sm:w-[320px]"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <MobileNav categories={categories} />
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-2 sm:gap-3">
                <Logo />
                <BrandName />
              </div>
            </div>

            {/* Center Section - Desktop Search */}
            <div className="hidden lg:flex flex-1 max-w-xl xl:max-w-2xl mx-4">
              <EnhancedSearchBar
                placeholder={isTablet ? "Search products..." : "Search for products, brands and categories..."}
                containerClassName="w-full"
              />
            </div>

            {/* Right Section - Actions */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Mobile Actions */}
              <div className="flex lg:hidden items-center gap-1 sm:gap-2">
                {isSearchOpen ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative w-10 h-10 rounded-full bg-gray-100 transition-all duration-200"
                    onClick={() => setIsSearchOpen(false)}
                    aria-label="Close search"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                ) : (
                  mobileSearchTrigger
                )}
                <HelpDropdown />
                <CartIndicator />
                <AccountDropdown
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative w-10 h-10 rounded-full hover:bg-gray-100 transition-all duration-200"
                      aria-label={`Account ${isAuthenticated ? `(${user?.name?.split(" ")[0] || "User"})` : ""}`}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cherry-50 text-cherry-700">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    </Button>
                  }
                />
              </div>

              {/* Desktop Actions */}
              <div className="hidden lg:flex items-center gap-3">
                <AccountDropdown />
                <HelpDropdown />
                <CartIndicator />
              </div>
            </div>
          </div>

       

          {/* Mobile Search Bar (Expandable) */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  duration: shouldReduceMotion ? 0.1 : 0.3,
                }}
                className="lg:hidden pb-3"
              >
                <EnhancedSearchBar isMobile={true} placeholder="Search products..." containerClassName="w-full" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Offline Banner */}
          <AnimatePresence>
            {isOffline && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.1 : 0.3 }}
                className="bg-yellow-50 border-t border-yellow-200"
                role="alert"
              >
                <div className="container mx-auto px-4 py-2 text-sm text-yellow-800 font-medium">
                  ⚠️ You are currently offline. Some features may be limited.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    </ErrorBoundary>
  )
}
