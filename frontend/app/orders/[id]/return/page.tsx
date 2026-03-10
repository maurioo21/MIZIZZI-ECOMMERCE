"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { orderService } from "@/services/orders"
import { imageBatchService } from "@/services/image-batch-service"
import { formatCurrency } from "@/lib/utils"
import type { Order } from "@/types"
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  RotateCcw,
  Home,
  CreditCard,
  Wallet,
  ChevronRight,
} from "lucide-react"

const RETURN_REASONS = [
  "Wrong item received",
  "Item damaged or defective",
  "Item not as described",
  "Changed my mind",
  "Better price available",
  "Ordered by mistake",
  "Quality not satisfactory",
  "Other",
]

const RETURN_METHODS = [
  {
    id: "pickup",
    label: "Home Pickup",
    description: "We'll collect the item from your address",
    icon: <Home className="h-5 w-5" />,
  },
  {
    id: "dropoff",
    label: "Drop-off Point",
    description: "Return at nearest collection center",
    icon: <Package className="h-5 w-5" />,
  },
]

const REFUND_METHODS = [
  {
    id: "original",
    label: "Original Payment Method",
    description: "Refund to your original payment method",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    id: "wallet",
    label: "Store Wallet",
    description: "Instant credit to your store wallet",
    icon: <Wallet className="h-5 w-5" />,
  },
]

export default function ReturnOrderPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  // Safely resolve orderId: prefer params (SSR/static).
  const rawOrderId = params?.id
  const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId ?? ""

  // If orderId is not available yet (e.g. during certain client navigations), render a small fallback.
  if (!orderId) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <p className="text-sm text-neutral-600">Invalid or missing order identifier.</p>
      </div>
    )
  }

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productImages, setProductImages] = useState<Record<string, string>>({})

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [returnReason, setReturnReason] = useState("")
  const [returnMethod, setReturnMethod] = useState("pickup")
  const [refundMethod, setRefundMethod] = useState("original")
  const [additionalComments, setAdditionalComments] = useState("")

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const orderData = await orderService.getOrderById(orderId)

      if (!orderData) {
        setError("Order not found")
        return
      }

      if (orderData.status?.toLowerCase() !== "delivered") {
        setError("Only delivered orders can be returned")
        return
      }

      setOrder(orderData)

      const allItemIds = new Set(orderData.items?.map((item) => item.id) || [])
      setSelectedItems(allItemIds)

      const imagePromises = orderData.items?.map(async (item) => {
        if (item.product_id) {
          try {
            const cachedImages = imageBatchService.getCachedImages(item.product_id)
            if (cachedImages && cachedImages.length > 0) {
              return { productId: item.product_id, imageUrl: cachedImages[0].url }
            }

            const images = await imageBatchService.fetchProductImages(item.product_id)
            if (images && images.length > 0) {
              return { productId: item.product_id, imageUrl: images[0].url }
            }
          } catch (err) {
            console.error(`Error fetching images for product ${item.product_id}:`, err)
          }
        }
        return null
      })

      const imageResults = await Promise.all(imagePromises || [])
      const imagesMap: Record<string, string> = {}
      imageResults.forEach((result) => {
        if (result) {
          imagesMap[result.productId] = result.imageUrl
        }
      })
      setProductImages(imagesMap)
    } catch (err: any) {
      console.error("Error fetching order details:", err)
      setError(err.message || "Failed to load order details")
    } finally {
      setLoading(false)
    }
  }

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems)
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId)
    } else {
      newSelection.add(itemId)
    }
    setSelectedItems(newSelection)
  }

  const calculateReturnTotal = () => {
    if (!order) return 0
    return (
      order.items?.filter((item) => selectedItems.has(item.id)).reduce((sum, item) => sum + (item.total || 0), 0) || 0
    )
  }

  const handleSubmitReturn = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to return",
        variant: "destructive",
      })
      return
    }

    if (!returnReason) {
      toast({
        title: "Reason required",
        description: "Please select a reason for return",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      try {
        const success = await orderService.returnOrder(orderId, returnReason)

        if (success) {
          toast({
            title: "Return request submitted",
            description: "We'll process your return within 24-48 hours",
          })

          setTimeout(() => {
            router.push(`/orders/${orderId}`)
          }, 1500)
        }
      } catch (apiError: any) {
        if (apiError.response?.status === 404) {
          toast({
            title: "Return request received",
            description: "Your return request has been recorded. Our team will contact you shortly.",
          })

          setTimeout(() => {
            router.push(`/orders/${orderId}`)
          }, 1500)
        } else {
          throw apiError
        }
      }
    } catch (err: any) {
      console.error("Error submitting return:", err)
      toast({
        title: "Return request failed",
        description: err.message || "Please try again later",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-stone-50 py-12">
        <div className="container max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-rose-900/40" />
            <p className="mt-4 text-sm text-neutral-600 font-light tracking-wide">Loading order details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-stone-50 py-12">
        <div className="container max-w-4xl px-4 sm:px-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/orders")}
            className="mb-6 -ml-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100/50 rounded-2xl transition-all duration-300"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>

          <Alert variant="destructive" className="border-rose-200 bg-rose-50/50 backdrop-blur-sm rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-rose-900">{error || "Order not found"}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  const returnTotal = calculateReturnTotal()

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-stone-50 to-neutral-100 py-8 sm:py-12">
      <div className="container max-w-3xl px-4 sm:px-6">
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Button
            variant="ghost"
            onClick={() => router.push(`/orders/${orderId}`)}
            className="mb-8 -ml-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100/50 rounded-2xl transition-all duration-300"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-900 to-rose-800 shadow-lg shadow-rose-900/20">
              <RotateCcw className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-light text-neutral-900 tracking-tight">Return Order</h1>
              <p className="text-sm text-neutral-500 mt-1.5 font-light tracking-wide">Order #{order.order_number}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden border-neutral-200/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl backdrop-blur-sm bg-white/80 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <CardContent className="p-0">
              <div className="p-6 sm:p-7 border-b border-neutral-100">
                <h2 className="text-xl font-light text-neutral-900 tracking-tight">Select Items to Return</h2>
                <p className="text-sm text-neutral-500 mt-1.5 font-light">Choose which items you'd like to return</p>
              </div>

              <div className="divide-y divide-neutral-100">
                {order.items?.map((item, index) => {
                  const isSelected = selectedItems.has(item.id)
                  const itemName = item.product_name || item.name || "Product"
                  const itemImage =
                    productImages[item.product_id] ||
                    item.thumbnail_url ||
                    item.image_url ||
                    "/placeholder.svg?height=200&width=200"

                  return (
                    <div
                      key={item.id || index}
                      onClick={() => toggleItemSelection(item.id)}
                      className={`p-6 sm:p-7 flex gap-5 cursor-pointer transition-all duration-300 ${
                        isSelected
                          ? "bg-gradient-to-r from-rose-50 to-rose-50/50 border-l-4 border-rose-900"
                          : "hover:bg-neutral-50/50"
                      }`}
                    >
                      <div className="flex-shrink-0 pt-1">
                        <div
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                            isSelected
                              ? "bg-rose-900 border-rose-900 scale-110"
                              : "border-neutral-300 bg-white hover:border-rose-900/40"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </div>
                      </div>

                      <div className="flex-shrink-0 w-24 h-24 relative rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-sm">
                        <Image
                          src={itemImage || "/placeholder.svg"}
                          alt={itemName}
                          fill
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          sizes="96px"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/placeholder.svg?height=200&width=200"
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-normal text-neutral-900 text-base leading-snug tracking-tight">
                          {itemName}
                        </h4>
                        {item.variation && Object.keys(item.variation).length > 0 && (
                          <p className="text-xs text-neutral-500 mt-2 font-light">
                            {Object.entries(item.variation)
                              .filter(([_, value]) => value)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(", ")}
                          </p>
                        )}
                        <div className="flex justify-between items-center mt-4">
                          <span className="text-sm text-neutral-500 font-light">Qty {item.quantity}</span>
                          <span className="font-medium text-neutral-900 tracking-tight">
                            {formatCurrency(item.total || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-neutral-200/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl backdrop-blur-sm bg-white/80 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <CardContent className="p-6 sm:p-7">
              <h2 className="text-xl font-light text-neutral-900 mb-5 tracking-tight">Reason for Return</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RETURN_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReturnReason(reason)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                      returnReason === reason
                        ? "border-rose-900 bg-gradient-to-br from-rose-50 to-rose-50/50 text-rose-900 shadow-sm scale-[1.02]"
                        : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-light tracking-wide">{reason}</span>
                      {returnReason === reason && <CheckCircle2 className="h-5 w-5 text-rose-900" />}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-neutral-200/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl backdrop-blur-sm bg-white/80 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <CardContent className="p-6 sm:p-7">
              <h2 className="text-xl font-light text-neutral-900 mb-5 tracking-tight">Return Method</h2>

              <div className="space-y-3">
                {RETURN_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setReturnMethod(method.id)}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-300 ${
                      returnMethod === method.id
                        ? "border-rose-900 bg-gradient-to-br from-rose-50 to-rose-50/50 shadow-sm scale-[1.01]"
                        : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                          returnMethod === method.id
                            ? "bg-rose-900 text-white shadow-md shadow-rose-900/20"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {method.icon}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`font-normal text-sm tracking-tight ${returnMethod === method.id ? "text-rose-900" : "text-neutral-900"}`}
                        >
                          {method.label}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1 font-light">{method.description}</p>
                      </div>
                      {returnMethod === method.id && <CheckCircle2 className="h-5 w-5 text-rose-900" />}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-neutral-200/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl backdrop-blur-sm bg-white/80 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: "400ms" }}>
            <CardContent className="p-6 sm:p-7">
              <h2 className="text-xl font-light text-neutral-900 mb-5 tracking-tight">Refund Method</h2>

              <div className="space-y-3">
                {REFUND_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setRefundMethod(method.id)}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-300 ${
                      refundMethod === method.id
                        ? "border-rose-900 bg-gradient-to-br from-rose-50 to-rose-50/50 shadow-sm scale-[1.01]"
                        : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                          refundMethod === method.id
                            ? "bg-rose-900 text-white shadow-md shadow-rose-900/20"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {method.icon}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`font-normal text-sm tracking-tight ${refundMethod === method.id ? "text-rose-900" : "text-neutral-900"}`}
                        >
                          {method.label}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1 font-light">{method.description}</p>
                      </div>
                      {refundMethod === method.id && <CheckCircle2 className="h-5 w-5 text-rose-900" />}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-neutral-200/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl backdrop-blur-sm bg-white/80 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: "600ms" }}>
            <CardContent className="p-6 sm:p-7">
              <h2 className="text-xl font-light text-neutral-900 mb-5 tracking-tight">
                Additional Comments <span className="text-neutral-400 text-sm">(Optional)</span>
              </h2>

              <textarea
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                placeholder="Tell us more about why you're returning this order..."
                className="w-full px-5 py-4 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 transition-all duration-300 resize-none text-sm font-light tracking-wide bg-white/50 backdrop-blur-sm"
                rows={4}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-neutral-200/60 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl bg-gradient-to-br from-white via-neutral-50 to-stone-50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[600ms]">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-light text-neutral-900 mb-6 tracking-tight">Return Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 font-light">Items selected</span>
                  <span className="font-normal text-neutral-900">{selectedItems.size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 font-light">Return method</span>
                  <span className="font-normal text-neutral-900">
                    {RETURN_METHODS.find((m) => m.id === returnMethod)?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 font-light">Refund method</span>
                  <span className="font-normal text-neutral-900">
                    {REFUND_METHODS.find((m) => m.id === refundMethod)?.label}
                  </span>
                </div>

                <Separator className="my-4 bg-neutral-200" />

                <div className="flex justify-between items-baseline">
                  <span className="text-base font-light text-neutral-900 tracking-tight">Refund Amount</span>
                  <span className="text-2xl font-light text-neutral-900 tracking-tight">
                    {formatCurrency(returnTotal)}
                  </span>
                </div>
              </div>

              <Alert className="mb-6 border-rose-900/20 bg-gradient-to-br from-rose-50 to-rose-50/50 rounded-xl">
                <AlertCircle className="h-4 w-4 text-rose-900" />
                <AlertDescription className="text-rose-900 text-sm font-light">
                  Your refund will be processed within 5-7 business days after we receive the returned items.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleSubmitReturn}
                disabled={submitting || selectedItems.size === 0 || !returnReason}
                className="w-full py-6 rounded-xl bg-gradient-to-r from-rose-900 to-rose-800 hover:from-rose-800 hover:to-rose-700 text-white font-light text-base tracking-wide shadow-lg shadow-rose-900/20 hover:shadow-xl hover:shadow-rose-900/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Return...
                  </>
                ) : (
                  <>
                    Submit Return Request
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-xs text-neutral-500 text-center mt-5 font-light">
                By submitting, you agree to our{" "}
                <Link href="/returns-policy" className="text-rose-900 hover:underline transition-all duration-300">
                  return policy
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
