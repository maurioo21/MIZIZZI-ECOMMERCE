"use client"

import React, { memo } from "react"
import { ProductRow } from "@/components/admin/product-row"
import { ProductCard } from "@/components/admin/product-card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Product } from "@/types"

interface ProductListProps {
  products: Product[]
  selectedProducts: string[]
  viewMode: "list" | "grid"
  isMobile: boolean
  productImages: Record<string, string>
  onSelectProduct: (id: string) => void
  onDeleteProduct: (id: string) => void
  onEditProduct: (id: string) => void
  onViewProduct: (id: string) => void
  getProductImage: (product: Product) => string
}

const ProductList = memo(function ProductList({
  products,
  selectedProducts,
  viewMode,
  isMobile,
  productImages,
  onSelectProduct,
  onDeleteProduct,
  onEditProduct,
  onViewProduct,
  getProductImage,
}: ProductListProps) {
  const displayMode = viewMode

  if (displayMode === "grid") {
    return (
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-5">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isSelected={selectedProducts.includes(product.id.toString())}
            onSelect={onSelectProduct}
            onEdit={onEditProduct}
            onDelete={onDeleteProduct}
            onView={onViewProduct}
            imageSrc={productImages[product.id] || getProductImage(product)}
          />
        ))}
      </div>
    )
  }

  // Responsive list view - transforms to card layout on mobile
  if (isMobile) {
    return (
      <div className="space-y-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
          >
            <div className="flex gap-3">
              {/* Product Image */}
              <div className="flex-shrink-0 w-16 h-16">
                <img
                  src={productImages[product.id] || getProductImage(product) || "/placeholder-product.png"}
                  alt={product.name}
                  className="w-full h-full object-cover rounded-md bg-gray-100"
                />
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id.toString())}
                    onChange={() => onSelectProduct(product.id.toString())}
                    className="w-4 h-4 rounded cursor-pointer flex-shrink-0 mt-0.5"
                  />
                </div>

                {/* Price and Stock in mobile layout */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-900">KSh {(product.price || 0).toLocaleString()}</span>
                  </div>
                  <div
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      (product.stock || 0) > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {(product.stock || 0) > 0 ? `${product.stock} in stock` : "Out of stock"}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-1 flex-wrap">
                  {product.is_featured && (
                    <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Featured</span>
                  )}
                  {product.is_sale && (
                    <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">On Sale</span>
                  )}
                  {product.is_new && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">New</span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Actions */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => onEditProduct(product.id.toString())}
                className="flex-1 text-xs font-medium text-gray-700 hover:text-gray-900 py-1.5 rounded transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDeleteProduct(product.id.toString())}
                className="flex-1 text-xs font-medium text-red-700 hover:text-red-900 py-1.5 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Desktop table view - full featured responsive table
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50 border-b border-gray-200 sticky top-0 z-40">
            <TableRow className="hover:bg-gray-50">
              <TableHead className="w-12 font-semibold text-gray-900 h-12 px-3">
                <input type="checkbox" className="w-4 h-4 rounded cursor-pointer" />
              </TableHead>
              <TableHead className="font-semibold text-gray-900 h-12 px-4 text-left">Product</TableHead>
              <TableHead className="font-semibold text-gray-900 h-12 px-4 text-right">Price</TableHead>
              <TableHead className="font-semibold text-gray-900 h-12 px-4 text-right">Stock</TableHead>
              <TableHead className="font-semibold text-gray-900 h-12 px-4 text-center">Status</TableHead>
              <TableHead className="font-semibold text-gray-900 h-12 px-4 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                isSelected={selectedProducts.includes(product.id.toString())}
                onSelect={onSelectProduct}
                onEdit={onEditProduct}
                onDelete={onDeleteProduct}
                onView={onViewProduct}
                imageSrc={productImages[product.id] || getProductImage(product)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
})

ProductList.displayName = "ProductList"

const arePropsEqual = (prevProps: ProductListProps, nextProps: ProductListProps) => {
  if (prevProps.products.length !== nextProps.products.length) return false
  if (prevProps.products.some((p, i) => p.id !== nextProps.products[i]?.id)) return false
  if (prevProps.viewMode !== nextProps.viewMode) return false
  if (prevProps.isMobile !== nextProps.isMobile) return false
  if (prevProps.selectedProducts.length !== nextProps.selectedProducts.length) return false
  return true
}

const MemoizedProductList = React.memo(ProductList, arePropsEqual)
export { MemoizedProductList as ProductList }
