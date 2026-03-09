"""
Cache Groups Configuration
Defines all cache groups and their Redis key patterns for the Mizizzi ecommerce platform.
"""

from typing import Dict, List
from enum import Enum


class CacheGroupType(str, Enum):
    """Enumeration of cache group types"""
    CRITICAL = "critical"
    DEFERRED = "deferred"
    HOMEPAGE = "homepage"
    ALL = "all"


class CachePattern:
    """Represents a single cache pattern"""
    def __init__(self, key: str, name: str, description: str, group: str):
        self.key = key
        self.name = name
        self.description = description
        self.group = group

    def to_dict(self):
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "group": self.group
        }


# Define all cache patterns for the application
CACHE_PATTERNS = {
    # Critical caches - affect homepage appearance
    "mizizzi:carousel:*": CachePattern(
        "mizizzi:carousel:*",
        "Carousel Cache",
        "Homepage carousel items and images",
        CacheGroupType.CRITICAL.value
    ),
    "mizizzi:categories:*": CachePattern(
        "mizizzi:categories:*",
        "Categories Cache",
        "Shop categories hierarchy and metadata",
        CacheGroupType.CRITICAL.value
    ),
    "mizizzi:feature_cards:*": CachePattern(
        "mizizzi:feature_cards:*",
        "Feature Cards Cache",
        "Feature cards displayed on homepage",
        CacheGroupType.CRITICAL.value
    ),
    "mizizzi:topbar:*": CachePattern(
        "mizizzi:topbar:*",
        "Top Bar Cache",
        "Top bar messaging and announcements",
        CacheGroupType.CRITICAL.value
    ),
    # Deferred caches - less frequently accessed
    "mizizzi:flash_sale:*": CachePattern(
        "mizizzi:flash_sale:*",
        "Flash Sale Cache",
        "Flash sale products and timing",
        CacheGroupType.DEFERRED.value
    ),
    "mizizzi:premium_experiences:*": CachePattern(
        "mizizzi:premium_experiences:*",
        "Premium Experiences Cache",
        "Premium/luxury product collections",
        CacheGroupType.DEFERRED.value
    ),
    "mizizzi:product_showcase:*": CachePattern(
        "mizizzi:product_showcase:*",
        "Product Showcase Cache",
        "Featured product showcase sections",
        CacheGroupType.DEFERRED.value
    ),
    "mizizzi:brands:*": CachePattern(
        "mizizzi:brands:*",
        "Brands Cache",
        "Brand information and listings",
        CacheGroupType.DEFERRED.value
    ),
    # Homepage section caches
    "mizizzi:homepage:*": CachePattern(
        "mizizzi:homepage:*",
        "Homepage Cache",
        "Complete homepage aggregate cache",
        CacheGroupType.HOMEPAGE.value
    ),
    "mizizzi:contact_cta:*": CachePattern(
        "mizizzi:contact_cta:*",
        "Contact CTA Cache",
        "Contact call-to-action sections",
        CacheGroupType.HOMEPAGE.value
    ),
    "mizizzi:footer:*": CachePattern(
        "mizizzi:footer:*",
        "Footer Cache",
        "Footer content and links",
        CacheGroupType.HOMEPAGE.value
    ),
    "mizizzi:side_panels:*": CachePattern(
        "mizizzi:side_panels:*",
        "Side Panel Cache",
        "Side panel content and navigation",
        CacheGroupType.HOMEPAGE.value
    ),
    "mizizzi:theme:*": CachePattern(
        "mizizzi:theme:*",
        "Theme Cache",
        "Theme settings and customization",
        CacheGroupType.HOMEPAGE.value
    ),
    "mizizzi:inventory:*": CachePattern(
        "mizizzi:inventory:*",
        "Inventory Cache",
        "Product stock and inventory data",
        CacheGroupType.HOMEPAGE.value
    ),
    "mizizzi:products:*": CachePattern(
        "mizizzi:products:*",
        "Products Cache",
        "Product data and listings",
        CacheGroupType.HOMEPAGE.value
    ),
    "mizizzi:cloudinary:*": CachePattern(
        "mizizzi:cloudinary:*",
        "Cloudinary Images Cache",
        "Cloudinary image URLs and metadata cache",
        CacheGroupType.CRITICAL.value
    ),
}

# Define cache groups with their associated patterns
CACHE_GROUPS: Dict[str, Dict] = {
    CacheGroupType.CRITICAL.value: {
        "name": "Critical Caches",
        "description": "Critical caches affecting homepage appearance",
        "patterns": [
            "mizizzi:carousel:*",
            "mizizzi:categories:*",
            "mizizzi:feature_cards:*",
            "mizizzi:topbar:*",
            "mizizzi:cloudinary:*",
        ]
    },
    CacheGroupType.DEFERRED.value: {
        "name": "Deferred Caches",
        "description": "Deferred caches for content that updates less frequently",
        "patterns": [
            "mizizzi:flash_sale:*",
            "mizizzi:premium_experiences:*",
            "mizizzi:product_showcase:*",
            "mizizzi:brands:*",
        ]
    },
    CacheGroupType.HOMEPAGE.value: {
        "name": "Homepage Section Caches",
        "description": "Homepage section caches and global content",
        "patterns": [
            "mizizzi:homepage:*",
            "mizizzi:contact_cta:*",
            "mizizzi:footer:*",
            "mizizzi:side_panels:*",
            "mizizzi:theme:*",
            "mizizzi:inventory:*",
            "mizizzi:products:*",
        ]
    },
}

# Whitelist of allowed patterns for pattern-based invalidation
ALLOWED_PATTERNS = set(CACHE_PATTERNS.keys())

# Rate limiting configuration
RATE_LIMIT_CONFIG = {
    "enabled": True,
    "max_requests": 10,  # Max requests per admin user
    "window_seconds": 60,  # Time window in seconds
}

# Invalidation timeout configuration
INVALIDATION_TIMEOUT = 30  # seconds

# Redis SCAN configuration
REDIS_SCAN_CONFIG = {
    "batch_size": 100,  # Keys to scan per iteration
    "cursor": 0,  # Initial cursor
}


def get_cache_group_patterns(group_type: str) -> List[str]:
    """Get all patterns for a cache group"""
    if group_type == CacheGroupType.ALL.value:
        # Return all patterns
        return list(ALLOWED_PATTERNS)
    
    group = CACHE_GROUPS.get(group_type)
    if not group:
        raise ValueError(f"Unknown cache group: {group_type}")
    
    return group["patterns"]


def validate_pattern(pattern: str) -> bool:
    """Check if a pattern is whitelisted"""
    return pattern in ALLOWED_PATTERNS


def get_all_patterns() -> List[str]:
    """Get all cache patterns"""
    return list(ALLOWED_PATTERNS)


def get_cache_group_info(group_type: str) -> Dict:
    """Get information about a cache group"""
    if group_type == CacheGroupType.ALL.value:
        return {
            "name": "All Caches",
            "description": "All caches (use with caution)",
            "patterns": list(ALLOWED_PATTERNS),
        }
    
    group = CACHE_GROUPS.get(group_type)
    if not group:
        raise ValueError(f"Unknown cache group: {group_type}")
    
    return group
