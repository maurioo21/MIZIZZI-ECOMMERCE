export interface CarouselBanner {
  id: number
  name: string
  position: string
  image_url: string
  image_public_id?: string  // Cloudinary public_id for efficient image management
  title: string
  description?: string
  badge_text?: string
  discount?: string
  button_text: string
  link_url?: string
  is_active: boolean
  sort_order: number
  start_date?: string
  end_date?: string
  priority?: number
  views?: number
  clicks?: number
  created_at: string
  updated_at: string
}

export interface CarouselPosition {
  value: string
  label: string
}

export const CAROUSEL_POSITIONS: CarouselPosition[] = [
  { value: "homepage", label: "Homepage" },
  { value: "category_page", label: "Category Pages" },
  { value: "flash_sales", label: "Flash Sales" },
  { value: "luxury_deals", label: "Luxury Deals" },
]
