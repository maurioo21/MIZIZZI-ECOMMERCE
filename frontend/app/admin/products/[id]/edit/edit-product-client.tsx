"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAdminAuth } from "@/contexts/admin/auth-context"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ProductBasicInfoTab } from "@/components/admin/products/product-basic-info-tab"
import { ProductPricingInventoryTab } from "@/components/admin/products/product-pricing-inventory-tab"
import { ProductImagesTab } from "@/components/admin/products/product-images-tab"
import { ProductVariantsTab } from "@/components/admin/products/product-variants-tab"
import { ProductSeoTab } from "@/components/admin/products/product-seo-tab"
import { ProductSpecificationsHighlightsTab } from "@/components/admin/products/product-specifications-highlights-tab"
import { useProductForm } from "@/hooks/use-product-form"
import type { Product } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { websocketService } from "@/services/websocket"
// Update imports at the top of the file to include our new hooks
import { useProduct, useProductImages, useCategories, useBrands } from "@/hooks/use-swr-product"
import { FormProvider } from "react-hook-form"
// Add import for NetworkDetector
import { NetworkDetector } from "@/components/network-detector"
import { productService } from "@/services/product"

// Function to check if productId is a valid number
const isValidProductId = (productId: string): boolean => {
  return !isNaN(Number(productId)) && Number(productId) > 0
}

// Client component that receives the unwrapped productId as a prop
export function EditProductClient({ 
  productId,
  initialProduct,
  initialCategories = [],
  initialBrands = [],
  initialImages = [],
}: { 
  productId: string
  initialProduct?: any
  initialCategories?: any[]
  initialBrands?: any[]
  initialImages?: any[]
}) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, logout, refreshAccessToken, getToken } = useAdminAuth()

  const [isLoading, setIsLoading] = useState(!initialProduct || initialCategories.length === 0 || initialBrands.length === 0)
  // Use SWR with initial data from SSR
  const { product, isLoading: isLoadingProduct, isError: productError, mutate: mutateProduct } = useProduct(productId, { fallbackData: initialProduct })
  const { images: productImages, mutate: mutateImages } = useProductImages(
    isValidProductId(productId) ? productId : undefined,
    { fallbackData: initialImages }
  )
  const {
    categories,
    isLoading: isLoadingCategories,
    isError: categoriesError,
    mutate: mutateCategories,
  } = useCategories({ fallbackData: initialCategories })
  const { brands, isLoading: isLoadingBrands, isError: brandsError } = useBrands({ fallbackData: initialBrands })
  const [activeTab, setActiveTab] = useState("basic")
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState(false)
  const [navigateTo, setNavigateTo] = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [brandError, setBrandError] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [dataFetched, setDataFetched] = useState(false)
  const [formReady, setFormReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isUpdatingForm = useRef(false)
  const [lastAutoSave, setLastAutoSave] = useState<string | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const fetchAttemptRef = useRef(0)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  // Add isOnline state
  const [isOnline, setIsOnline] = useState(true)

  // Initialize form with custom hook
  const {
    form,
    formState,
    isSubmitting: isFormSubmitting,
    formChanged,
    setFormChanged,
    images,
    setImages,
    variants,
    setVariants,
    resetForm,
    handleSubmit,
  } = useProductForm({
    productId,
    onSuccess: (updatedProduct: Product) => {
      // setProduct(updatedProduct)
      setSaveSuccess(true)
      setLastSaved(new Date().toLocaleTimeString())
      setFormChanged(false)

      toast({
        title: "Product Updated Successfully",
        description: `${updatedProduct.name} has been updated with the latest information.`,
      })

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)
      mutateProduct()
      mutateImages()
    },
    onError: (error: string) => {
      setApiError(error)
      toast({
        title: "Update Failed",
        description: error,
        variant: "destructive",
      })
    },
  })

  // Update the handleAutoSave function to check network status
  const handleAutoSave = async () => {
    if (!formChanged || isSubmitting || !isOnline) return

    try {
      if (await ensureValidToken()) {
        setIsSubmitting(true)

        const values = form.getValues()

        await handleSubmit(values)

        setLastAutoSave(new Date().toLocaleTimeString())

        setIsSubmitting(false)
      }
    } catch (error) {
      console.error("Auto-save failed:", error)
      setIsSubmitting(false)
    }
  }

  // Set up auto-save timer when enabled
  useEffect(() => {
    if (autoSaveEnabled && formChanged) {
      // Auto-save every 2 minutes if there are changes
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
      autoSaveTimerRef.current = setInterval(handleAutoSave, 2 * 60 * 1000)
    } else if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [autoSaveEnabled, formChanged, isSubmitting, isOnline])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/products")
    }
  }, [isAuthenticated, authLoading, router])

  // Update the resetForm call to use the SWR product data when it becomes available
  useEffect(() => {
    // only reset if we haven't initialized the form yet
    if (product && !isLoadingProduct && !formReady) {
      console.log("SWR product data loaded, resetting form:", product)
      resetForm(product)
      setFormReady(true)
      setDataFetched(true)
      setIsLoading(false)
    }
  }, [product, isLoadingProduct, resetForm, formReady])

  const ensureValidToken = async (): Promise<boolean> => {
    try {
      // Check if we have any token at all
      const currentToken = getToken()
      if (!currentToken) {
        toast({
          title: "Authentication Required",
          description: "Please log in to continue.",
          variant: "destructive",
        })
        logout()
        router.push("/admin/login?reason=authentication_required")
        return false
      }

      // If we have a current token, use it directly without forcing refresh
      // This prevents unnecessary redirects during save operations
      // Only attempt refresh if the API call itself fails with 401
      return true
    } catch (error: any) {
      console.error("[v0] Token validation error:", error)
      toast({
        title: "Authentication Error",
        description: "Unable to verify your session. Please log in again.",
        variant: "destructive",
      })
      logout()
      router.push("/admin/login?reason=authentication_error")
      return false
    }
  }

  // Handle navigation with unsaved changes check
  const handleNavigation = (path: string) => {
    if (formChanged) {
      setNavigateTo(path)
      setUnsavedChangesDialog(true)
    } else {
      router.push(path)
    }
  }

  const saveSectionChanges = useCallback(
    async (section: string): Promise<boolean> => {
      try {
        // Show saving toast
        toast({
          title: `Saving ${section}`,
          description: "Please wait while your changes are being saved...",
        })

        setIsSubmitting(true)
        setApiError(null)

        // Ensure we have a valid token before proceeding
        if (!(await ensureValidToken())) {
          setIsSubmitting(false)
          return false
        }

        // Get current form values
        const formValues = form.getValues()

        // Prepare product data for submission
        const productData = {
          ...formValues,
          image_urls: images,
          thumbnail_url: images.length > 0 ? images[0] : null,
          variants: variants,
        }

        // If the brand_id is 0 (from the "None" option), set it to null
        if (productData.brand_id === 0) {
          productData.brand_id = null
        }

        // Remove fields that the backend doesn't handle
        // The backend only handles specific fields defined in the update_product route
        // NOTE: SKU is excluded as it's auto-generated and read-only
        const allowedFields = [
          'name', 'slug', 'description', 'price', 'sale_price', 'stock',
          'category_id', 'brand_id', 'weight',
          'is_featured', 'is_new', 'is_sale', 'is_flash_sale', 'is_luxury_deal',
          'meta_title', 'meta_description', 'material',
          'image_urls', 'thumbnail_url', 'tags'
        ]

        const cleanedData = Object.keys(productData).reduce((acc: Record<string, any>, key) => {
          if (allowedFields.includes(key)) {
            acc[key] = productData[key]
          }
          return acc
        }, {})

        console.log(`[v0] Submitting ${section} data for product ID: ${productId}`)
        console.log("[v0] Cleaned payload being sent:", JSON.stringify(cleanedData, null, 2))

        // Dispatch event to notify that update is starting
        if (typeof window !== "undefined") {
          const startEvent = new CustomEvent("product-update-start", {
            detail: { id: productId, section },
          })
          window.dispatchEvent(startEvent)
        }

        const token = getToken()
        if (!token) {
          console.log("[v0] Token not available after refresh attempt")
          throw new Error("Authentication token not found. Please log in again.")
        }

        // Set up headers with authentication
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }

        // Add a timeout to ensure the request doesn't hang
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
          // Make the API call with proper headers and timeout
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/products/${productId}`, {
            method: "PUT",
            headers: headers,
            body: JSON.stringify(cleanedData),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (response.status === 401) {
            console.log("[v0] Received 401, attempting token refresh and retry")

            // Try refreshing token one more time
            const refreshSuccess = await ensureValidToken()
            if (refreshSuccess) {
              const newToken = getToken()
              if (newToken) {
                // Retry the request with new token
                const retryResponse = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/products/${productId}`,
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${newToken}`,
                    },
                    body: JSON.stringify(cleanedData),
                  },
                )

                if (retryResponse.ok) {
                  const updatedProduct = await retryResponse.json()
                  console.log(
                    `[v0] ${section} updated successfully for product ID: ${productId} (${updatedProduct.name})`,
                  )

                  // Update the UI
                  setSaveSuccess(true)
                  setLastSaved(new Date().toLocaleTimeString())
                  setFormChanged(false)

                  toast({
                    title: `${section} Updated Successfully`,
                    description: `${updatedProduct.name} has been updated.`,
                  })

                  setTimeout(() => setSaveSuccess(false), 3000)

                  try {
                    localStorage.setItem(`product_${productId}_last_saved`, new Date().toISOString())
                  } catch (storageError) {
                    console.warn("[v0] Could not save to localStorage:", storageError)
                  }

                  // Notify about product update
                  try {
                    websocketService.emit("product_updated", {
                      id: productId,
                      timestamp: Date.now(),
                      section: section,
                      product: updatedProduct,
                    })
                    console.log(`[v0] WebSocket notification sent for product ID: ${productId}`)

                    if (typeof window !== "undefined") {
                      const event = new CustomEvent("product-updated", {
                        detail: { id: productId, product: updatedProduct, section },
                      })
                      window.dispatchEvent(event)
                      console.log(`[v0] Custom event dispatched for product ID: ${productId}`)
                    }
                  } catch (notifyError) {
                    console.warn("[v0] Failed to notify about product update:", notifyError)
                  }

                  productService.invalidateProductCache(productId)
                  await new Promise((resolve) => setTimeout(resolve, 500))

                  mutateProduct(undefined, { revalidate: true })
                  mutateImages(undefined, { revalidate: true })
                  return true
                } else {
                  // Retry also failed
                  let retryErrorData = {}
                  try {
                    const retryErrorText = await retryResponse.text()
                    retryErrorData = JSON.parse(retryErrorText)
                  } catch {
                    retryErrorData = { status: retryResponse.status }
                  }
                  console.error("[v0] Retry request also failed:", retryErrorData)
                }
              }
            }

            // If retry failed, throw authentication error
            throw new Error("Authentication failed. Your session has expired. Please log in again.")
          }

          // Check if the response is ok
          if (!response.ok) {
            let errorData = {}
            let errorText = ""
            try {
              errorText = await response.text()
              errorData = JSON.parse(errorText)
            } catch {
              errorData = { raw_error: errorText }
            }
            console.error("[v0] API error response status:", response.status)
            console.error("[v0] API error response data:", errorData)
            throw new Error(errorData.message || errorData.error || `Failed to update product. Status: ${response.status}`)
          }

          // Parse the response
          const updatedProduct = await response.json()
          const productName = formValues.name || product?.name || "Product"
          console.log(`[v0] ${section} updated successfully for product ID: ${productId} (${productName})`)

          // Update the UI
          setSaveSuccess(true)
          setLastSaved(new Date().toLocaleTimeString())
          setFormChanged(false)

          toast({
            title: `${section} Updated Successfully`,
            description: `${productName} has been updated with the latest information.`,
          })

          // Hide success message after 3 seconds
          setTimeout(() => {
            setSaveSuccess(false)
          }, 3000)

          // Update local storage to track last saved time
          try {
            localStorage.setItem(`product_${productId}_last_saved`, new Date().toISOString())
          } catch (storageError) {
            console.warn("[v0] Could not save to localStorage:", storageError)
          }

          // Notify about product update via WebSocket
          try {
            websocketService.emit("product_updated", {
              id: productId,
              timestamp: Date.now(),
              section: section,
              product: updatedProduct,
            })
            console.log(`[v0] WebSocket notification sent for product ID: ${productId}`)

            // Don't dispatch custom event here to prevent infinite loops
            // SWR revalidation is sufficient for data sync
          } catch (notifyError) {
            console.warn("[v0] Failed to notify about product update:", notifyError)
          }

          productService.invalidateProductCache(productId)
          
          // Shorter delay before revalidation
          await new Promise((resolve) => setTimeout(resolve, 300))

          // Soft revalidate in background without triggering events
          mutateProduct()
          mutateImages()

          return true
        } catch (fetchError: any) {
          clearTimeout(timeoutId)

          if (fetchError.name === "AbortError") {
            console.error("[v0] Update request timed out")
            throw new Error("Request timed out. Please try again.")
          }

          throw fetchError
        }
      } catch (error: any) {
        console.error("[v0] Error in saveSectionChanges:", error)

        toast({
          title: "Error Saving Changes",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        })

        // Check if this is an authentication error
        if (
          error.response?.status === 401 ||
          error.message?.includes("Authentication") ||
          error.message?.includes("session")
        ) {
          logout()
          router.push("/admin/login?reason=authentication_failed")
        }

        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      productId,
      form,
      images,
      variants,
      isAuthenticated,
      refreshAccessToken,
      getToken,
      logout,
      router,
      toast,
      resetForm,
      setFormChanged,
      mutateProduct,
      mutateImages,
    ],
  )

  // Add useEffect to listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Set initial state
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Add the NetworkDetector component to the return JSX
  // Add this right after the opening div in your component's return
  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <NetworkDetector />
      {/* ...rest of your JSX... */}
      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" onClick={() => handleNavigation("/admin/products")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">
                Edit Product: {product?.name}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        {apiError && (
          <div className="px-6 pt-2">
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          </div>
        )}

        <CardContent className="p-0">
          <FormProvider {...form}>
            <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b">
                <TabsList className="bg-transparent h-auto p-0 w-full flex overflow-x-auto">
                  <TabsTrigger
                    value="basic"
                    className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-3 px-4"
                  >
                    Basic Info
                  </TabsTrigger>
                  <TabsTrigger
                    value="pricing"
                    className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-3 px-4"
                  >
                    Pricing & Inventory
                  </TabsTrigger>
                  <TabsTrigger
                    value="images"
                    className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-3 px-4"
                  >
                    Images
                  </TabsTrigger>
                  <TabsTrigger
                    value="variants"
                    className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-3 px-4"
                  >
                    Variants
                  </TabsTrigger>
                  <TabsTrigger
                    value="seo"
                    className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-3 px-4"
                  >
                    SEO
                  </TabsTrigger>
                  {/* Added new tab trigger for specifications and highlights */}
                  <TabsTrigger
                    value="specs"
                    className="flex-1 data-[state=active]:bg-orange-50 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none py-3 px-4"
                  >
                    Specs & Highlights
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="basic" className="mt-0">
                  <ProductBasicInfoTab
                    form={form}
                    categories={categories}
                    brands={brands}
                    isLoadingCategories={isLoadingCategories}
                    isLoadingBrands={isLoadingBrands}
                    brandError={brandError}
                    saveSectionChanges={saveSectionChanges}
                    mutateCategories={mutateCategories}
                  />
                </TabsContent>

                <TabsContent value="pricing" className="mt-0">
                  <ProductPricingInventoryTab
                    form={form}
                    saveSectionChanges={saveSectionChanges}
                    productId={Number(productId)}
                  />
                </TabsContent>

                <TabsContent value="images" className="mt-0">
                  <ProductImagesTab
                    images={images}
                    setImages={(imgs) => setImages(imgs as string[])}
                    setFormChanged={setFormChanged}
                    saveSectionChanges={saveSectionChanges}
                    productId={Number(productId)}
                  />
                </TabsContent>

                <TabsContent value="variants" className="mt-0">
                  <ProductVariantsTab
                    variants={variants}
                    setVariants={setVariants}
                    productId={Number(productId)}
                    setFormChanged={setFormChanged}
                    productPrice={product?.price || 0}
                    saveSectionChanges={saveSectionChanges}
                  />
                </TabsContent>

                <TabsContent value="seo" className="mt-0">
                  <ProductSeoTab form={form} saveSectionChanges={saveSectionChanges} />
                </TabsContent>

                {/* Added new tab content for specifications and highlights */}
                <TabsContent value="specs" className="mt-0">
                  <ProductSpecificationsHighlightsTab form={form} saveSectionChanges={saveSectionChanges} />
                </TabsContent>
              </div>
            </Tabs>
          </FormProvider>
        </CardContent>
      </Card>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={unsavedChangesDialog} onOpenChange={setUnsavedChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUnsavedChangesDialog(false)
                router.push(navigateTo)
              }}
            >
              Leave Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
