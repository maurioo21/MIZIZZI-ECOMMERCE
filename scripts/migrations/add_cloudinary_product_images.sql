-- SQL Migration: Add Cloudinary Support to Product Images
-- Date: 2026-03-10
-- Purpose: Add public_id field to product_images table for efficient Cloudinary image management
-- This enables direct Cloudinary CDN URL usage and proper image deletion

-- ============================================================================
-- PRODUCT_IMAGES TABLE - Add Cloudinary public_id support
-- ============================================================================

-- Add public_id column to product_images table if it doesn't exist
ALTER TABLE product_images 
ADD COLUMN IF NOT EXISTS public_id VARCHAR(255) NULL DEFAULT NULL;

-- Create index on public_id for faster Cloudinary lookups
CREATE INDEX IF NOT EXISTS idx_product_images_public_id 
ON product_images(public_id);

-- ============================================================================
-- VERIFY CHANGES
-- ============================================================================

-- Show product_images table structure for image-related columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'product_images' 
  AND column_name IN ('url', 'public_id', 'filename')
ORDER BY ordinal_position;

-- Show created index
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename = 'product_images'
AND indexname LIKE '%public_id%'
ORDER BY indexname;

-- Migration completed successfully
-- This script safely adds Cloudinary support to product images table in Neon database
