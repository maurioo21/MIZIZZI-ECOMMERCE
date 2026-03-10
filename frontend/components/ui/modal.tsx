"use client"

import type React from "react"
import { useEffect } from "react"
import { X } from "lucide-react"
import { createPortal } from "react-dom"

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  closeOnEscape?: boolean
  closeOnClickOutside?: boolean
  className?: string
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnEscape = true,
  closeOnClickOutside = true,
  className = "",
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape && open) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener("keydown", handleEscape)
      // Only prevent scroll on non-touch devices to preserve native mobile pull-to-refresh
      const isTouchDevice = () => {
        return (
          typeof window !== "undefined" &&
          (navigator.maxTouchPoints > 0 ||
            (navigator as any).msMaxTouchPoints > 0 ||
            (matchMedia && matchMedia("(pointer:coarse)").matches))
        )
      }
      
      if (!isTouchDevice()) {
        document.body.style.overflow = "hidden"
      }
      
      return () => {
        document.removeEventListener("keydown", handleEscape)
        document.body.style.overflow = "unset"
      }
    }
  }, [open, closeOnEscape, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
        onClick={() => closeOnClickOutside && onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className={`relative mx-4 w-full ${sizeClasses[size]} rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300 ease-in-out ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex-shrink-0 border-b border-gray-100 px-6 py-5 sm:px-8 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id="modal-title"
                    className="text-xl sm:text-2xl font-bold text-gray-900 truncate"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id="modal-description"
                    className="mt-1 text-sm text-gray-600 line-clamp-2"
                  >
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="mt-1 flex-shrink-0 inline-flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 sm:px-8 sm:py-5 bg-gray-50/50 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function ModalHeader({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`space-y-1 ${className}`}>{children}</div>
}

export function ModalTitle({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h2>
  )
}

export function ModalDescription({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={`text-sm text-gray-600 ${className}`}>
      {children}
    </p>
  )
}

export function ModalBody({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`space-y-4 ${className}`}>{children}</div>
}

export function ModalFooter({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`flex gap-3 ${className}`}>{children}</div>
}
