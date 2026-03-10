-- Migration: Ensure categories table has Cloudinary fields
-- Purpose: Support Cloudinary image management for categories
-- Created: 2026-03-10

-- Add image_public_id column if it doesn't exist
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255);

-- Add banner_public_id column if it doesn't exist  
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS banner_public_id VARCHAR(255);

-- Add indexes for cloudinary operations
CREATE INDEX IF NOT EXISTS idx_categories_image_public_id 
ON categories(image_public_id);

CREATE INDEX IF NOT EXISTS idx_categories_banner_public_id 
ON categories(banner_public_id);

-- Add comments for documentation
COMMENT ON COLUMN categories.image_public_id IS 'Cloudinary public_id for category image deletion and management';
COMMENT ON COLUMN categories.banner_public_id IS 'Cloudinary public_id for category banner deletion and management';
