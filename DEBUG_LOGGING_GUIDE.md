# Debug Logging Guide for Category Image Upload

## Overview
Comprehensive debug logging has been added to the category form dialog to track the entire image upload and save flow. All debug logs are prefixed with `[v0]` for easy filtering.

## How to View Debug Logs

1. Open your browser's **Developer Tools** (F12 or Cmd+Option+I)
2. Go to the **Console** tab
3. All debug messages are prefixed with `[v0]` - you can filter for them

## Complete Debug Flow

### 1. Image Selection
When you select an image from your computer:

```
[v0] Category image selected: { name: "image.jpg", size: 245000, type: "image/jpeg" }
[v0] File validation result: { valid: true, error: null }
[v0] Generating preview for category image...
[v0] Preview generated successfully, length: 123456
[v0] Category image state updated
```

**What this tells you:**
- File was successfully selected and validated
- Preview was generated from the file
- State was updated with the file and preview

### 2. Uploading to Cloudinary
When you click "Upload to Cloud" button:

```
[v0] Starting upload for: category
[v0] File details: { name: "image.jpg", size: 245000, type: "image/jpeg" }
[v0] Auth token present: true
[v0] Upload endpoint: http://localhost:5000/api/admin/shop-categories/categories/upload-image
[v0] Sending fetch request...
[v0] Response received: { status: 200, statusText: "OK" }
[v0] Upload response data: {
  success: true,
  url: "https://res.cloudinary.com/...",
  secure_url: "https://res.cloudinary.com/...",
  public_id: "shop/xyz123"
}
[v0] Extracted URL: https://res.cloudinary.com/... Public ID: shop/xyz123
[v0] Updating form data with image
[v0] Upload completed successfully for: category
```

### 3. Saving the Category
When you click "Update" button:

```
[v0] handleSave called
[v0] Form data validated
[v0] Starting save operation
[v0] Sending request: { method: "PUT", endpoint: "..." }
[v0] Response received: { status: 200 }
[v0] Save successful
```

## Key Debug Commands

Filter console to show only v0 logs:
```javascript
// In browser console:
copy(document.body.innerText.split('\n').filter(l => l.includes('[v0]')).join('\n'))
```

## Troubleshooting

| Problem | What to check in logs |
|---------|---------------------|
| Image not uploading | See `[v0] Starting upload` - if missing, button not working |
| Upload fails | See `Response received: { status }` - check status code |
| No URL returned | See `[v0] Extracted URL` - if missing, backend not returning URL |
| Save fails | See `[v0] Save successful` - if missing, validation or API error |
| Auth issues | See `[v0] Auth token present: true/false` - check login status |

