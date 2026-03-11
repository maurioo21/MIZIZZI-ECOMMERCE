import { notFound } from "next/navigation"
import ProductDetailsEnhanced from "@/components/products/product-details-enhanced"
import { getProductDetails, getProductDetailsBySlug, validateProductDetails } from "@/lib/server/get-product-details"

// Define static metadata
export const metadata = {
  title: "Product Details | Mizizzi",
  description: "View detailed information about this product",
}

interface PageProps {
  params: Promise<{ id: string }>
}

// Helper function to determine product type
function determineProductType(product: any) {
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

async function getRelatedProducts(productId: string) {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
    const url = `${apiBaseUrl}/api/product-details/${productId}/related?limit=12`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "revalidate",
      next: { revalidate: 300 } // Cache for 5 minutes
    })

    if (!response.ok) {
      console.warn(`[v0] Failed to fetch related products: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.success && Array.isArray(data.related) ? data.related : []
  } catch (error) {
    console.error("[v0] Error fetching related products:", error instanceof Error ? error.message : String(error))
    return []
  }
}

async function getExploreRandomProducts() {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
    const url = `${apiBaseUrl}/api/product-details/explore/random?limit=20`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "revalidate",
      next: { revalidate: 300 } // Cache for 5 minutes
    })

    if (!response.ok) {
      console.warn(`[v0] Failed to fetch explore products: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.success && Array.isArray(data.products) ? data.products : []
  } catch (error) {
    console.error("[v0] Error fetching explore products:", error instanceof Error ? error.message : String(error))
    return []
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  try {
    // Check if the ID is numeric or a slug
    const isNumericId = /^\d+$/.test(id)

    let product
    if (isNumericId) {
      console.log(`[v0] Fetching numeric product ID: ${id}`)
      product = await getProductDetails(id)
    } else {
      console.log(`[v0] Fetching product by slug: ${id}`)
      product = await getProductDetailsBySlug(id)
    }

    if (!product) {
      console.warn(`[v0] Product not found for ID/slug: ${id}`)
      return notFound()
    }

    if (!validateProductDetails(product)) {
      console.warn(`[v0] Product validation failed for ID: ${product?.id}, validation result: false`)
      return notFound()
    }

    // Determine product type
    const productType = determineProductType(product)
    product.product_type = productType

    // Ensure product.reviews is an array
    if (!product.reviews || !Array.isArray(product.reviews)) {
      product.reviews = []
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

    const relatedProducts = product.id
      ? await getRelatedProducts(String(product.id))
      : []
    
    const exploreProducts = await getExploreRandomProducts()

    return <ProductDetailsEnhanced product={product} similarProducts={relatedProducts} exploreInitialProducts={exploreProducts} />
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[v0] Error loading product ${id}: ${errorMessage}`)
    return notFound()
  }
}
