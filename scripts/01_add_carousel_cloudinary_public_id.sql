-- Migration: Add Cloudinary image_public_id to carousel_banner table
-- Purpose: Support Cloudinary image management with public_id for deletion
-- Created: 2026-03-10

-- Add image_public_id column if it doesn't exist
ALTER TABLE carousel_banner
ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255);

-- Add index for future cloudinary operations
CREATE INDEX IF NOT EXISTS idx_carousel_banner_image_public_id 
ON carousel_banner(image_public_id);

-- Add comment for documentation
COMMENT ON COLUMN carousel_banner.image_public_id IS 'Cloudinary public_id for image deletion and management';
