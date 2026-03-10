-- Migration: Add Cloudinary public_id fields to categories table
-- Description: Adds image_public_id and banner_public_id fields for tracking Cloudinary images
-- This allows for proper image management and deletion from Cloudinary

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS banner_public_id VARCHAR(255) DEFAULT NULL;

-- Create indexes for faster lookups when deleting images
CREATE INDEX IF NOT EXISTS idx_categories_image_public_id ON categories(image_public_id);
CREATE INDEX IF NOT EXISTS idx_categories_banner_public_id ON categories(banner_public_id);

-- Add comments to document the new fields
COMMENT ON COLUMN categories.image_public_id IS 'Cloudinary public_id for the category image, used for image deletion and management';
COMMENT ON COLUMN categories.banner_public_id IS 'Cloudinary public_id for the banner image, used for image deletion and management';
