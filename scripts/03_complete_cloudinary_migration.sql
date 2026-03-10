-- Migration: Complete Cloudinary support for carousels and categories
-- Purpose: Ensure all necessary columns exist for storing Cloudinary URLs and public_ids
-- Created: 2026-03-10
-- This script is safe to run multiple times (uses IF NOT EXISTS)

-- ========== CAROUSEL_BANNER TABLE ==========

-- Ensure image_url is VARCHAR with sufficient length
ALTER TABLE carousel_banner
ALTER COLUMN image_url TYPE VARCHAR(500);

-- Add Cloudinary public_id column
ALTER TABLE carousel_banner
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255);

-- Create index for public_id lookups
CREATE INDEX IF NOT EXISTS idx_carousel_banner_image_public_id 
ON carousel_banner(image_public_id) 
WHERE image_public_id IS NOT NULL;

-- ========== CATEGORIES TABLE ==========

-- Ensure image_url is VARCHAR with sufficient length
ALTER TABLE categories
ALTER COLUMN image_url TYPE VARCHAR(500);

-- Ensure banner_url is VARCHAR with sufficient length (if exists)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);

-- Add Cloudinary public_ids
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255);

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS banner_public_id VARCHAR(255);

-- Create indexes for public_id lookups
CREATE INDEX IF NOT EXISTS idx_categories_image_public_id 
ON categories(image_public_id) 
WHERE image_public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_banner_public_id 
ON categories(banner_public_id) 
WHERE banner_public_id IS NOT NULL;

-- ========== VERIFICATION QUERIES ==========
-- Run these to verify the migrations:
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name IN ('carousel_banner', 'categories') 
-- AND column_name LIKE '%image%' OR column_name LIKE '%banner%' OR column_name LIKE '%public_id%';
