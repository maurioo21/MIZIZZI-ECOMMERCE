"use client"
import { use } from "react"
import { notFound } from "next/navigation"
import ProductDetailsEnhanced from "@/components/products/product-details-enhanced"
import { productService } from "@/services/product"

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
  console.log(`[DEBUG] Page component started for ID: ${id}`)

  try {
    // Use the productService instead of direct fetch
    console.log(`[DEBUG] Fetching product using productService.getProduct`)
    const product = use(productService.getProduct(id))

    console.log(`[DEBUG] Product fetch result:`, product ? "Success" : "Not found")

    if (!product) {
      console.log(`[DEBUG] Product not found, returning 404`)
      return notFound()
    }

    // Determine product type and add it to the product object
    product.product_type = determineProductType(product)
    console.log(`[DEBUG] Product type determined: ${product.product_type}`)

    // Ensure product.reviews is an array
    if (!product.reviews) {
      console.log(`[DEBUG] No reviews property, initializing empty array`)
      product.reviews = []
    } else if (!Array.isArray(product.reviews)) {
      console.log(`[DEBUG] Reviews is not an array, converting to array`)
      product.reviews = []
    }

    // If no reviews, add mock reviews
    if (product.reviews.length === 0) {
      console.log(`[DEBUG] Adding mock reviews`)
      product.reviews = [
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

    console.log(`[DEBUG] Rendering product page`)
    return (
      <div className="container px-4 py-8 sm:px-6 lg:px-8">
        <ProductDetailsEnhanced product={product} />
      </div>
    )
  } catch (error) {
    console.error(
      `[ERROR] Unhandled exception in page component:`,
      error instanceof Error ? error.message : String(error),
    )
    console.error(`[ERROR] Stack trace:`, error instanceof Error ? error.stack : "No stack trace")
    return notFound()
  }
}
