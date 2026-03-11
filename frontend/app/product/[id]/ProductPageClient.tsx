"use client"
import { use, useState, useEffect } from "react"
import { notFound } from "next/navigation"
import ProductDetailsEnhanced from "@/components/products/product-details-enhanced"
import ProductDetailsMobile from "@/components/products/product-details-mobile"
import { productService } from "@/services/product"
import { useMobile } from "@/hooks/use-mobile"

// Helper function to determine product type
const determineProductType = (product: any) => {
  // Check if it's a luxury product
  if (
    product.category_id === "luxury" ||
    product.category_id === "premium" ||
    (typeof product.category === "object" &&
      (product.category?.name?.toLowerCase().includes("luxury") ||
        product.category?.name?.toLowerCase().includes("premium"))) ||
    (Array.isArray(product.tags) &&
      product.tags.some((tag: string) => tag.toLowerCase().includes("luxury") || tag.toLowerCase().includes("premium")))
  ) {
    return "luxury"
  }

  // Check if it's a flash sale product
  if (
    product.sale_price &&
    product.sale_price < product.price &&
    ((Array.isArray(product.tags) && product.tags.some((tag: string) => tag.toLowerCase().includes("flash"))) ||
      product.is_flash_sale)
  ) {
    return "flash_sale"
  }

  // Default to regular product
  return "regular"
}

export default function ProductPageClient({ params }: { params: { id: Promise<string> } }) {
  const id = use(params.id)
  const isMobile = useMobile()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  try {
    const product = use(productService.getProduct(id))
        {
          id: 1,
          rating: 5,
          reviewer_name: "Jane Doe",
          comment:
            "Excellent product! I love the quality and design. The material feels premium and it's exactly as described. Shipping was fast and the packaging was secure. I would definitely recommend this to anyone looking for a high-quality item. The customer service was also very responsive when I had questions.",
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          verified_purchase: true,
          helpful_count: 12,
        },
        {
          id: 2,
          rating: 4,
          reviewer_name: "John Smith",
          comment:
            "Good product overall. Shipping was fast and the item matches the description. The only reason I'm giving 4 stars instead of 5 is because the color is slightly different from what I expected. Otherwise, the quality is excellent and it works perfectly for my needs.",
          date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          verified_purchase: true,
          helpful_count: 5,
        },
        {
          id: 3,
          rating: 5,
          reviewer_name: "Mary Johnson",
          comment:
            "I'm extremely satisfied with this purchase! The product arrived earlier than expected and was packaged very securely. The quality exceeds what I expected for the price point. I've already recommended it to several friends who were impressed when they saw it.",
          date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          verified_purchase: true,
          helpful_count: 8,
        },
        {
          id: 4,
          rating: 3,
          reviewer_name: "Alex Johnson",
          comment:
            "Average product for the price. It works as expected but nothing exceptional. Delivery was on time and the packaging was adequate. Might be good for someone looking for a basic option.",
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          verified_purchase: false,
          helpful_count: 2,
        },
      ]
    }

    // Add mock features if not present
    if (!product.features) {
      product.features = [
        "Premium quality materials for exceptional durability",
        "Ergonomic design for maximum comfort during extended use",
        "Versatile functionality suitable for various occasions",
        "Modern aesthetic that complements any style or setting",
        "Easy to clean and maintain with simple care instructions",
        "Energy-efficient operation to reduce environmental impact",
        "Compact design that saves space without sacrificing performance",
      ]
    }

    // Add mock package contents if not present
    if (!product.package_contents) {
      product.package_contents = [
        `1 x ${product.name}`,
        "Detailed User Manual",
        "Warranty Card (2 Years)",
        "Quick Start Guide",
        "Customer Support Information",
      ]
    }

    // Don't render until component is mounted (prevents hydration mismatch)
    if (!mounted) {
      return null
    }

    return (
      <>
        {isMobile ? (
          <ProductDetailsMobile product={product} />
        ) : (
          <div className="container px-4 py-8 sm:px-6 lg:px-8">
            <ProductDetailsEnhanced product={product} />
          </div>
        )}
      </>
    )
  } catch (error) {
    return notFound()
  }
}
