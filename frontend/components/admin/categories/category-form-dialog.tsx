"use client"

import type React from "react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader, Upload, X, Trash2, Check } from "lucide-react"
import Image from "next/image"
import { categoryService } from "@/services/category"
import { useSWRConfig } from "swr"
import { 
  validateImageFile, 
  generateImagePreview
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

  // Form state
  const [formData, setFormData] = useState({
    name: editingCategory?.name || "",
    slug: editingCategory?.slug || "",
    description: editingCategory?.description || "",
    is_featured: editingCategory?.is_featured || false,
  })

  const [categoryImage, setCategoryImage] = useState<ImageUploadState>({
    preview: editingCategory?.image_url || null,
    file: null,
    progress: 0,
    isUploading: false,
  })

  const [bannerImage, setBannerImage] = useState<ImageUploadState>({
    preview: editingCategory?.banner_url || null,
    file: null,
    progress: 0,
    isUploading: false,
  })

  const [deleteOldImage, setDeleteOldImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slugError, setSlugError] = useState("")

  const handleCategoryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast({
        title: "Invalid image",
        description: validation.error || "Please check your image and try again",
        variant: "destructive",
      })
      return
    }

    const preview = await generateImagePreview(file)
    setCategoryImage({
      preview,
      file,
      progress: 0,
      isUploading: false,
    })
  }

  const handleBannerImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast({
        title: "Invalid image",
        description: validation.error || "Please check your image and try again",
        variant: "destructive",
      })
      return
    }

    const preview = await generateImagePreview(file)
    setBannerImage({
      preview,
      file,
      progress: 0,
      isUploading: false,
    })
  }

  const uploadImageToCloudinary = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/admin/cloudinary/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Upload failed")
      }

      const result = await response.json()
      return {
        url: result.secure_url || result.url,
        public_id: result.public_id,
      }
    } catch (error) {
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let imageUrl = editingCategory?.image_url
      let imagePublicId = editingCategory?.image_public_id
      let bannerUrl = editingCategory?.banner_url
      let bannerPublicId = editingCategory?.banner_public_id

      if (categoryImage.file) {
        setCategoryImage((prev) => ({ ...prev, isUploading: true }))
        const uploaded = await uploadImageToCloudinary(categoryImage.file)
        imageUrl = uploaded.url
        imagePublicId = uploaded.public_id
      }

      if (bannerImage.file) {
        setBannerImage((prev) => ({ ...prev, isUploading: true }))
        const uploaded = await uploadImageToCloudinary(bannerImage.file)
        bannerUrl = uploaded.url
        bannerPublicId = uploaded.public_id
      }

      const payload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        is_featured: formData.is_featured,
      }

      if (imageUrl) {
        payload.image_url = imageUrl
        payload.image_public_id = imagePublicId
        payload.delete_old_image = deleteOldImage
      }

      if (bannerUrl) {
        payload.banner_url = bannerUrl
        payload.banner_public_id = bannerPublicId
      }

      let response
      if (editingCategory?.id) {
        response = await categoryService.updateCategory(editingCategory.id, payload)
      } else {
        response = await categoryService.createCategory(payload)
      }

      if (response.success) {
        toast({
          title: "Success",
          description: editingCategory?.id ? "Category updated" : "Category created",
        })
        mutate("/api/admin/shop-categories/categories")
        onSaveSuccess(true)
        onOpenChange(false)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setCategoryImage((prev) => ({ ...prev, isUploading: false }))
      setBannerImage((prev) => ({ ...prev, isUploading: false }))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200/80 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-600 text-gray-900">
              {editingCategory?.id ? "Edit Category" : "Create Category"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {editingCategory?.id ? "Update your category details" : "Add a new category to your store"}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="px-8 py-8 space-y-8">
            {/* Category Image Section */}
            <div className="space-y-3">
              <label className="block text-sm font-500 text-gray-900">
                Category Image
                <span className="text-red-500 ml-1">*</span>
              </label>
              
              {categoryImage.preview ? (
                <div className="relative group">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    <Image
                      src={categoryImage.preview}
                      alt="Category preview"
                      fill
                      className="object-cover"
                    />
                    {categoryImage.isUploading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Loader className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => categoryImageInputRef.current?.click()}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg shadow-lg"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryImage({ preview: null, file: null, progress: 0, isUploading: false })}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg shadow-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => categoryImageInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center justify-center cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm font-500 text-gray-600">Upload image</span>
                    <span className="text-xs text-gray-500">Max 10MB • JPG, PNG, WebP</span>
                  </div>
                </button>
              )}
              <input
                ref={categoryImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleCategoryImageChange}
                className="hidden"
              />
            </div>

            {/* Banner Image Section */}
            <div className="space-y-3">
              <label className="block text-sm font-500 text-gray-900">
                Banner Image
                <span className="text-gray-400 ml-1">(Optional)</span>
              </label>
              
              {bannerImage.preview ? (
                <div className="relative group">
                  <div className="relative w-full aspect-[3/1] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    <Image
                      src={bannerImage.preview}
                      alt="Banner preview"
                      fill
                      className="object-cover"
                    />
                    {bannerImage.isUploading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Loader className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => bannerImageInputRef.current?.click()}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg shadow-lg"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerImage({ preview: null, file: null, progress: 0, isUploading: false })}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg shadow-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => bannerImageInputRef.current?.click()}
                  className="w-full aspect-[3/1] rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center justify-center cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm font-500 text-gray-600">Upload banner</span>
                  </div>
                </button>
              )}
              <input
                ref={bannerImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerImageChange}
                className="hidden"
              />
            </div>

            {/* Details Section */}
            <div className="pt-6 border-t border-gray-100 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-500 text-gray-900">
                    Category Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Electronics"
                    className="rounded-lg border-gray-300 h-10"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-sm font-500 text-gray-900">
                    URL Slug <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g., electronics"
                    className="rounded-lg border-gray-300 h-10"
                    required
                  />
                  {slugError && <p className="text-xs text-red-500 mt-1">{slugError}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-500 text-gray-900">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your category..."
                  className="rounded-lg border-gray-300 resize-none h-24"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="featured"
                  checked={formData.is_featured}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="featured" className="text-sm font-500 text-gray-700">
                  Featured Category
                </label>
              </div>

              {editingCategory?.image_public_id && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="deleteOld"
                    checked={deleteOldImage}
                    onChange={(e) => setDeleteOldImage(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="deleteOld" className="text-sm font-500 text-amber-900">
                    Delete old image from CDN
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-gray-200/80 bg-gray-50 flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {editingCategory?.id ? "Update" : "Create"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
