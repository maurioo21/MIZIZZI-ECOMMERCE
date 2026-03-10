"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, X, Loader2 } from "lucide-react"
import Image from "next/image"

interface ImageUploaderProps {
  onUpload: (url: string, publicId?: string) => void | Promise<void>
  currentImage?: string
  type?: "carousel" | "product" // Type determines compression level
}

export function ImageUploader({ onUpload, currentImage, type = "product" }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState(currentImage || "")
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Compression settings by type
  const compressionSettings = {
    carousel: { maxWidth: 1400, maxHeight: 500, quality: 75, maxFileSize: 300 * 1024 }, // 300KB target
    product: { maxWidth: 1200, maxHeight: 1200, quality: 85, maxFileSize: 500 * 1024 }, // 500KB target
  }

  const settings = compressionSettings[type]

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        const img = new window.Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          let width = img.width
          let height = img.height

          // Calculate new dimensions maintaining aspect ratio
          if (width > height) {
            if (width > settings.maxWidth) {
              height = Math.round((height * settings.maxWidth) / width)
              width = settings.maxWidth
            }
          } else {
            if (height > settings.maxHeight) {
              width = Math.round((width * settings.maxHeight) / height)
              height = settings.maxHeight
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Could not compress image"))
                return
              }
              resolve(blob)
            },
            "image/jpeg",
            settings.quality / 100
          )
        }

        img.onerror = () => reject(new Error("Could not load image"))
        img.src = e.target?.result as string
      }

      reader.onerror = () => reject(new Error("Could not read file"))
      reader.readAsDataURL(file)
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // Validate file size before compression
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please select a file under 10MB")
      return
    }

    setIsUploading(true)
    setUploadProgress(20)

    try {
      // Compress image
      setUploadProgress(50)
      const compressedBlob = await compressImage(file)
      setUploadProgress(75)

      // Check compressed size
      const compressedSize = compressedBlob.size
      console.log(
        `[v0] Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${type})`
      )

      if (compressedSize > settings.maxFileSize) {
        console.warn(
          `[v0] Compressed file (${(compressedSize / 1024).toFixed(1)}KB) exceeds target size (${(settings.maxFileSize / 1024).toFixed(1)}KB)`
        )
      }

      // Create object URL for preview
      const compressedUrl = URL.createObjectURL(compressedBlob)
      setPreview(compressedUrl)

      setUploadProgress(90)

      // Upload to backend
      const formData = new FormData()
      const compressedFile = new File([compressedBlob], file.name, { type: "image/jpeg" })
      formData.append("file", compressedFile)

      // Get token from localStorage (check multiple possible keys)
      const token = localStorage.getItem("admin_token") || 
                   localStorage.getItem("mizizzi_token") || 
                   localStorage.getItem("token") || 
                   localStorage.getItem("access_token")

      if (!token) {
        alert("Authentication required. Please login again.")
        setIsUploading(false)
        setUploadProgress(0)
        return
      }

      // Use backend API URL directly (no Next.js API routes)
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://mizizzi-ecommerce-1.onrender.com"
      const uploadEndpoint = `${backendUrl}/api/admin/cloudinary/upload`

      console.log(`[v0] Uploading to backend: ${uploadEndpoint} with token: ${token.substring(0, 10)}...`)

      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error(`[v0] Upload error response:`, errorData)
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await response.json()
      
      // Extract URL from backend response structure
      let cloudinaryUrl = ""
      let cloudinaryPublicId = ""
      
      // Try different response structures from backend
      if (data.uploaded_images && data.uploaded_images.length > 0) {
        cloudinaryUrl = data.uploaded_images[0].secure_url || data.uploaded_images[0].url
        cloudinaryPublicId = data.uploaded_images[0].public_id
      } else if (data.uploaded && data.uploaded.length > 0) {
        cloudinaryUrl = data.uploaded[0].secure_url || data.uploaded[0].url
        cloudinaryPublicId = data.uploaded[0].public_id
      } else if (data.secure_url) {
        cloudinaryUrl = data.secure_url
        cloudinaryPublicId = data.public_id
      } else if (data.url) {
        cloudinaryUrl = data.url
        cloudinaryPublicId = data.public_id
      }
      
      console.log(`[v0] Image uploaded successfully: ${cloudinaryUrl}`)
      console.log(`[v0] Cloudinary public_id: ${cloudinaryPublicId}`)
      console.log(`[v0] Backend response:`, data)
      
      if (!cloudinaryUrl) {
        throw new Error("No image URL returned from server")
      }
      
      console.log(`[v0] Using Cloudinary CDN URL: ${cloudinaryUrl}`)
      
      // Call onUpload with both URL and public_id
      await Promise.resolve(onUpload(cloudinaryUrl, cloudinaryPublicId))
      setUploadProgress(100)
      setIsUploading(false)
    } catch (error) {
      console.error("[v0] Compression error:", error)
      alert("Failed to compress image. Please try another file.")
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const aspectRatio = type === "carousel" ? "1400:500" : "1:1"
  const previewHeight = type === "carousel" ? "h-32" : "h-40"

  return (
    <Card>
      <CardContent className="p-4">
        {preview ? (
          <div className="space-y-3">
            <div className={`relative w-full ${previewHeight} rounded-lg overflow-hidden bg-muted`}>
              {preview.startsWith("blob:") ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Image src={preview || "/placeholder.svg"} alt="Preview" fill className="object-cover" />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground text-center">
                Aspect ratio: {aspectRatio}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreview("")
                  onUpload("")
                  setUploadProgress(0)
                }}
                className="w-full gap-2"
              >
                <X className="h-4 w-4" />
                Remove Image
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Compressing image...</p>
                  <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload image</p>
                <p className="text-xs text-muted-foreground">
                  {type === "carousel"
                    ? "Carousel optimized (1400x500, max 300KB)"
                    : "PNG, JPG, GIF up to 5MB"}
                </p>
              </div>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
      </CardContent>
    </Card>
  )
}
