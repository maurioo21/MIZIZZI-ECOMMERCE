"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Modal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter } from "@/components/ui/modal"
import { useToast } from "@/hooks/use-toast"
import { Loader, ImageIcon, Upload, Save, X, Trash2, RefreshCw, Check } from "lucide-react"
import Image from "next/image"
import { websocketService } from "@/services/websocket"
import { useSWRConfig } from "swr"
import { categoryService } from "@/services/category"
import { 
  validateImageFile, 
  generateImagePreview, 
  getCategoryDisplayImageUrl,
  getBannerImageUrl 
} from "@/lib/cloudinary-image-handler"

interface Category {
  id: number
  name: string
  slug: string
  description?: string
  image_url?: string
  image_public_id?: string
  banner_url?: string
  banner_public_id?: string
  is_featured: boolean
  sort_order: number
  is_active?: boolean
}

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingCategory: Category | null
  onSaveSuccess: (bypassCache?: boolean) => void
}

interface ImageUploadState {
  preview: string | null
  file: File | null
  progress: number
  isUploading: boolean
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  editingCategory,
  onSaveSuccess,
}: CategoryFormDialogProps) {
  const { toast } = useToast()
  const { mutate } = useSWRConfig()
  const [saving, setSaving] = useState(false)
  const categoryImageRef = useRef<HTMLInputElement>(null)
  const bannerImageRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
    image_public_id: "",
    banner_url: "",
    banner_public_id: "",
    is_featured: false,
    sort_order: 0,
  })

  const [categoryImage, setCategoryImage] = useState<ImageUploadState>({
    preview: null,
    file: null,
    progress: 0,
    isUploading: false,
  })

  const [bannerImage, setBannerImage] = useState<ImageUploadState>({
    preview: null,
    file: null,
    progress: 0,
    isUploading: false,
  })

  const [deleteOldImage, setDeleteOldImage] = useState(false)
  const [deleteOldBanner, setDeleteOldBanner] = useState(false)
  const [slugValidating, setSlugValidating] = useState(false)
  const [slugError, setSlugError] = useState("")

  // Initialize form with existing data
  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        slug: editingCategory.slug,
        description: editingCategory.description || "",
        image_url: editingCategory.image_url || "",
        image_public_id: editingCategory.image_public_id || "",
        banner_url: editingCategory.banner_url || "",
        banner_public_id: editingCategory.banner_public_id || "",
        is_featured: editingCategory.is_featured,
        sort_order: editingCategory.sort_order,
      })
      
      // Set previews from existing URLs
      if (editingCategory.image_url) {
        setCategoryImage(prev => ({
          ...prev,
          preview: getCategoryDisplayImageUrl(editingCategory.image_url || ""),
        }))
      }
      
      if (editingCategory.banner_url) {
        setBannerImage(prev => ({
          ...prev,
          preview: getBannerImageUrl(editingCategory.banner_url || ""),
        }))
      }
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        image_url: "",
        image_public_id: "",
        banner_url: "",
        banner_public_id: "",
        is_featured: false,
        sort_order: 0,
      })
      setCategoryImage({ preview: null, file: null, progress: 0, isUploading: false })
      setBannerImage({ preview: null, file: null, progress: 0, isUploading: false })
    }
    
    setDeleteOldImage(false)
    setDeleteOldBanner(false)
    setSlugError("")
  }, [editingCategory, open])

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""),
    }))
    setSlugError("")
  }

  // Validate slug uniqueness
  const validateSlug = async (slug: string) => {
    if (!slug) {
      setSlugError("")
      return true
    }

    setSlugValidating(true)
    try {
      // Check if slug already exists (excluding current category)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/admin/shop-categories/categories?slug=${slug}`,
        {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("admin_token") || localStorage.getItem("mizizzi_token")}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        const existingCategory = data.categories?.find((cat: Category) => 
          cat.slug === slug && cat.id !== editingCategory?.id
        )
        
        if (existingCategory) {
          setSlugError("This slug already exists")
          return false
        }
      }
      
      setSlugError("")
      return true
    } catch (error) {
      console.error("Slug validation error:", error)
      return true
    } finally {
      setSlugValidating(false)
    }
  }

  // Handle category image selection
  const handleCategoryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast({
        title: "Invalid Image",
        description: validation.error,
        variant: "destructive",
      })
      return
    }

    try {
      const preview = await generateImagePreview(file)
      setCategoryImage({
        preview,
        file,
        progress: 0,
        isUploading: false,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to preview image",
        variant: "destructive",
      })
    }
  }

  // Handle banner image selection
  const handleBannerImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast({
        title: "Invalid Image",
        description: validation.error,
        variant: "destructive",
      })
      return
    }

    try {
      const preview = await generateImagePreview(file)
      setBannerImage({
        preview,
        file,
        progress: 0,
        isUploading: false,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to preview image",
        variant: "destructive",
      })
    }
  }

  // Upload image to Cloudinary via backend
  const uploadImageToCloudinary = async (file: File, type: "category" | "banner") => {
    const imageState = type === "category" ? categoryImage : bannerImage
    const setImageState = type === "category" ? setCategoryImage : setBannerImage

    try {
      setImageState(prev => ({ ...prev, isUploading: true, progress: 20 }))

      const formDataObj = new FormData()
      formDataObj.append("file", file)

      const token = localStorage.getItem("admin_token") || localStorage.getItem("mizizzi_token")
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const endpoint = `${baseUrl}/api/admin/shop-categories/categories/upload-image`

      setImageState(prev => ({ ...prev, progress: 40 }))

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataObj,
      })

      setImageState(prev => ({ ...prev, progress: 80 }))

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await response.json()
      const imageUrl = data.secure_url || data.url
      const publicId = data.public_id

      if (!imageUrl || !publicId) {
        throw new Error("Invalid response from server")
      }

      // Update form data with URL and public_id
      const fieldUrl = type === "category" ? "image_url" : "banner_url"
      const fieldPublicId = type === "category" ? "image_public_id" : "banner_public_id"

      setFormData(prev => ({
        ...prev,
        [fieldUrl]: imageUrl,
        [fieldPublicId]: publicId,
      }))

      setImageState(prev => ({ ...prev, progress: 100, isUploading: false }))

      toast({
        title: "Success",
        description: `${type === "category" ? "Category" : "Banner"} image uploaded successfully`,
      })
    } catch (error) {
      console.error("Upload error:", error)
      setImageState(prev => ({ ...prev, isUploading: false, progress: 0 }))
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      })
    }
  }

  // Clear image
  const clearImage = (type: "category" | "banner") => {
    if (type === "category") {
      setCategoryImage({ preview: null, file: null, progress: 0, isUploading: false })
      setFormData(prev => ({ ...prev, image_url: "", image_public_id: "" }))
      if (categoryImageRef.current) categoryImageRef.current.value = ""
    } else {
      setBannerImage({ preview: null, file: null, progress: 0, isUploading: false })
      setFormData(prev => ({ ...prev, banner_url: "", banner_public_id: "" }))
      if (bannerImageRef.current) bannerImageRef.current.value = ""
    }
  }

  // Handle form save
  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a category name",
        variant: "destructive",
      })
      return
    }

    if (!formData.image_url) {
      toast({
        title: "Validation Error",
        description: "Please upload a category image",
        variant: "destructive",
      })
      return
    }

    // Validate slug
    const isSlugValid = await validateSlug(formData.slug)
    if (!isSlugValid) {
      toast({
        title: "Validation Error",
        description: "Category slug already exists",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      const token = localStorage.getItem("admin_token") || localStorage.getItem("mizizzi_token")
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

      const payload: Record<string, any> = {
        name: formData.name.trim(),
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
        description: formData.description.trim(),
        image_url: formData.image_url,
        image_public_id: formData.image_public_id,
        banner_url: formData.banner_url || undefined,
        banner_public_id: formData.banner_public_id || undefined,
        is_featured: formData.is_featured,
        sort_order: formData.sort_order,
        delete_old_image: deleteOldImage && editingCategory?.image_public_id ? true : false,
        delete_old_banner: deleteOldBanner && editingCategory?.banner_public_id ? true : false,
      }

      const method = editingCategory ? "PUT" : "POST"
      const endpoint = editingCategory 
        ? `${baseUrl}/api/admin/shop-categories/categories/${editingCategory.id}`
        : `${baseUrl}/api/admin/shop-categories/categories`

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to ${editingCategory ? "update" : "create"} category`)
      }

      const result = await response.json()

      toast({
        title: "Success",
        description: `Category ${editingCategory ? "updated" : "created"} successfully`,
      })

      // Refresh SWR cache
      mutate("/api/admin/shop-categories/categories")

      // Close dialog
      onOpenChange(false)
      onSaveSuccess(true)
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const isFormValid = formData.name.trim() && formData.image_url && !slugError && !slugValidating
  const isLoading = categoryImage.isUploading || bannerImage.isUploading || saving || slugValidating

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalHeader>
        <ModalTitle>{editingCategory ? "Edit Category" : "Add Category"}</ModalTitle>
        <ModalDescription>
          {editingCategory ? "Update your category details and visibility settings" : "Create a new product category"}
        </ModalDescription>
      </ModalHeader>

      <ModalBody className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Images Section */}
        <div className="space-y-6 border-b pb-6">
          <h3 className="text-sm font-semibold text-gray-900">Images</h3>

          {/* Category Image */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">
                Category Image <span className="text-red-500">*</span>
              </Label>
              {formData.image_url && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Uploaded
                </span>
              )}
            </div>

            {categoryImage.preview || formData.image_url ? (
              <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                <Image
                  src={categoryImage.preview || getCategoryDisplayImageUrl(formData.image_url)}
                  alt="Category preview"
                  fill
                  className="object-cover"
                />
                
                {categoryImage.isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <div className="text-sm">{categoryImage.progress}%</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => categoryImageRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload category image</p>
                  <p className="text-xs text-gray-500 mt-1">Max 10MB (JPEG, PNG, WebP, GIF)</p>
                </div>
              </div>
            )}

            <input
              ref={categoryImageRef}
              type="file"
              accept="image/*"
              onChange={handleCategoryImageChange}
              className="hidden"
              disabled={categoryImage.isUploading}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => categoryImageRef.current?.click()}
                disabled={categoryImage.isUploading || saving}
                className="flex-1"
                variant="outline"
              >
                <Upload className="w-4 h-4 mr-2" />
                {categoryImage.file ? "Change Image" : "Upload Image"}
              </Button>

              {categoryImage.file && !categoryImage.isUploading && (
                <Button
                  type="button"
                  onClick={() => uploadImageToCloudinary(categoryImage.file!, "category")}
                  disabled={saving}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload to Cloud
                </Button>
              )}

              {formData.image_url && (
                <Button
                  type="button"
                  onClick={() => clearImage("category")}
                  disabled={categoryImage.isUploading || saving}
                  variant="outline"
                  size="icon"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {categoryImage.file && !categoryImage.isUploading && !formData.image_url && (
              <p className="text-xs text-amber-600">
                ⚠️ Image selected but not uploaded yet. Click "Upload to Cloud" to save it.
              </p>
            )}

            {editingCategory?.image_public_id && formData.image_url && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteOldImage}
                  onChange={(e) => setDeleteOldImage(e.target.checked)}
                  disabled={saving}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-xs text-gray-600">
                  Delete old image from CDN when updating (optional)
                </span>
              </label>
            )}
          </div>

          {/* Banner Image (Optional) */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">
                Banner Image <span className="text-gray-400">(Optional)</span>
              </Label>
              {formData.banner_url && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Uploaded
                </span>
              )}
            </div>

            {bannerImage.preview || formData.banner_url ? (
              <div className="relative w-full h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                <Image
                  src={bannerImage.preview || getBannerImageUrl(formData.banner_url)}
                  alt="Banner preview"
                  fill
                  className="object-cover"
                />
                
                {bannerImage.isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <div className="text-sm">{bannerImage.progress}%</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => bannerImageRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <p className="text-xs text-gray-500">Click to upload banner image (optional)</p>
              </div>
            )}

            <input
              ref={bannerImageRef}
              type="file"
              accept="image/*"
              onChange={handleBannerImageChange}
              className="hidden"
              disabled={bannerImage.isUploading}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => bannerImageRef.current?.click()}
                disabled={bannerImage.isUploading || saving}
                className="flex-1"
                variant="outline"
              >
                <Upload className="w-4 h-4 mr-2" />
                {bannerImage.file ? "Change Banner" : "Upload Banner"}
              </Button>

              {bannerImage.file && !bannerImage.isUploading && (
                <Button
                  type="button"
                  onClick={() => uploadImageToCloudinary(bannerImage.file!, "banner")}
                  disabled={saving}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              )}

              {formData.banner_url && (
                <Button
                  type="button"
                  onClick={() => clearImage("banner")}
                  disabled={bannerImage.isUploading || saving}
                  variant="outline"
                  size="icon"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {editingCategory?.banner_public_id && formData.banner_url && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteOldBanner}
                  onChange={(e) => setDeleteOldBanner(e.target.checked)}
                  disabled={saving}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-xs text-gray-600">
                  Delete old banner from CDN when updating (optional)
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Details</h3>

          <div className="space-y-3">
            <Label htmlFor="category-name" className="text-sm font-medium text-gray-700">
              Category Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="category-name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Electronics"
              disabled={isLoading}
              className="text-sm"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="category-slug" className="text-sm font-medium text-gray-700">
              URL Slug <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="category-slug"
                value={formData.slug}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, slug: e.target.value }))
                  setSlugError("")
                }}
                placeholder="e.g., electronics"
                disabled={isLoading}
                className={`text-sm ${slugError ? "border-red-500" : ""}`}
              />
              {slugValidating && (
                <Loader className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            {slugError && (
              <p className="text-xs text-red-600">{slugError}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="category-description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              id="category-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this category..."
              disabled={isLoading}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch
              id="is-featured"
              checked={formData.is_featured}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
              disabled={isLoading}
            />
            <Label htmlFor="is-featured" className="text-sm font-medium text-gray-700 cursor-pointer">
              Featured Category
            </Label>
          </div>

          <div className="space-y-3">
            <Label htmlFor="sort-order" className="text-sm font-medium text-gray-700">
              Sort Order
            </Label>
            <Input
              id="sort-order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
              disabled={isLoading}
              className="text-sm"
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="gap-2 pt-4 border-t">
        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isFormValid || isLoading}
          className="min-w-[120px]"
        >
          {saving ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {editingCategory ? "Update" : "Create"}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
