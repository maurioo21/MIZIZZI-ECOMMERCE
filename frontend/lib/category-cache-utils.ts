'use client'

/**
 * Force refresh categories on the frontend with immediate page hard refresh
 * This is called after admin updates a category to ensure fresh data is displayed
 */
export function forceRefreshCategories() {
  if (typeof window === 'undefined') return

  try {
    // Clear all browser caches
    sessionStorage.removeItem('mizizzi_categories_cache')
    localStorage.removeItem('mizizzi_categories_cache')
    localStorage.removeItem('mizizzi_categories_cache_expiry')

    // Clear SWR cache by adding cache buster
    const cacheBuster = `_t=${Date.now()}`
    
    // Dispatch custom event that category components can listen to
    window.dispatchEvent(new CustomEvent('categories-updated', { detail: { cacheBuster } }))

    console.log('[v0] Categories cache cleared and refresh event dispatched')

    // Perform hard refresh with cache buster
    setTimeout(() => {
      const currentUrl = window.location.href
      const separator = currentUrl.includes('?') ? '&' : '?'
      const refreshUrl = `${currentUrl}${separator}_cache_bust=${Date.now()}`
      console.log('[v0] Performing hard refresh with cache buster...')
      window.location.href = refreshUrl
    }, 100)
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
