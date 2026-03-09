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
import { Loader, ImageIcon, Upload, Save, X } from "lucide-react"
import Image from "next/image"
import { websocketService } from "@/services/websocket"
import { useSWRConfig } from "swr"
import { categoryService } from "@/services/category"

const getValidImageUrl = (url: string | null | undefined): string => {
  if (!url) return "/placeholder.svg"
  if (url.startsWith("data:")) return url
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
    return `${baseUrl}${url}`
  }
  return "/placeholder.svg"
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

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingCategory: Category | null
  onSaveSuccess: (bypassCache?: boolean) => void
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
  const [uploadingImage, setUploadingImage] = useState<"category" | "banner" | null>(null)
  const categoryImageRef = useRef<HTMLInputElement>(null)
  const bannerImageRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
    banner_url: "",
    is_featured: false,
    sort_order: 0,
  })

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        slug: editingCategory.slug,
        description: editingCategory.description || "",
        image_url: editingCategory.image_url || "",
        banner_url: editingCategory.banner_url || "",
        is_featured: editingCategory.is_featured,
        sort_order: editingCategory.sort_order,
      })
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        image_url: "",
        banner_url: "",
        is_featured: false,
        sort_order: 0,
      })
    }
  }, [editingCategory, open])

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""),
    }))
  }

  const handleImageUpload = async (file: File, type: "category" | "banner") => {
    if (!file) return

    try {
      setUploadingImage(type)
      const formDataObj = new FormData()
      formDataObj.append("file", file)

      const token = localStorage.getItem("admin_token") || localStorage.getItem("mizizzi_token")
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

      const response = await fetch(`${baseUrl}/api/admin/shop-categories/categories/upload-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataObj,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await response.json()

      const fieldName = type === "category" ? "image_url" : "banner_url"
      const imageUrl = data.url || data.data
      
      setFormData((prev) => ({
        ...prev,
        [fieldName]: imageUrl,
      }))

      toast({
        title: "Success",
        description: `${type === "category" ? "Category" : "Banner"} image uploaded`,
      })
    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      })
    } finally {
      setUploadingImage(null)
    }
  }

  const handleSave = async () => {
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

    try {
      setSaving(true)
      const token = localStorage.getItem("admin_token") || localStorage.getItem("mizizzi_token")
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

      // Extract base64 data from data URLs if they exist
      let imageData = formData.image_url
      let imageMimetype = "image/jpeg"
      if (formData.image_url?.startsWith("data:")) {
        const matches = formData.image_url.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          imageMimetype = matches[1]
          imageData = matches[2]
        }
      }

      let bannerData = formData.banner_url
      let bannerMimetype = "image/jpeg"
      if (formData.banner_url?.startsWith("data:")) {
        const matches = formData.banner_url.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          bannerMimetype = matches[1]
          bannerData = matches[2]
        }
      }

      const payload: Record<string, any> = {
        name: formData.name.trim(),
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
        description: formData.description.trim(),
        is_featured: formData.is_featured,
        sort_order: formData.sort_order,
      }

      // Add image data if it's a new upload or if the URL has changed
      if (imageData && imageData !== editingCategory?.image_url) {
        if (imageData.includes("base64") || !imageData.startsWith("http")) {
          // Base64 encoded data - send as base64
          payload.image_data = imageData
          payload.image_mimetype = imageMimetype
          payload.image_filename = "category_image.jpg"
        } else {
          // URL-based image (e.g., from Cloudinary) - send as URL
          payload.image_url = imageData
        }
      }

      // Add banner data if it's a new upload or if the URL has changed
      if (bannerData && bannerData !== editingCategory?.banner_url) {
        if (bannerData.includes("base64") || !bannerData.startsWith("http")) {
          // Base64 encoded data - send as base64
          payload.banner_data = bannerData
          payload.banner_mimetype = bannerMimetype
          payload.banner_filename = "category_banner.jpg"
        } else {
          // URL-based image - send as URL
          payload.banner_url = bannerData
        }
      }

      const url = editingCategory
        ? `${baseUrl}/api/admin/shop-categories/categories/${editingCategory.id}`
        : `${baseUrl}/api/admin/shop-categories/categories`

      const response = await fetch(url, {
        method: editingCategory ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save category")
      }

      await response.json()

      toast({
        title: "Success",
        description: editingCategory ? "Category updated successfully" : "Category created successfully",
      })

      await websocketService.emit("category_updated", {
        type: editingCategory ? "updated" : "created",
        category: payload,
      })

      // Clear caches and force a full refresh of categories
      categoryService.clearCache()
      mutate((key: any) => typeof key === "string" && key.includes("categories"), undefined, { revalidate: true })
      
      // Close dialog and refetch immediately with cache busting to get updated image URLs
      onOpenChange(false)
      onSaveSuccess(true)
    } catch (error) {
      console.error("Error saving category:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editingCategory ? "Edit Category" : "Create Category"}
      description={
        editingCategory
          ? "Update your category details and visibility settings"
          : "Set up a new category for your store"
      }
      size="lg"
      footer={
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="flex-1 sm:flex-none h-10 rounded-lg font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.name.trim() || !formData.image_url}
            className="flex-1 sm:flex-none h-10 rounded-lg font-medium gap-2"
          >
            {saving ? (
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
          </Button>
        </ModalFooter>
      }
    >
      <ModalBody className="space-y-6">
        {/* Images Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-600" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Images</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Image */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900">
                Category Image <span className="text-red-500">*</span>
              </Label>
              <div
                className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors duration-200 h-32 group cursor-pointer"
                onClick={() => categoryImageRef.current?.click()}
              >
                <Image
                  src={getValidImageUrl(formData.image_url)}
                  alt="Category preview"
                  fill
                  className="object-cover group-hover:opacity-90 transition-opacity"
                />
                {!formData.image_url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 text-white mx-auto mb-2" />
                      <p className="text-xs text-white font-medium">Click to upload</p>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={categoryImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file, "category")
                }}
                disabled={uploadingImage === "category"}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => categoryImageRef.current?.click()}
                disabled={uploadingImage === "category"}
                className="w-full h-9 rounded-lg font-medium text-sm"
              >
                {uploadingImage === "category" ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {formData.image_url ? "Change" : "Upload"} Image
                  </>
                )}
              </Button>
            </div>

            {/* Banner Image */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900">
                Banner Image <span className="text-gray-400">(Optional)</span>
              </Label>
              <div
                className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors duration-200 h-32 group cursor-pointer"
                onClick={() => bannerImageRef.current?.click()}
              >
                <Image
                  src={getValidImageUrl(formData.banner_url)}
                  alt="Banner preview"
                  fill
                  className="object-cover group-hover:opacity-90 transition-opacity"
                />
                {!formData.banner_url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 text-white mx-auto mb-2" />
                      <p className="text-xs text-white font-medium">Click to upload</p>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={bannerImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file, "banner")
                }}
                disabled={uploadingImage === "banner"}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => bannerImageRef.current?.click()}
                disabled={uploadingImage === "banner"}
                className="w-full h-9 rounded-lg font-medium text-sm"
              >
                {uploadingImage === "banner" ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {formData.banner_url ? "Change" : "Upload"} Banner
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200" />

        {/* Category Details Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-600" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Details</h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-sm font-semibold text-gray-900">
                Category Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter category name"
                className="mt-2 h-10 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <Label htmlFor="slug" className="text-sm font-semibold text-gray-900">
                URL Slug
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="category-slug"
                className="mt-2 h-10 rounded-lg font-mono text-xs border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-semibold text-gray-900">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add a description for this category"
                rows={3}
                className="mt-2 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200" />

        {/* Settings Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-600" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Settings</h3>
          </div>

          {/* Featured Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-gray-900">Featured Category</p>
              <p className="text-xs text-gray-600">Display on homepage</p>
            </div>
            <Switch
              checked={formData.is_featured}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_featured: checked }))
              }
            />
          </div>

          {/* Sort Order */}
          <div>
            <Label htmlFor="sort_order" className="text-sm font-semibold text-gray-900">
              Display Order
            </Label>
            <Input
              id="sort_order"
              type="number"
              value={formData.sort_order}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  sort_order: Number.parseInt(e.target.value) || 0,
                }))
              }
              min={0}
              className="mt-2 h-10 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </ModalBody>
    </Modal>
  )
}
