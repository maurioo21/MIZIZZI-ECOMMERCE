'use client'

/**
 * Force refresh categories on the frontend
 * This is called after admin updates a category to ensure fresh data is displayed
 */
export function forceRefreshCategories() {
  if (typeof window === 'undefined') return

  try {
    // Clear browser caches
    sessionStorage.removeItem('mizizzi_categories_cache')
    localStorage.removeItem('mizizzi_categories_cache')
    localStorage.removeItem('mizizzi_categories_cache_expiry')

    // Dispatch custom event that category components can listen to
    window.dispatchEvent(new CustomEvent('categories-updated'))

    console.log('[v0] Categories cache cleared and refresh event dispatched')
  } catch (error) {
    console.error('[v0] Error refreshing categories:', error)
  }
}

/**
 * Listen for category updates and refresh when detected
 */
export function onCategoriesUpdated(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = () => callback()
  window.addEventListener('categories-updated', handler)

  // Return cleanup function
  return () => window.removeEventListener('categories-updated', handler)
}
