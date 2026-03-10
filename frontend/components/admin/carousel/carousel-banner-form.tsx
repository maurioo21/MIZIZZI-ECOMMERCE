"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X, Loader2, Calendar, BarChart3 } from "lucide-react"
import { ImageUploader } from "@/components/admin/image-uploader"
import { useToast } from "@/hooks/use-toast"
import type { CarouselBanner } from "@/types/carousel-admin"

interface CarouselBannerFormProps {
  banner?: CarouselBanner | null
  onClose: () => void
  onSubmit: (data: Partial<CarouselBanner>) => Promise<void>
}

export function CarouselBannerForm({ banner, onClose, onSubmit }: CarouselBannerFormProps) {
  const { toast } = useToast()
  
  const [formData, setFormData] = useState<Partial<CarouselBanner>>({
    name: banner?.name || "",
    title: banner?.title || "",
    description: banner?.description || "",
    badge_text: banner?.badge_text || "",
    discount: banner?.discount || "",
    button_text: banner?.button_text || "VIEW COLLECTION",
    link_url: banner?.link_url || "",
    image_url: banner?.image_url || "",
    image_public_id: banner?.image_public_id || "",  // Store Cloudinary public_id
    is_active: banner?.is_active ?? true,
    start_date: banner?.start_date || "",
    end_date: banner?.end_date || "",
    priority: banner?.priority || 0,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageUrl, setImageUrl] = useState(banner?.image_url || "")
  const [imagePublicId, setImagePublicId] = useState(banner?.image_public_id || "")

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleImageUpload = async (url: string, publicId?: string) => {
    // Use Cloudinary URL directly - it's already optimized for CDN delivery
    const optimizedUrl = url || ""
    const cloudinaryPublicId = publicId || ""
    
    setImageUrl(optimizedUrl)
    setImagePublicId(cloudinaryPublicId)
    const updatedFormData = {
      ...formData,
      image_url: optimizedUrl,
      image_public_id: cloudinaryPublicId,
    }
    setFormData(updatedFormData)
    
    // Auto-save image URL if banner already exists (editing mode)
    if (banner?.id) {
      setIsSubmitting(true)
      try {
        // For editing, pass only image fields - don't create a new banner
        await onSubmit({ 
          image_url: optimizedUrl,
          image_public_id: cloudinaryPublicId,
          delete_old_image: true,  // Flag to delete old Cloudinary image
        })
        toast({
          title: "Image Saved",
          description: "Banner image updated successfully",
        })
      } catch (error) {
        console.error(`[v0] Auto-save failed:`, error)
        toast({
          title: "Auto-save Failed",
          description: "Image uploaded but couldn't save to banner. Please click Update Banner.",
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // For new banner, just show success and keep form open for other details
      toast({
        title: "Image Ready",
        description: "Image uploaded. Fill in other details and click Create Banner to save.",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b flex items-center justify-between p-6 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-2xl font-bold">{banner ? "Edit Banner" : "Create Banner"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {banner ? "Update carousel banner details" : "Add a new carousel banner to your store"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="image" className="text-base font-semibold flex items-center gap-2">
                  Banner Image
                  <span className="text-xs text-muted-foreground font-normal">(Required)</span>
                </Label>
                <ImageUploader onUpload={handleImageUpload} currentImage={imageUrl} type="carousel" />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-semibold">
                  Banner Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Summer Collection 2025"
                  required
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Internal name for identification</p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-semibold">
                  Display Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Timeless Elegance in Every Detail"
                  required
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Main heading shown on the banner</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-semibold">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g., Experience craftsmanship and quality that lasts a lifetime."
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">Supporting text below the title</p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Badge and Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="badge_text" className="text-base font-semibold">
                    Badge Text
                  </Label>
                  <Input
                    id="badge_text"
                    name="badge_text"
                    value={formData.badge_text}
                    onChange={handleInputChange}
                    placeholder="e.g., EXCLUSIVE"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discount" className="text-base font-semibold">
                    Discount
                  </Label>
                  <Input
                    id="discount"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                    placeholder="e.g., 25% OFF"
                    className="h-11"
                  />
                </div>
              </div>

              {/* Button Text and Link */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="button_text" className="text-base font-semibold">
                    Button Text
                  </Label>
                  <Input
                    id="button_text"
                    name="button_text"
                    value={formData.button_text}
                    onChange={handleInputChange}
                    placeholder="e.g., VIEW COLLECTION"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link_url" className="text-base font-semibold">
                    Link URL
                  </Label>
                  <Input
                    id="link_url"
                    name="link_url"
                    value={formData.link_url}
                    onChange={handleInputChange}
                    placeholder="e.g., /products"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4" />
                  Schedule Banner
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date" className="text-sm">
                      Start Date
                    </Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date" className="text-sm">
                      End Date
                    </Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={handleInputChange}
                      className="h-10"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Leave empty for always active</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Priority
                </Label>
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Higher priority banners appear first (0-100)</p>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 h-5 w-5"
                />
                <label htmlFor="is_active" className="text-sm font-medium cursor-pointer flex-1">
                  Active
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    Banner will be visible to customers
                  </p>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {banner ? "Update Banner" : "Create Banner"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
