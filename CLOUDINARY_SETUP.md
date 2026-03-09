# Cloudinary Integration for Admin Categories

## Overview
The admin categories module now uses Cloudinary CDN for storing and serving category images and banners, providing fast, reliable image delivery globally.

## Setup Requirements

### Environment Variables
Ensure the following environment variables are set in your `.env.local` or Vercel project settings:

```env
# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your_api_key
NEXT_PUBLIC_CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Getting Your Cloudinary Credentials
1. Sign up for a free Cloudinary account at [cloudinary.com](https://cloudinary.com)
2. Navigate to your Dashboard
3. Find your **Cloud Name**, **API Key**, and **API Secret** in the Account Settings
4. Add these credentials to your environment variables

## Features

### Category Image Upload
- **Endpoint**: `POST /api/admin/cloudinary/upload/category`
- **Request**: Multipart form data with `file` and `image_type` fields
- **Image Type**: `category` or `banner`
- **Response**: JSON with `secure_url`, `public_id`, and image metadata

### Image Organization
Images are automatically organized in Cloudinary:
- **Category Images**: `mizizzi/categories` folder
- **Banner Images**: `mizizzi/categories/banners` folder

### Image Transformations
The following transformations are applied for optimal performance:
- **Quality**: Auto (Cloudinary optimizes based on device/browser)
- **Format**: Auto (WebP, JPEG, etc. based on client support)
- **Responsive**: Images scale for different screen sizes

## Frontend Integration

### Category Form Dialog
The category form in `/frontend/components/admin/categories/category-form-dialog.tsx` now:

1. Accepts image uploads from the admin interface
2. Sends images directly to Cloudinary via the new upload endpoint
3. Stores the Cloudinary URL (e.g., `https://res.cloudinary.com/...`) in the database
4. Displays fast-loading images from the CDN in the admin panel and storefront

### Image Upload Flow
```
Admin uploads image → Cloudinary upload endpoint → Cloudinary stores image
                                                  → Returns secure URL
                                                  → Frontend receives URL
                                                  → Sends URL to category API
                                                  → Database stores URL
                                                  → Images serve from CDN
```

## Backend Integration

### Upload Endpoint
**File**: `/backend/app/routes/admin/admin_cloudinary_routes.py`

New route:
```
POST /api/admin/cloudinary/upload/category
```

Features:
- JWT authentication required
- Admin role validation
- Automatic Cloudinary configuration
- Proper error handling and logging
- Returns Cloudinary metadata

### Category Routes
**File**: `/backend/app/routes/admin/admin_categories_routes.py`

The category creation and update endpoints already support:
- `image_url`: Direct URL storage (from Cloudinary)
- `image_data`: Base64 data (for backward compatibility)
- `banner_url`: Banner URL from Cloudinary
- `banner_data`: Base64 banner data (for backward compatibility)

## Usage

### Creating a Category with Cloudinary Image
1. Open Admin Dashboard → Shop Categories
2. Click "Add Category"
3. Click "Upload Image" to select and upload via Cloudinary
4. Wait for upload confirmation
5. Fill in category details
6. Click "Create Category"

The image is now served from Cloudinary CDN globally.

### Editing Category Image
1. Click "Edit" on the category
2. Click "Change Image" to replace with a new Cloudinary image
3. Click "Update Category"

Old images are retained in the database; only the URL is updated.

## Performance Benefits

- **Global CDN**: Images served from edge locations worldwide
- **Auto Optimization**: Cloudinary automatically optimizes format and quality
- **Fast Delivery**: Sub-second image load times
- **Bandwidth Optimization**: Reduced server load
- **Responsive**: Images adapted for different devices/screen sizes
- **Caching**: Browser and CDN caching for repeat visits

## Troubleshooting

### Upload Fails with "Cloudinary configuration missing"
- Verify environment variables are set correctly
- Restart the development server
- Check that API credentials are accurate

### Images Not Displaying
- Verify the Cloudinary URL is accessible
- Check browser console for CORS errors
- Ensure public_id and cloud_name are correct

### Slow Image Loading
- Verify images are being served from Cloudinary URLs (not base64)
- Check Cloudinary dashboard for any service issues
- Clear browser cache

## Migration from Base64 Storage

Existing categories with base64-encoded images will continue to work. To migrate:

1. Edit the category
2. Re-upload the image via Cloudinary
3. Save the category

The database will update to use the Cloudinary URL instead of base64 data.

## Backup and Recovery

Cloudinary provides:
- Automatic backups
- Version history
- Multi-region redundancy
- 99.95% uptime SLA

See [Cloudinary Documentation](https://cloudinary.com/documentation) for details.
