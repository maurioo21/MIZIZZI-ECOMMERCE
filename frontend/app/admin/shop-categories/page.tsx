"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, Loader, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { CategoryFormDialog } from "@/components/admin/categories/category-form-dialog"
import { CategoryDeleteDialog } from "@/components/admin/categories/category-delete-dialog"

const getValidImageUrl = (url: string | null | undefined, bustCache: boolean = false): string => {
  if (!url) return "/placeholder.svg"

  if (url.startsWith("data:")) {
    return url
  }

  let finalUrl = url
  if (url.startsWith("http://") || url.startsWith("https://")) {
    finalUrl = url
  } else if (url.startsWith("/")) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
    finalUrl = `${baseUrl}${url}`
  } else {
    return "/placeholder.svg"
  }

  // Add cache-busting parameter for Cloudinary URLs to force fresh images
  if (bustCache && (finalUrl.includes("cloudinary.com") || finalUrl.includes("res.cloudinary.com"))) {
    const separator = finalUrl.includes("?") ? "&" : "?"
    finalUrl = `${finalUrl}${separator}t=${Date.now()}`
  }

  return finalUrl
}

interface Category {
  id: number
  name: string
  slug: string
  description?: string
  image_url?: string
  banner_url?: string
  is_featured: boolean
  sort_order: number
  is_active?: boolean
}

export default function ShopCategoriesAdminPage() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

  // Pagination calculations
  const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedCategories = categories.slice(startIndex, endIndex)

  // Fetch categories
  const fetchCategories = async (bypassCache = false) => {
    try {
      setLoading(true)
      const token = localStorage.getItem("admin_token") || localStorage.getItem("mizizzi_token")
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

      // Add timestamp to bypass browser cache when forcing refresh
      const cacheParam = bypassCache ? `&_t=${Date.now()}` : ""
      const response = await fetch(`${baseUrl}/api/admin/shop-categories/categories?per_page=100${cacheParam}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      })

      if (!response.ok) throw new Error("Failed to fetch categories")

      const data = await response.json()
      // Use cache busting for image URLs to ensure fresh images after updates
      const normalizedCategories = (data.items || []).map((cat: Category) => ({
        ...cat,
        image_url: cat.image_url ? getValidImageUrl(cat.image_url, true) : undefined,
        banner_url: cat.banner_url ? getValidImageUrl(cat.banner_url, true) : undefined,
      }))
      
      setCategories(normalizedCategories)
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setIsFormDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingCategory(null)
    setIsFormDialogOpen(true)
  }

  const openDeleteDialog = (category: Category) => {
    setCategoryToDelete(category)
    setIsDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Shop Categories</h1>
              <p className="text-sm text-muted-foreground">Manage your store categories</p>
            </div>
            <Button 
              onClick={openCreateDialog}
              size="lg"
              className="gap-2 rounded-xl h-11 px-6 font-medium"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">Add Category</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading categories...</p>
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-muted/50 p-12 text-center space-y-3 max-w-md mx-auto">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-primary/60" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground">No Categories Yet</h3>
              <p className="text-sm text-muted-foreground">Create your first category to get started managing your store</p>
              <Button 
                onClick={openCreateDialog}
                className="mt-6 gap-2 rounded-lg w-full"
              >
                <Plus className="h-4 w-4" />
                Create Category
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              {/* Apple-style List View */}
              {paginatedCategories.map((category) => (
              <div
                key={category.id}
                className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 transition-all duration-200 hover:border-border/60 hover:shadow-sm"
              >
                {/* Category Image - Thumbnail */}
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border/50">
                  <Image
                    src={getValidImageUrl(category.image_url)}
                    alt={category.name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Content - Middle Section */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">{category.name}</h3>
                    {category.is_featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary flex-shrink-0 whitespace-nowrap">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                        </span>
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {category.description || "No description"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 font-mono mt-1">/{category.slug}</p>
                </div>

                {/* Actions - Right Section - Apple Style */}
                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 sm:opacity-100">
                  {/* Edit Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(category)}
                    className="h-9 rounded-lg px-4 gap-2 border-blue-200/50 hover:border-blue-300 hover:bg-blue-50 text-blue-600 hover:text-blue-700 font-medium text-sm transition-all duration-200"
                    title="Edit category"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>

                  {/* Delete Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(category)}
                    className="h-9 rounded-lg px-4 gap-2 border-red-200/50 hover:border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 font-medium text-sm transition-all duration-200"
                    title="Delete category"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
                    <span className="font-semibold text-foreground">{Math.min(endIndex, categories.length)}</span> of{" "}
                    <span className="font-semibold text-foreground">{categories.length}</span> categories
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="gap-1.5 rounded-lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  <div className="flex items-center gap-1 px-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="h-8 w-8 rounded-lg p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="gap-1.5 rounded-lg"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Form Dialog */}
      <CategoryFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        editingCategory={editingCategory}
        onSaveSuccess={(bypassCache) => fetchCategories(bypassCache)}
      />

      {/* Category Delete Dialog */}
      <CategoryDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        category={categoryToDelete}
        onDeleteSuccess={fetchCategories}
      />
    </div>
  )
}
