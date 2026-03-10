import { cache } from "react";
import { API_BASE_URL } from "../config";

// ISR configuration for optimal performance
// 30-second revalidation window ensures instant updates when admin changes carousel
const ISR_REVALIDATE_TIME = 30;
const ISR_TAGS = {
  carousel: ["carousel-items"],
  premium: ["premium-experiences"],
  contact: ["contact-cta"],
  features: ["feature-cards"],
  showcase: ["product-showcase"]
};

// Helper to normalize image URLs - prioritizes Cloudinary URLs for fast CDN delivery
function normalizeImageUrl(url: string | undefined | null): string {
  if (!url || url === "null" || url === "undefined" || url.trim() === "") {
    return "";
  }
  
  // If it's already a Cloudinary URL (has https and domain), return as-is (highest priority)
  if (url.includes("res.cloudinary.com")) {
    return url;
  }
  
  // If it's already an http/https URL (other than Cloudinary), return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // If it's a data URL, return as-is
  if (url.startsWith("data:")) {
    return url;
  }
  
  // If it's a relative path starting with /, construct full backend URL
  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }
  
  // Fallback - return as-is
  return url;
}

export interface CarouselItem {
  image: string;
  title: string;
  description: string;
  buttonText: string;
  href: string;
  badge?: string;
  discount?: string;
}

export interface PremiumExperience {
  id: number;
  title: string;
  metric: string;
  description: string;
  icon_name: string;
  image: string;
  gradient: string;
  features: string[];
  is_active: boolean;
}

export interface ContactCTASlide {
  id: number;
  subtitle: string;
  image: string;
  gradient: string;
  accent_color: string;
}

export interface FeatureCard {
  id?: number;
  icon: string;
  title: string;
  description: string;
  href: string;
  iconBg: string;
  iconColor: string;
  hoverBg: string;
  badge?: string;
  count?: number;
}

// Default feature cards for instant display
const DEFAULT_FEATURE_CARDS: FeatureCard[] = [
  {
    icon: "Zap",
    title: "FLASH SALES",
    description: "Limited Time Offers",
    href: "/flash-sales",
    iconBg: "bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100",
    iconColor: "text-amber-600",
    hoverBg: "hover:bg-amber-50/80",
    badge: "HOT",
  },
  {
    icon: "Crown",
    title: "LUXURY DEALS",
    description: "Premium Collections",
    href: "/luxury",
    iconBg: "bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100",
    iconColor: "text-violet-600",
    hoverBg: "hover:bg-violet-50/80",
    badge: "VIP",
  },
  {
    icon: "Heart",
    title: "WISHLIST",
    description: "Save Your Favorites",
    href: "/wishlist",
    iconBg: "bg-gradient-to-br from-rose-100 via-pink-50 to-red-100",
    iconColor: "text-rose-600",
    hoverBg: "hover:bg-rose-50/80",
  },
  {
    icon: "Package",
    title: "ORDERS",
    description: "Track Your Purchases",
    href: "/orders",
    iconBg: "bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100",
    iconColor: "text-sky-600",
    hoverBg: "hover:bg-sky-50/80",
  },
  {
    icon: "HeadphonesIcon",
    title: "SUPPORT",
    description: "24/7 Assistance",
    href: "/help",
    iconBg: "bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100",
    iconColor: "text-emerald-600",
    hoverBg: "hover:bg-emerald-50/80",
  },
  {
    icon: "Search",
    title: "PRODUCTS",
    description: "Browse All Items",
    href: "/products",
    iconBg: "bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100",
    iconColor: "text-slate-600",
    hoverBg: "hover:bg-slate-50/80",
  },
];

// Default premium experiences for instant display
const DEFAULT_PREMIUM_EXPERIENCES: PremiumExperience[] = [
  {
    id: 1,
    title: "PREMIUM MEMBERSHIP",
    metric: "98.7%",
    description: "Satisfaction",
    icon_name: "Crown",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23F59E0B' width='400' height='300'/%3E%3Ccircle cx='200' cy='150' r='80' fill='%23FCD34D'/%3E%3C/svg%3E",
    gradient: "from-amber-500 to-orange-600",
    features: ["Priority support", "Exclusive deals", "Free shipping", "Early access"],
    is_active: true,
  },
];

// Default contact CTA slides for instant display
const DEFAULT_CONTACT_SLIDES: ContactCTASlide[] = [
  {
    id: 1,
    subtitle: "Best Deals Await!",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'%3E%3Crect fill='%238B1538' width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' font-size='32' fill='white' text-anchor='middle' dominant-baseline='middle'%3EExclusive Offers%3C/text%3E%3C/svg%3E",
    gradient: "from-cherry-600 to-cherry-800",
    accent_color: "text-yellow-300",
  },
];

// Default carousel items - shows fallback banner when API has no items
const DEFAULT_CAROUSEL_ITEMS: CarouselItem[] = [
  {
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 600'%3E%3Crect fill='%238B1538' width='1200' height='600'/%3E%3Ctext x='50%25' y='50%25' font-size='48' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle'%3EWelcome to Mizizzi Store%3C/text%3E%3C/svg%3E",
    title: "Welcome to Mizizzi Store",
    description: "Discover premium products and exclusive deals",
    buttonText: "Shop Now",
    href: "/products",
    badge: "WELCOME"
  }
];

// Server-side fetcher for carousel items with ISR support
// Uses /items endpoint that returns carousel banners for homepage
export const getCarouselItems = cache(async (): Promise<CarouselItem[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/carousel/items?position=homepage`, {
      next: { 
        revalidate: ISR_REVALIDATE_TIME,
        tags: ISR_TAGS.carousel
      },
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });

    if (!response.ok) {
      return DEFAULT_CAROUSEL_ITEMS;
    }

    const data = await response.json();

    if (data.success && data.items && data.items.length > 0) {
      return data.items.map((item: any) => ({
        image: normalizeImageUrl(item.image_url),
        title: item.title,
        description: item.description,
        buttonText: item.button_text || "Shop Now",
        href: item.link_url || "/products",
        badge: item.badge_text,
        discount: item.discount,
      }));
    }

    return DEFAULT_CAROUSEL_ITEMS;
  } catch (error) {
    return DEFAULT_CAROUSEL_ITEMS;
  }
});

// Server-side fetcher for premium experience with ISR
export const getPremiumExperiences = cache(async (): Promise<PremiumExperience[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/panels/items?panel_type=premium_experience&position=right`, {
      next: { 
        revalidate: ISR_REVALIDATE_TIME,
        tags: ISR_TAGS.premium
      },
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return DEFAULT_PREMIUM_EXPERIENCES;

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      return data.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        metric: item.metric,
        description: item.description,
        icon_name: item.icon_name,
        image: item.image_url,
        gradient: item.gradient,
        features: item.features,
        is_active: item.is_active,
      }));
    }

    return DEFAULT_PREMIUM_EXPERIENCES;
  } catch (error) {
    return DEFAULT_PREMIUM_EXPERIENCES;
  }
});

// Server-side fetcher for contact CTA slides with ISR
export const getContactCTASlides = cache(async (): Promise<ContactCTASlide[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contact-cta/slides`, {
      next: { 
        revalidate: ISR_REVALIDATE_TIME,
        tags: ISR_TAGS.contact
      },
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return DEFAULT_CONTACT_SLIDES;

    const data = await response.json();

    if (data.slides && data.slides.length > 0) {
      return data.slides;
    }

    return DEFAULT_CONTACT_SLIDES;
  } catch (error) {
    return DEFAULT_CONTACT_SLIDES;
  }
});

// Server-side fetcher for feature cards with ISR
export const getFeatureCards = cache(async (): Promise<FeatureCard[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/feature-cards`, {
      next: { 
        revalidate: ISR_REVALIDATE_TIME,
        tags: ISR_TAGS.features
      },
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return DEFAULT_FEATURE_CARDS;

    const data = await response.json();

    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }

    return DEFAULT_FEATURE_CARDS;
  } catch (error) {
    return DEFAULT_FEATURE_CARDS;
  }
});

export interface ProductShowcaseCategory {
  id: number;
  title: string;
  metric: string;
  description: string;
  icon_name: string;
  image: string;
  gradient: string;
  features: string[];
  is_active: boolean;
}

const DEFAULT_PRODUCT_SHOWCASE: ProductShowcaseCategory[] = [
  {
    id: 1,
    title: "NEW ARRIVALS",
    metric: "50+",
    description: "Premium quality products",
    icon_name: "Gem",
    image: "/new-arrivals-fashion.png",
    gradient: "from-rose-500 to-pink-600",
    features: ["Latest Trends", "Premium Quality", "Exclusive Designs", "Limited Edition"],
    is_active: true,
  },
  {
    id: 2,
    title: "BEST SELLERS",
    metric: "98.7%",
    description: "Customer satisfaction rate",
    icon_name: "Award",
    image: "/best-seller-products.jpg",
    gradient: "from-amber-500 to-orange-600",
    features: ["Top Rated", "Most Popular", "Customer Favorites", "Priority Support"],
    is_active: true,
  },
];

export const getProductShowcase = cache(async (): Promise<ProductShowcaseCategory[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/panels/items?panel_type=product_showcase&position=left`, {
      next: { 
        revalidate: ISR_REVALIDATE_TIME,
        tags: ISR_TAGS.showcase
      },
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return DEFAULT_PRODUCT_SHOWCASE;

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      return data.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        metric: item.metric,
        description: item.description,
        icon_name: item.icon_name,
        image: item.image_url,
        gradient: item.gradient,
        features: item.features,
        is_active: item.is_active,
      }));
    }

    return DEFAULT_PRODUCT_SHOWCASE;
  } catch (error) {
    return DEFAULT_PRODUCT_SHOWCASE;
  }
});

// Combined fetcher for all carousel data
// Note: NOT wrapped in cache() to avoid exceeding 2MB Next.js cache limit
// Individual fetchers handle their own caching via next.revalidate
export const getCarouselData = async () => {
  const [carouselItems, premiumExperiences, contactCTASlides, featureCards, productShowcase] = await Promise.all([
    getCarouselItems(),
    getPremiumExperiences(),
    getContactCTASlides(),
    getFeatureCards(),
    getProductShowcase(),
  ]);

  return {
    carouselItems,
    premiumExperiences,
    contactCTASlides,
    featureCards,
    productShowcase,
  };
};
