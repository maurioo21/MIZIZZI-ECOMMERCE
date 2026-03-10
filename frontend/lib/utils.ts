import { twMerge } from "tailwind-merge"
import clsx, { type ClassValue } from "clsx"

// lib/utils.ts
// This file was left out for brevity. Assume it is correct and does not need any modifications.
// Adding getAuthToken and getBaseUrl here.

/**
 * Retrieves the authentication token from local storage.
 * Checks for both admin_token and mizizzi_token.
 * @returns The authentication token string or null if not found.
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null
  // This logic should ideally be centralized in an auth service or lib/api.ts
  // For now, replicating the logic from lib/api.ts's internal getToken
  const adminToken = localStorage.getItem("admin_token")
  if (adminToken) return adminToken
  return localStorage.getItem("mizizzi_token")
}

/**
 * Retrieves the base URL for API requests from environment variables.
 * Provides a fallback to localhost in development.
 * @returns The base URL string.
 */
export const getBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || "https://mizizzi-ecommerce-1.onrender.com"
}

type LogLevel = "debug" | "info" | "warn" | "error" | "log"

interface LogEntry {
  level: LogLevel
  timestamp: string
  message: string
  context?: Record<string, unknown>
  durationMs?: number
}

class Logger {
  private minLevel: number
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    log: 2,
    warn: 3,
    error: 4,
  }

  constructor(defaultLevel: LogLevel = "info") {
    this.minLevel = this.levels[defaultLevel]
    if (process.env.NODE_ENV === "development") {
      this.minLevel = this.levels.debug // Log everything in development
    } else if (process.env.NODE_ENV === "production") {
      this.minLevel = this.levels.info // Only info, warn, error in production
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.minLevel
  }

  private formatMessage(message: string, context?: Record<string, unknown>): string {
    let formatted = `[${new Date().toISOString()}] ${message}`
    if (context) {
      try {
        const sanitizedContext = this.sanitizeContext(context)
        formatted += ` ${JSON.stringify(sanitizedContext)}`
      } catch (e) {
        formatted += ` [Context serialization error: ${(e as Error).message}]`
      }
    }
    return formatted
  }

  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    for (const key in context) {
      if (Object.prototype.hasOwnProperty.call(context, key)) {
        const value = context[key]
        // Basic sanitization for sensitive data
        if (typeof key === "string" && (key.includes("password") || key.includes("token") || key.includes("secret"))) {
          sanitized[key] = "[REDACTED]"
        } else if (typeof value === "string" && value.length > 200) {
          // Truncate long strings
          sanitized[key] = value.substring(0, 200) + "...[TRUNCATED]"
        } else if (typeof value === "object" && value !== null) {
          // Recursively sanitize nested objects, but prevent deep recursion
          sanitized[key] = JSON.parse(
            JSON.stringify(value, (k, v) => {
              if (typeof k === "string" && (k.includes("password") || k.includes("token") || k.includes("secret"))) {
                return "[REDACTED]"
              }
              if (typeof v === "string" && v.length > 200) {
                return v.substring(0, 200) + "...[TRUNCATED]"
              }
              return v
            }),
          )
        } else {
          sanitized[key] = value
        }
      }
    }
    return sanitized
  }

  private output(level: LogLevel, message: string, context?: Record<string, unknown>, durationMs?: number): void {
    if (!this.shouldLog(level)) {
      return
    }

    const formattedMessage = this.formatMessage(message, context)
    const logEntry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      context: context ? this.sanitizeContext(context) : undefined,
      durationMs,
    }

    // In a real application, you might send this to a remote logging service
    // console.log(JSON.stringify(logEntry));

    switch (level) {
      case "debug":
        console.debug(formattedMessage)
        break
      case "info":
      case "log":
        console.log(formattedMessage)
        break
      case "warn":
        console.warn(formattedMessage)
        break
      case "error":
        console.error(formattedMessage)
        break
    }
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.output("debug", message, context)
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.output("info", message, context)
  }

  public log(message: string, context?: Record<string, unknown>): void {
    this.output("log", message, context)
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.output("warn", message, context)
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.output("error", message, context)
  }

  public time<T>(name: string, fn: () => T): T {
    const start = performance.now()
    try {
      const result = fn()
      const end = performance.now()
      this.debug(`Function ${name} executed`, { durationMs: end - start })
      return result
    } catch (e) {
      const end = performance.now()
      this.error(`Function ${name} failed`, { error: (e as Error).message, durationMs: end - start })
      throw e
    }
  }

  public async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const end = performance.now()
      this.debug(`Async function ${name} executed`, { durationMs: end - start })
      return result
    } catch (e) {
      const end = performance.now()
      this.error(`Async function ${name} failed`, { error: (e as Error).message, durationMs: end - start })
      throw e
    }
  }
}

export const loggerInstance = new Logger((process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || "info")

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Price formatting utilities
export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "KSh 0"
  const numPrice = typeof price === "string" ? Number.parseFloat(price) : price
  if (isNaN(numPrice) || !isFinite(numPrice)) return "KSh 0"
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, numPrice))
}

export function formatCurrency(amount: number | string | null | undefined): string {
  return formatPrice(amount)
}

// Quantity formatting and validation utilities
export function sanitizeQuantity(quantity: any, maxLimit?: number): number {
  const defaultMaxLimit = maxLimit || 9999 // Increased from 999 to 9999
  if (quantity === null || quantity === undefined) return 1

  // Handle string quantities
  if (typeof quantity === "string") {
    // Check for scientific notation or extreme values
    if (quantity.includes("e+") || quantity.includes("E+")) {
      console.warn("Scientific notation detected in quantity, resetting to 1:", quantity)
      return 1
    }
    // Remove any non-numeric characters except decimal point
    const cleaned = quantity.replace(/[^\d.]/g, "")
    const parsed = Number.parseFloat(cleaned)
    if (isNaN(parsed) || !isFinite(parsed) || parsed > defaultMaxLimit) {
      console.warn("Invalid quantity detected, resetting to 1:", quantity)
      return 1
    }
    // Round to nearest integer and ensure it's positive
    const rounded = Math.round(Math.abs(parsed))
    return Math.max(1, Math.min(defaultMaxLimit, rounded))
  }

  // Handle numeric quantities
  if (typeof quantity === "number") {
    if (isNaN(quantity) || !isFinite(quantity) || quantity > defaultMaxLimit) {
      console.warn("Invalid numeric quantity detected, resetting to 1:", quantity)
      return 1
    }
    // Handle scientific notation or extreme values
    if (quantity > 999999 || quantity.toString().includes("e")) {
      console.warn("Extreme quantity value detected, resetting to 1:", quantity)
      return 1
    }
    // Round to nearest integer and ensure it's positive
    const rounded = Math.round(Math.abs(quantity))
    return Math.max(1, Math.min(defaultMaxLimit, rounded))
  }
  return 1
}

export function formatQuantity(quantity: any): string {
  const sanitized = sanitizeQuantity(quantity)
  return sanitized.toString()
}

export function isScientificNotation(value: any): boolean {
  if (typeof value === "number") {
    return value.toString().toLowerCase().includes("e")
  }
  if (typeof value === "string") {
    return value.toLowerCase().includes("e")
  }
  return false
}

export function fromScientificNotation(value: any): number {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Price validation and sanitization
export function sanitizePrice(price: any): number {
  if (price === null || price === undefined) return 0

  // Handle string prices
  if (typeof price === "string") {
    // Check for scientific notation or extreme values
    if (price.includes("e+") || price.includes("E+")) {
      console.warn("Scientific notation detected in price, resetting to 0:", price)
      return 0
    }
    // Remove currency symbols and non-numeric characters except decimal point
    const cleaned = price.replace(/[^\d.]/g, "")
    const parsed = Number.parseFloat(cleaned)
    if (isNaN(parsed) || !isFinite(parsed) || parsed > 10000000) {
      console.warn("Invalid price detected, resetting to 0:", price)
      return 0
    }
    return Math.max(0, Math.min(10000000, parsed))
  }

  // Handle numeric prices
  if (typeof price === "number") {
    if (isNaN(price) || !isFinite(price) || price > 10000000) {
      console.warn("Invalid numeric price detected, resetting to 0:", price)
      return 0
    }
    // Handle scientific notation or extreme values
    if (price > 999999999 || price.toString().includes("e")) {
      console.warn("Extreme price value detected, resetting to 0:", price)
      return 0
    }
    return Math.max(0, Math.min(10000000, price))
  }
  return 0
}

// Cart item sanitization
export function sanitizeCartItem(item: any): any {
  if (!item || typeof item !== "object") return null

  // Validate required fields
  if (!item.product_id || typeof item.product_id !== "number" || item.product_id <= 0) {
    console.warn("Invalid product_id in cart item:", item)
    return null
  }

  // Sanitize numeric fields
  const sanitizedItem = {
    ...item,
    id: item.id || Date.now(),
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity: sanitizeQuantity(item.quantity),
    price: sanitizePrice(item.price),
  }

  // Calculate total based on sanitized values
  sanitizedItem.total = sanitizedItem.price * sanitizedItem.quantity

  // Ensure product object exists and is valid
  if (!sanitizedItem.product || typeof sanitizedItem.product !== "object") {
    sanitizedItem.product = {
      id: sanitizedItem.product_id,
      name: `Product ${sanitizedItem.product_id}`,
      slug: `product-${sanitizedItem.product_id}`,
      thumbnail_url: "/placeholder.svg",
      image_urls: ["/placeholder.svg"],
      price: sanitizedItem.price,
      sale_price: null,
    }
  } else {
    // Sanitize product fields
    sanitizedItem.product = {
      ...sanitizedItem.product,
      id: sanitizedItem.product.id || sanitizedItem.product_id,
      name: sanitizedItem.product.name || `Product ${sanitizedItem.product_id}`,
      slug: sanitizedItem.product.slug || `product-${sanitizedItem.product_id}`,
      thumbnail_url: sanitizedItem.product.thumbnail_url || "/placeholder.svg",
      image_urls: sanitizedItem.product.image_urls || ["/placeholder.svg"],
      price: sanitizePrice(sanitizedItem.product.price || sanitizedItem.price),
      sale_price: sanitizedItem.product.sale_price ? sanitizePrice(sanitizedItem.product.sale_price) : null,
    }
  }
  return sanitizedItem
}

// Cart data sanitization
export function sanitizeCartData(cart: any): any {
  if (!cart || typeof cart !== "object") {
    return {
      id: 0,
      is_active: true,
      subtotal: 0,
      tax: 0,
      shipping: 0,
      discount: 0,
      total: 0,
      same_as_shipping: true,
      requires_shipping: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
  return {
    ...cart,
    id: cart.id || 0,
    subtotal: sanitizePrice(cart.subtotal),
    tax: sanitizePrice(cart.tax),
    shipping: sanitizePrice(cart.shipping),
    discount: sanitizePrice(cart.discount),
    total: sanitizePrice(cart.total),
    same_as_shipping: Boolean(cart.same_as_shipping),
    requires_shipping: Boolean(cart.requires_shipping),
  }
}

// Validation utilities
export function isValidPrice(price: any): boolean {
  const sanitized = sanitizePrice(price)
  return sanitized >= 0 && sanitized <= 999999999 && isFinite(sanitized)
}

export function isValidQuantity(quantity: any, maxLimit?: number): boolean {
  const defaultMaxLimit = maxLimit || 9999 // Increased from 999 to 9999
  const sanitized = sanitizeQuantity(quantity, defaultMaxLimit)
  return sanitized >= 1 && sanitized <= defaultMaxLimit && Number.isInteger(sanitized)
}

export function validateCartItem(item: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!item || typeof item !== "object") {
    errors.push("Invalid item format")
    return { isValid: false, errors }
  }
  if (!item.product_id || typeof item.product_id !== "number" || item.product_id <= 0) {
    errors.push("Invalid product ID")
  }
  if (!isValidQuantity(item.quantity)) {
    errors.push("Invalid quantity - must be between 1 and 9999") // Updated error message
  }
  if (!isValidPrice(item.price)) {
    errors.push("Invalid price - must be a valid positive number")
  }

  // Check for scientific notation in display values
  if (isScientificNotation(item.quantity)) {
    errors.push("Quantity contains invalid scientific notation")
  }
  if (isScientificNotation(item.price)) {
    errors.push("Price contains invalid scientific notation")
  }
  if (isScientificNotation(item.total)) {
    errors.push("Total contains invalid scientific notation")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Date formatting
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "Never"

  const d = new Date(date)

  // Check if date is valid
  if (isNaN(d.getTime())) return "Never"

  return d.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "Never"

  const d = new Date(date)

  // Check if date is valid
  if (isNaN(d.getTime())) return "Never"

  return d.toLocaleString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// String utilities
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Number utilities
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

// Array utilities
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}

export function groupBy<T, K extends keyof any>(array: T[], key: (item: T) => K): Record<K, T[]> {
  return array.reduce(
    (groups, item) => {
      const group = key(item)
      groups[group] = groups[group] || []
      groups[group].push(item)
      return groups
    },
    {} as Record<K, T[]>,
  )
}

// Local storage utilities
export function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error)
    return defaultValue
  }
}

export function setToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error)
  }
}

export function removeFromStorage(key: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error(`Error removing from localStorage key "${key}":`, error)
  }
}

// URL utilities
export function createSearchParams(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value))
    }
  })
  return searchParams.toString()
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Enhanced data corruption detection
export function detectDataCorruption(data: any): { isCorrupted: boolean; issues: string[] } {
  const issues: string[] = []
  if (!data || typeof data !== "object") {
    issues.push("Invalid data structure")
    return { isCorrupted: true, issues }
  }

  // Check for scientific notation in numeric fields
  const checkScientificNotation = (value: any, fieldName: string) => {
    if (typeof value === "number" && value.toString().toLowerCase().includes("e+")) {
      issues.push(`${fieldName} contains scientific notation: ${value}`)
    }
    if (typeof value === "string" && (value.toLowerCase().includes("e+") || value.toLowerCase().includes("e-"))) {
      issues.push(`${fieldName} string contains scientific notation: ${value}`)
    }
  }

  // Check for NaN or Infinity values
  const checkInvalidNumbers = (value: any, fieldName: string) => {
    if (typeof value === "number" && (isNaN(value) || !isFinite(value))) {
      issues.push(`${fieldName} contains invalid number: ${value}`)
    }
  }

  // Check for extremely large or small values that might cause issues - more conservative
  const checkValueRanges = (value: any, fieldName: string, min: number, max: number) => {
    if (typeof value === "number" && (value < min || value > max)) {
      issues.push(`${fieldName} is out of valid range (${min}-${max}): ${value}`)
    }
  }

  // Validate cart item structure
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        issues.push(`Item ${index} is not a valid object`)
        return
      }
      // Check required fields
      if (!item.product_id || typeof item.product_id !== "number") {
        issues.push(`Item ${index} has invalid product_id: ${item.product_id}`)
      }

      // Check numeric fields for corruption
      checkScientificNotation(item.quantity, `Item ${index} quantity`)
      checkScientificNotation(item.price, `Item ${index} price`)
      checkScientificNotation(item.total, `Item ${index} total`)
      checkInvalidNumbers(item.quantity, `Item ${index} quantity`)
      checkInvalidNumbers(item.price, `Item ${index} price`)
      checkInvalidNumbers(item.total, `Item ${index} total`)

      // More conservative range checks
      checkValueRanges(item.quantity, `Item ${index} quantity`, 1, 10000) // 10k instead of 999
      checkValueRanges(item.price, `Item ${index} price`, 0, 100000000) // 100M instead of 999M
      checkValueRanges(item.total, `Item ${index} total`, 0, 1000000000) // 1B instead of 999M

      // Check for data consistency
      if (item.price && item.quantity && item.total) {
        const expectedTotal = item.price * item.quantity
        const totalDifference = Math.abs(item.total - expectedTotal)
        if (totalDifference > 0.01) {
          issues.push(`Item ${index} total (${item.total}) doesn't match price × quantity (${expectedTotal})`)
        }
      }
    })
  }

  return { isCorrupted: issues.length > 0, issues }
}

// Enhanced cart item sanitization with corruption recovery
export function sanitizeCartItemEnhanced(item: any): any {
  if (!item || typeof item !== "object") return null

  try {
    // First, detect and log any corruption
    const corruption = detectDataCorruption([item])
    if (corruption.isCorrupted) {
      console.warn("Detected corruption in cart item, attempting recovery:", corruption.issues)
    }

    // Validate and sanitize product_id
    let productId = item.product_id
    if (typeof productId === "string") {
      productId = Number.parseInt(productId, 10)
    }
    if (!productId || typeof productId !== "number" || productId <= 0 || !isFinite(productId)) {
      console.error("Cannot recover item with invalid product_id:", item)
      return null
    }

    // Sanitize quantity with enhanced recovery
    let quantity = item.quantity
    if (typeof quantity === "string") {
      // Remove any non-numeric characters except decimal point
      quantity = quantity.replace(/[^\d.]/g, "")
      quantity = Number.parseFloat(quantity)
    }
    if (typeof quantity !== "number" || isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
      console.warn("Invalid quantity detected, defaulting to 1:", item.quantity)
      quantity = 1
    }
    // Handle scientific notation
    if (quantity.toString().toLowerCase().includes("e")) {
      quantity = Math.round(quantity)
    }
    quantity = Math.max(1, Math.min(999, Math.round(Math.abs(quantity))))

    // Sanitize price with enhanced recovery - CRITICAL FIX
    let price = item.price
    if (typeof price === "string") {
      // Remove currency symbols and non-numeric characters except decimal point
      price = price.replace(/[^\d.]/g, "")
      price = Number.parseFloat(price)
    }
    if (typeof price !== "number" || isNaN(price) || !isFinite(price) || price < 0) {
      console.warn("Invalid price detected:", item.price)
      // Try to get price from product data if available
      if (item.product && typeof item.product.price === "number" && item.product.price > 0) {
        price = item.product.sale_price || item.product.price
        console.log("Using product price as fallback:", price)
      } else {
        console.warn("No valid product price available, setting to 0")
        price = 0
      }
    }
    // Handle scientific notation
    if (price.toString().toLowerCase().includes("e")) {
      price = Math.abs(price)
    }
    price = Math.max(0, Math.min(999999999, price))

    // Calculate total with proper rounding
    const total = Math.round(price * quantity * 100) / 100

    // Sanitize product object
    let product = item.product
    if (!product || typeof product !== "object") {
      product = {
        id: productId,
        name: `Product ${productId}`,
        slug: `product-${productId}`,
        thumbnail_url: "/placeholder.svg",
        image_urls: ["/placeholder.svg"],
        price: price,
        sale_price: null,
      }
    } else {
      product = {
        ...product,
        id: product.id || productId,
        name: product.name || `Product ${productId}`,
        slug: product.slug || `product-${productId}`,
        thumbnail_url: product.thumbnail_url || "/placeholder.svg",
        image_urls: product.image_urls || ["/placeholder.svg"],
        price: sanitizePrice(product.price || price),
        sale_price: product.sale_price ? sanitizePrice(product.sale_price) : null,
      }
    }

    const sanitizedItem = {
      id: item.id || Date.now(),
      product_id: productId,
      variant_id: item.variant_id || null,
      quantity: quantity,
      price: price,
      total: total,
      product: product,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at || new Date().toISOString(),
    }

    // Final validation
    const finalValidation = validateCartItem(sanitizedItem)
    if (!finalValidation.isValid) {
      console.error("Failed to sanitize cart item:", finalValidation.errors)
      return null
    }

    return sanitizedItem
  } catch (error) {
    console.error("Error during enhanced cart item sanitization:", error)
    return null
  }
}

// Enhanced error message formatting
export function formatUserFriendlyError(error: any): { title: string; description: string; action?: string } {
  if (!error) {
    return {
      title: "Unknown Error",
      description: "An unexpected error occurred. Please try again.",
      action: "Refresh the page and try again",
    }
  }

  // Handle validation errors
  if (error.code) {
    switch (error.code) {
      case "out_of_stock":
        return {
          title: "Item Out of Stock",
          description: error.message || "This item is currently out of stock.",
          action: "Remove the item or check back later",
        }
      case "insufficient_stock":
        return {
          title: "Limited Stock Available",
          description: error.message || `Only ${error.available_stock || 0} items available.`,
          action: `Update quantity to ${error.available_stock || 0} or remove the item`,
        }
      case "invalid_quantity":
        return {
          title: "Invalid Quantity",
          description: "Please enter a valid quantity between 1 and 999.",
          action: "Update the quantity to a valid number",
        }
      case "product_not_found":
        return {
          title: "Product Not Found",
          description: "This product is no longer available.",
          action: "Remove the item from your cart",
        }
      case "network_error":
        return {
          title: "Connection Issue",
          description: "Unable to connect to our servers. Your changes have been saved locally.",
          action: "Check your internet connection and try again",
        }
      case "auth_required":
        return {
          title: "Sign In Required",
          description: "Please sign in to continue with your purchase.",
          action: "Sign in to your account",
        }
      case "validation_error":
        return {
          title: "Validation Error",
          description: error.message || "There was an issue validating your request.",
          action: "Please check your input and try again",
        }
      case "cart_corruption":
        return {
          title: "Cart Data Issue",
          description: "We detected an issue with your cart data and have fixed it automatically.",
          action: "Your cart has been updated. Please review your items.",
        }
      default:
        return {
          title: "Error",
          description: error.message || "An error occurred while processing your request.",
          action: "Please try again or contact support if the issue persists",
        }
    }
  }

  // Handle HTTP errors
  if (error.response?.status) {
    switch (error.response.status) {
      case 400:
        return {
          title: "Invalid Request",
          description: "The request was invalid. Please check your input.",
          action: "Verify your information and try again",
        }
      case 401:
        return {
          title: "Authentication Required",
          description: "Please sign in to continue.",
          action: "Sign in to your account",
        }
      case 403:
        return {
          title: "Access Denied",
          description: "You don't have permission to perform this action.",
          action: "Contact support if you believe this is an error",
        }
      case 404:
        return {
          title: "Not Found",
          description: "The requested item could not be found.",
          action: "Check if the item still exists or try refreshing",
        }
      case 429:
        return {
          title: "Too Many Requests",
          description: "You're making requests too quickly. Please slow down.",
          action: "Wait a moment before trying again",
        }
      case 500:
        return {
          title: "Server Error",
          description: "Our servers are experiencing issues. Please try again later.",
          action: "Try again in a few minutes or contact support",
        }
      default:
        return {
          title: "Connection Error",
          description: `Server responded with error ${error.response.status}.`,
          action: "Please try again or contact support",
        }
    }
  }

  // Handle network errors
  if (error.name === "NetworkError" || error.message?.includes("network")) {
    return {
      title: "Network Error",
      description: "Unable to connect to our servers. Please check your internet connection.",
      action: "Check your connection and try again",
    }
  }

  // Handle timeout errors
  if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
    return {
      title: "Request Timeout",
      description: "The request took too long to complete.",
      action: "Please try again with a stable internet connection",
    }
  }

  // Default error handling
  return {
    title: "Unexpected Error",
    description: error.message || "An unexpected error occurred.",
    action: "Please try again or contact support if the issue persists",
  }
}

// Performance monitoring utilities
export function createPerformanceMonitor() {
  const metrics = new Map<string, number[]>()

  return {
    startTimer: (operation: string) => {
      const startTime = performance.now()
      return {
        end: () => {
          const duration = performance.now() - startTime
          if (!metrics.has(operation)) {
            metrics.set(operation, [])
          }
          metrics.get(operation)!.push(duration)

          // Log slow operations
          if (duration > 1000) {
            console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`)
          }
          return duration
        },
      }
    },
    getMetrics: () => {
      const summary = new Map<string, { avg: number; min: number; max: number; count: number }>()
      metrics.forEach((times, operation) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        const min = Math.min(...times)
        const max = Math.max(...times)
        summary.set(operation, { avg, min, max, count: times.length })
      })
      return summary
    },
    reset: () => {
      metrics.clear()
    },
  }
}

// Cart migration utilities
export function prepareCartForMigration(guestCartItems: any[]): any[] {
  return guestCartItems
    .map((item) => sanitizeCartItemEnhanced(item))
    .filter(Boolean)
    .map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      price: item.price,
      // Add migration metadata
      migrated_from_guest: true,
      migration_timestamp: new Date().toISOString(),
    }))
}

export function validateMigrationData(items: any[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!Array.isArray(items)) {
    errors.push("Migration data must be an array")
    return { isValid: false, errors }
  }
  items.forEach((item, index) => {
    if (!item.product_id || typeof item.product_id !== "number") {
      errors.push(`Item ${index}: Invalid product_id`)
    }
    if (!item.quantity || typeof item.quantity !== "number" || item.quantity <= 0) {
      errors.push(`Item ${index}: Invalid quantity`)
    }
    if (typeof item.price !== "number" || item.price < 0) {
      errors.push(`Item ${index}: Invalid price`)
    }
  })
  return { isValid: errors.length === 0, errors }
}

// Generate a URL-friendly slug from a string
export function generateSlug(text: string): string {
  if (!text || typeof text !== "string") {
    return ""
  }

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w-]+/g, "") // Remove all non-word characters
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, "") // Trim - from end of text
}

/**
 * Generate a SKU (Stock Keeping Unit) from a product ID and name
 * Backend-preferred format: PROD-{YYYYMMDD}-{PADDED_ID}
 * Example: PROD-20260310-00079
 * 
 * This is a frontend utility for reference. The backend is responsible for 
 * generating the actual SKU during product creation/update.
 * @param productId - The product ID
 * @param productName - The product name (optional, for reference)
 * @returns Generated SKU string
 */
export function generateSKU(productId: number | string, productName?: string): string {
  const id = String(productId).padStart(5, "0")
  const date = new Date()
  const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
  return `PROD-${timestamp}-${id}`
}

// Convert hex color to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

// Make color safe for animation by ensuring it's a simple RGB value
export function safeColorForAnimation(color: string): string {
  // If it's already a simple rgb/rgba/hex color, return it
  if (
    /^(rgb\s*$$\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$$|rgba\s*$$\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*$$|#[0-9a-f]{3,8})$/i.test(
      color,
    )
  ) {
    return color
  }

  // If it's a complex value with background properties, extract just the color
  const colorMatch = color.match(/(rgb$$[^)]+$$|rgba$$[^)]+$$|#[0-9a-f]{3,8})/i)
  if (colorMatch) {
    return colorMatch[0]
  }

  // For Tailwind class names or other values, return a safe default
  if (color.includes("gray")) return "rgb(156, 163, 175)" // gray-400
  if (color.includes("red")) return "rgb(239, 68, 68)" // red-500
  if (color.includes("blue")) return "rgb(59, 130, 246)" // blue-500
  if (color.includes("green")) return "rgb(34, 197, 94)" // green-500

  // Default fallback
  return "rgb(156, 163, 175)" // gray-400
}
