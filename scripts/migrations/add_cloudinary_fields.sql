-- SQL Migration: Add Cloudinary Support to Carousel and Category Models
-- Date: 2026-03-10
-- Purpose: Add image_public_id fields to store Cloudinary public IDs for efficient image management
-- This enables direct Cloudinary CDN URL usage and proper image deletion

-- ============================================================================
-- 1. CAROUSEL_BANNERS TABLE - Add Cloudinary public_id support
-- ============================================================================

-- Add image_public_id column to carousel_banners table if it doesn't exist
ALTER TABLE carousel_banners 
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255) NULL DEFAULT NULL;

-- Create index on image_public_id for faster Cloudinary lookups
CREATE INDEX IF NOT EXISTS idx_carousel_banners_image_public_id 
ON carousel_banners(image_public_id);

-- ============================================================================
-- 2. CATEGORIES TABLE - Add Cloudinary public_id support for images
-- ============================================================================

-- Add image_public_id column to categories table if it doesn't exist
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255) NULL DEFAULT NULL;

-- Add banner_public_id column to categories table if it doesn't exist
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS banner_public_id VARCHAR(255) NULL DEFAULT NULL;

-- Create indexes on Cloudinary public_id fields for faster lookups
CREATE INDEX IF NOT EXISTS idx_categories_image_public_id 
ON categories(image_public_id);

CREATE INDEX IF NOT EXISTS idx_categories_banner_public_id 
ON categories(banner_public_id);

-- ============================================================================
-- 3. VERIFY CHANGES
-- ============================================================================

-- Show carousel_banners table structure for image fields
SELECT 'carousel_banners' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'carousel_banners' 
  AND column_name IN ('image_url', 'image_public_id')
ORDER BY ordinal_position;

-- Show categories table structure for image-related columns
SELECT 'categories' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'categories' 
  AND column_name IN ('image_url', 'image_public_id', 'banner_url', 'banner_public_id')
ORDER BY ordinal_position;

-- Show all created indexes for Cloudinary fields
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('carousel_banners', 'categories')
AND indexname LIKE '%public_id%'
ORDER BY tablename, indexname;

-- Migration completed successfully
-- This script safely adds Cloudinary support to Neon database

