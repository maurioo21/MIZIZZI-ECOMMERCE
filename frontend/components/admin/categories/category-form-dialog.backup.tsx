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
import { Loader, ImageIcon, Upload, Save, X, Trash2, RefreshCw, Check, Eye } from "lucide-react"
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
  const categoryImageInputRef = useRef<HTMLInputElement>(null)
  const bannerImageInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
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
  const [formData, setFormData] = useState<Category>({
    id: 0,
    name: "",
    slug: "",
    description: "",
    image_url: "",
    image_public_id: "",
    banner_url: "",
    banner_public_id: "",
    is_featured: false,
    sort_order: 0,
    is_active: true,
  })
  const [deleteOldImage, setDeleteOldImage] = useState(false)
  const [deleteOldBanner, setDeleteOldBanner] = useState(false)
  const [slugError, setSlugError] = useState("")
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)

  useEffect(() => {
    if (editingCategory) {
      setFormData(editingCategory)
      setCategoryImage({
        preview: editingCategory.image_url || null,
        file: null,
        progress: 0,
        isUploading: false,
      })
      setBannerImage({
        preview: editingCategory.banner_url || null,
        file: null,
        progress: 0,
        isUploading: false,
      })
      setDeleteOldImage(false)
      setDeleteOldBanner(false)
      setSlugError("")
    } else {
      setFormData({
        id: 0,
        name: "",
        slug: "",
        description: "",
        image_url: "",
        image_public_id: "",
        banner_url: "",
        banner_public_id: "",
        is_featured: false,
        sort_order: 0,
        is_active: true,
      })
      setCategoryImage({ preview: null, file: null, progress: 0, isUploading: false })
      setBannerImage({ preview: null, file: null, progress: 0, isUploading: false })
      setDeleteOldImage(false)
      setDeleteOldBanner(false)
      setSlugError("")
    }
  }, [editingCategory, open])

  const handleCategoryImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast({ title: "Invalid image", description: validation.error, variant: "destructive" })
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
      toast({ title: "Image selected", description: `Ready to upload: ${file.name}` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" })
    }
  }

  const handleBannerImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast({ title: "Invalid image", description: validation.error, variant: "destructive" })
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
      toast({ title: "Banner selected", description: `Ready to upload: ${file.name}` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" })
    }
  }

  const handleSlugChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, slug: value }))
    if (!value.trim()) {
      setSlugError("")
      return
    }

    setIsCheckingSlug(true)
    try {
      const response = await fetch(
        `/api/admin/shop-categories/check-slug?slug=${encodeURIComponent(value)}&exclude_id=${editingCategory?.id || ""}`,
      )
      if (!response.ok) {
        setSlugError("Slug already exists")
      } else {
        setSlugError("")
      }
    } catch {
      setSlugError("Error checking slug availability")
    } finally {
      setIsCheckingSlug(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" })
      return
    }
    if (slugError) {
      toast({ title: "Error", description: slugError, variant: "destructive" })
      return
    }

    setIsLoading(true)

    try {
      let imageUrl = formData.image_url
      let imagePublicId = formData.image_public_id
      let bannerUrl = formData.banner_url
      let bannerPublicId = formData.banner_public_id

      // Upload category image if new one selected
      if (categoryImage.file) {
        setCategoryImage((prev) => ({ ...prev, isUploading: true, progress: 0 }))
        try {
          const uploadFormData = new FormData()
          uploadFormData.append("file", categoryImage.file)

          const uploadResponse = await fetch("/api/upload/cloudinary", {
            method: "POST",
            body: uploadFormData,
            signal: AbortSignal.timeout(30000),
          })

          if (!uploadResponse.ok) {
            throw new Error("Upload failed")
          }

          const uploadData = await uploadResponse.json()
          imageUrl = uploadData.secure_url
          imagePublicId = uploadData.public_id
          setCategoryImage((prev) => ({ ...prev, isUploading: false, progress: 100 }))
        } catch (error) {
          toast({
            title: "Upload failed",
            description: "Failed to upload category image",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
      }

      // Upload banner image if new one selected
      if (bannerImage.file) {
        setBannerImage((prev) => ({ ...prev, isUploading: true, progress: 0 }))
        try {
          const uploadFormData = new FormData()
          uploadFormData.append("file", bannerImage.file)

          const uploadResponse = await fetch("/api/upload/cloudinary", {
            method: "POST",
            body: uploadFormData,
            signal: AbortSignal.timeout(30000),
          })

          if (!uploadResponse.ok) {
            throw new Error("Upload failed")
          }

          const uploadData = await uploadResponse.json()
          bannerUrl = uploadData.secure_url
          bannerPublicId = uploadData.public_id
          setBannerImage((prev) => ({ ...prev, isUploading: false, progress: 100 }))
        } catch (error) {
          toast({
            title: "Upload failed",
            description: "Failed to upload banner image",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
      }

      const submitData = {
        ...formData,
        image_url: imageUrl,
        image_public_id: imagePublicId,
        banner_url: bannerUrl,
        banner_public_id: bannerPublicId,
        delete_old_image: deleteOldImage && categoryImage.file,
        delete_old_banner: deleteOldBanner && bannerImage.file,
      }

      let response
      if (editingCategory?.id) {
        response = await fetch(`/api/admin/shop-categories/categories/${editingCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitData),
        })
      } else {
        response = await fetch("/api/admin/shop-categories/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitData),
        })
      }

      if (!response.ok) {
        throw new Error("Failed to save category")
      }

      toast({
        title: "Success",
        description: editingCategory ? "Category updated successfully" : "Category created successfully",
      })

      onOpenChange(false)
      onSaveSuccess(true)
      mutate("/api/admin/shop-categories/categories")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <div className="relative w-full max-w-2xl transform rounded-xl bg-white shadow-2xl transition-all duration-300">
            {/* Header - Premium styling */}
            <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 sm:px-8 py-6 sm:py-8">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900">
                    {editingCategory ? "Edit Category" : "Create Category"}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 font-light">
                    {editingCategory ? "Update category details and imagery" : "Add a new product category"}
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-8 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Images Section */}
              <div className="mb-8 pb-8 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-gray-600" />
                  Media
                </h3>

                {/* Category Image - Premium presentation */}
                <div className="space-y-3 mb-8">
                  <div className="flex items-baseline justify-between">
                    <Label className="text-sm font-medium text-gray-900">
                      Category Image
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    {categoryImage.preview && (
                      <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Selected
                      </span>
                    )}
                  </div>

                  {/* Image Preview - Elegant presentation */}
                  <div className="relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-all duration-200">
                    {categoryImage.preview ? (
                      <div className="relative">
                        <div className="relative w-full h-48 sm:h-56">
                          <Image
                            src={categoryImage.preview}
                            alt="Category preview"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        {categoryImage.isUploading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="text-center">
                              <Loader className="h-6 w-6 text-white animate-spin mx-auto mb-2" />
                              <p className="text-xs text-white font-medium">{categoryImage.progress}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-48 sm:h-56">
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Click to select or drag image</p>
                          <p className="text-xs text-gray-500 mt-1">Max 10MB, JPG/PNG/WebP</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons - Premium styling */}
                  <div className="flex gap-3 flex-col sm:flex-row">
                    <button
                      type="button"
                      onClick={() => categoryImageInputRef.current?.click()}
                      className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {categoryImage.preview ? "Change Image" : "Select Image"}
                    </button>
                    {categoryImage.preview && (
                      <button
                        type="button"
                        onClick={() => setCategoryImage({ preview: null, file: null, progress: 0, isUploading: false })}
                        className="px-4 py-2.5 bg-gray-100 text-gray-900 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    )}
                  </div>

                  {categoryImage.preview && editingCategory?.image_public_id && categoryImage.file && (
                    <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <input
                        type="checkbox"
                        checked={deleteOldImage}
                        onChange={(e) => setDeleteOldImage(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-700">Delete old image from CDN</span>
                    </label>
                  )}

                  <input
                    ref={categoryImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCategoryImageSelect}
                    className="hidden"
                  />
                </div>

                {/* Banner Image */}
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <Label className="text-sm font-medium text-gray-900">
                      Banner Image
                      <span className="text-gray-400 ml-1 font-normal">(Optional)</span>
                    </Label>
                    {bannerImage.preview && (
                      <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Selected
                      </span>
                    )}
                  </div>

                  <div className="relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-all duration-200">
                    {bannerImage.preview ? (
                      <div className="relative">
                        <div className="relative w-full h-32 sm:h-40">
                          <Image
                            src={bannerImage.preview}
                            alt="Banner preview"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        {bannerImage.isUploading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="text-center">
                              <Loader className="h-6 w-6 text-white animate-spin mx-auto mb-2" />
                              <p className="text-xs text-white font-medium">{bannerImage.progress}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-32 sm:h-40">
                        <div className="text-center">
                          <ImageIcon className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Click to select or drag image</p>
                          <p className="text-xs text-gray-500 mt-1">Max 10MB, JPG/PNG/WebP</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 flex-col sm:flex-row">
                    <button
                      type="button"
                      onClick={() => bannerImageInputRef.current?.click()}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-900 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {bannerImage.preview ? "Change Banner" : "Select Banner"}
                    </button>
                    {bannerImage.preview && (
                      <button
                        type="button"
                        onClick={() => setBannerImage({ preview: null, file: null, progress: 0, isUploading: false })}
                        className="px-4 py-2.5 bg-gray-100 text-gray-900 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    )}
                  </div>

                  {bannerImage.preview && editingCategory?.banner_public_id && bannerImage.file && (
                    <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <input
                        type="checkbox"
                        checked={deleteOldBanner}
                        onChange={(e) => setDeleteOldBanner(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-700">Delete old banner from CDN</span>
                    </label>
                  )}

                  <input
                    ref={bannerImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerImageSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Details Section */}
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-600" />
                  Details
                </h3>

                {/* Category Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-900">
                    Category Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter category name"
                    className="px-4 py-2.5 rounded-lg border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all duration-200"
                  />
                </div>

                {/* URL Slug */}
                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-sm font-medium text-gray-900">
                    URL Slug <span className="text-red-500">*</span>
                    {isCheckingSlug && <Loader className="h-3 w-3 inline ml-2 animate-spin" />}
                  </Label>
                  <Input
                    id="slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="category-slug"
                    className={`px-4 py-2.5 rounded-lg border transition-all duration-200 ${
                      slugError ? "border-red-300 focus:border-red-500 focus:ring-red-500/10" : "border-gray-300 focus:border-gray-900 focus:ring-gray-900/10"
                    }`}
                  />
                  {slugError && <p className="text-sm text-red-600">{slugError}</p>}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-900">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter category description"
                    rows={3}
                    className="px-4 py-2.5 rounded-lg border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all duration-200 resize-none"
                  />
                </div>

                {/* Featured & Active Status */}
                <div className="grid grid-cols-2 gap-4 pt-2 pb-4 border-t border-gray-200">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <Switch
                      checked={formData.is_featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                    />
                    <span className="text-sm font-medium text-gray-900 group-hover:text-gray-700">Featured</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <Switch
                      checked={formData.is_active !== false}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <span className="text-sm font-medium text-gray-900 group-hover:text-gray-700">Active</span>
                  </label>
                </div>
              </div>
            </form>

            {/* Footer - Premium action buttons */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 sm:px-8 py-4 sm:py-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-900 font-medium text-sm hover:bg-gray-100 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2.5 rounded-lg bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingCategory ? "Update" : "Create"} Category
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
