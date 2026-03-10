"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal"
import { useToast } from "@/hooks/use-toast"
import { Loader, ImageIcon, Upload, X, Trash2 } from "lucide-react"
import Image from "next/image"
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

interface ImageState {
  preview: string | null
  file: File | null
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
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    is_featured: false,
  })
  const [categoryImage, setCategoryImage] = useState<ImageState>({
    preview: editingCategory?.image_url || null,
    file: null,
    isUploading: false,
  })
  const [bannerImage, setBannerImage] = useState<ImageState>({
    preview: editingCategory?.banner_url || null,
    file: null,
    isUploading: false,
  })
  const [deleteOldImage, setDeleteOldImage] = useState(false)
  const [deleteOldBanner, setDeleteOldBanner] = useState(false)

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "", is_featured: false })
    setCategoryImage({ preview: null, file: null, isUploading: false })
    setBannerImage({ preview: null, file: null, isUploading: false })
    setDeleteOldImage(false)
    setDeleteOldBanner(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const handleImageSelect = async (file: File | null, isCategory: boolean) => {
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast({ title: "Invalid image", description: validation.error || "Image validation failed", variant: "destructive" })
      return
    }
      return
    }

    try {
      const preview = await generateImagePreview(file)
      if (isCategory) {
        setCategoryImage({ preview, file, isUploading: false })
      } else {
        setBannerImage({ preview, file, isUploading: false })
      }
    } catch {
      toast({ title: "Error", description: "Failed to preview image", variant: "destructive" })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" })
      return
    }

    setIsLoading(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

    try {
      let imageUrl = editingCategory?.image_url || null
      let imagePublicId = editingCategory?.image_public_id || null
      let bannerUrl = editingCategory?.banner_url || null
      let bannerPublicId = editingCategory?.banner_public_id || null

      // Upload category image
      if (categoryImage.file) {
        setCategoryImage((prev) => ({ ...prev, isUploading: true }))
        const uploadFormData = new FormData()
        uploadFormData.append("file", categoryImage.file)

        const uploadResponse = await fetch(`${apiUrl}/api/upload/cloudinary`, {
          method: "POST",
          body: uploadFormData,
          signal: AbortSignal.timeout(30000),
        })

        if (!uploadResponse.ok) {
          throw new Error("Image upload failed")
        }

        const uploadData = await uploadResponse.json()
        imageUrl = uploadData.secure_url
        imagePublicId = uploadData.public_id
        setCategoryImage((prev) => ({ ...prev, isUploading: false }))
      }

      // Upload banner image
      if (bannerImage.file) {
        setBannerImage((prev) => ({ ...prev, isUploading: true }))
        const uploadFormData = new FormData()
        uploadFormData.append("file", bannerImage.file)

        const uploadResponse = await fetch(`${apiUrl}/api/upload/cloudinary`, {
          method: "POST",
          body: uploadFormData,
          signal: AbortSignal.timeout(30000),
        })

        if (!uploadResponse.ok) {
          throw new Error("Banner upload failed")
        }

        const uploadData = await uploadResponse.json()
        bannerUrl = uploadData.secure_url
        bannerPublicId = uploadData.public_id
        setBannerImage((prev) => ({ ...prev, isUploading: false }))
      }

      // Prepare category data
      const categoryData = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        is_featured: formData.is_featured,
        ...(imageUrl && { image_url: imageUrl }),
        ...(imagePublicId && { image_public_id: imagePublicId }),
        ...(bannerUrl && { banner_url: bannerUrl }),
        ...(bannerPublicId && { banner_public_id: bannerPublicId }),
        ...(deleteOldImage && editingCategory?.image_public_id && { delete_old_image: true }),
        ...(deleteOldBanner && editingCategory?.banner_public_id && { delete_old_banner: true }),
      }

      // Save category
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, categoryData)
        toast({ title: "Success", description: "Category updated successfully" })
      } else {
        await categoryService.createCategory(categoryData)
        toast({ title: "Success", description: "Category created successfully" })
      }

      mutate("/api/admin/shop-categories/categories")
      onSaveSuccess(true)
      handleOpenChange(false)
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

  // Initialize form when editing
  useEffect(() => {
    if (editingCategory && open) {
      setFormData({
        name: editingCategory.name,
        slug: editingCategory.slug,
        description: editingCategory.description || "",
        is_featured: editingCategory.is_featured,
      })
      setCategoryImage({
        preview: editingCategory.image_url || null,
        file: null,
        isUploading: false,
      })
      setBannerImage({
        preview: editingCategory.banner_url || null,
        file: null,
        isUploading: false,
      })
    }
  }, [editingCategory, open])

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalHeader className="border-b border-gray-100">
        <ModalTitle className="text-lg font-medium text-gray-950">
          {editingCategory ? "Edit Category" : "New Category"}
        </ModalTitle>
      </ModalHeader>

      <ModalBody className="space-y-8 py-6">
        {/* Images Section */}
        <div className="space-y-6">
          {/* Category Image */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Category Image</Label>
            
            {categoryImage.preview ? (
              <div className="relative group">
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <Image
                    src={categoryImage.preview}
                    alt="Category preview"
                    fill
                    className="object-cover"
                  />
                  {categoryImage.isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => categoryImageInputRef.current?.click()}
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-900 transition"
                  >
                    Change
                  </button>
                  <button
                    onClick={() => setCategoryImage({ preview: null, file: null, isUploading: false })}
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-red-100 text-sm font-medium text-gray-900 hover:text-red-600 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => categoryImageInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center transition"
              >
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-600">Click to upload</span>
                </div>
              </button>
            )}

            <input
              ref={categoryImageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files?.[0] || null, true)}
              className="hidden"
            />
          </div>

          {/* Banner Image */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Banner Image (Optional)</Label>
            
            {bannerImage.preview ? (
              <div className="relative group">
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <Image
                    src={bannerImage.preview}
                    alt="Banner preview"
                    fill
                    className="object-cover"
                  />
                  {bannerImage.isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => bannerImageInputRef.current?.click()}
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-900 transition"
                  >
                    Change
                  </button>
                  <button
                    onClick={() => setBannerImage({ preview: null, file: null, isUploading: false })}
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-red-100 text-sm font-medium text-gray-900 hover:text-red-600 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => bannerImageInputRef.current?.click()}
                className="w-full aspect-[2] rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center transition"
              >
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-600">Click to upload</span>
                </div>
              </button>
            )}

            <input
              ref={bannerImageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files?.[0] || null, false)}
              className="hidden"
            />
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-4 border-t border-gray-100 pt-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Category name"
              className="mt-1.5 bg-white border-gray-200"
            />
          </div>

          <div>
            <Label htmlFor="slug" className="text-sm font-medium text-gray-700">
              URL Slug
            </Label>
            <Input
              id="slug"
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
              placeholder="url-slug"
              className="mt-1.5 bg-white border-gray-200"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Category description"
              className="mt-1.5 bg-white border-gray-200 resize-none"
              rows={3}
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="border-t border-gray-100">
        <Button
          variant="outline"
          onClick={() => handleOpenChange(false)}
          disabled={isLoading || categoryImage.isUploading || bannerImage.isUploading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isLoading || categoryImage.isUploading || bannerImage.isUploading}
          className="bg-gray-950 hover:bg-gray-900 text-white"
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : editingCategory ? (
            "Save Changes"
          ) : (
            "Create Category"
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
