-- SQL Migration: Add Cloudinary Support to Carousel and Category Models
-- Date: 2026-03-10
-- Purpose: Add image_public_id fields to store Cloudinary public IDs for efficient image management
-- This enables direct Cloudinary CDN URL usage and proper image deletion

-- Add image_public_id column to carousel_banner table if it doesn't exist
ALTER TABLE carousel_banner 
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255) NULL DEFAULT NULL;

-- Add comment to clarify the field purpose
COMMENT ON COLUMN carousel_banner.image_public_id IS 'Cloudinary public_id for carousel banner images, used for CDN delivery and image deletion';

-- Create index on image_public_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_carousel_banner_image_public_id ON carousel_banner(image_public_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'carousel_banner' 
  AND column_name IN ('image_url', 'image_public_id')
ORDER BY ordinal_position;

-- Add image_public_id column to category table if it doesn't exist (for consistency)
ALTER TABLE category 
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255) NULL DEFAULT NULL;

-- Add comment to clarify the field purpose
COMMENT ON COLUMN category.image_public_id IS 'Cloudinary public_id for category images, used for CDN delivery and image deletion';

-- Create index on category image fields
CREATE INDEX IF NOT EXISTS idx_category_image_public_id ON category(image_public_id);
CREATE INDEX IF NOT EXISTS idx_category_image_url ON category(image_url);

-- Add banner_public_id column to category table if it doesn't exist (for banner images)
ALTER TABLE category 
ADD COLUMN IF NOT EXISTS banner_public_id VARCHAR(255) NULL DEFAULT NULL;

-- Add comment to clarify the field purpose
COMMENT ON COLUMN category.banner_public_id IS 'Cloudinary public_id for category banner images, used for CDN delivery and image deletion';

-- Create index on category banner fields
CREATE INDEX IF NOT EXISTS idx_category_banner_public_id ON category(banner_public_id);
CREATE INDEX IF NOT EXISTS idx_category_banner_url ON category(banner_url);

-- Verify all changes
SELECT 'carousel_banner' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'carousel_banner' 
  AND column_name IN ('image_url', 'image_public_id')
UNION ALL
SELECT 'category', column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'category' 
  AND column_name IN ('image_url', 'image_public_id', 'banner_url', 'banner_public_id')
ORDER BY table_name, ordinal_position;

-- Migration completed successfully
-- Run this script on Neon to add Cloudinary support fields to the database
