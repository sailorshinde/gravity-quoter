# Product Image Naming Convention

## Overview
Product images are optional and used to provide visual reference in quotes. Images are stored in organized folders by supplier and product category.

## Folder Structure

```
/public/products/images/
├── gravity-lab-chemicals/      # Gravity Lab Chemicals supplier
│   ├── powders/
│   ├── acids/
│   ├── salts/
│   ├── metals/
│   └── organic-compounds/
├── other-suppliers/             # Other supplier images
│   ├── supplier-name/
│   └── ...
└── general/                     # Generic/miscellaneous images
    └── ...
```

## Naming Convention

### Standard Format
```
{hsn-code}_{product-slug}_{size}.{ext}
```

### Components

**HSN Code:** First 4-6 digits of HSN code
- Example: `2913` for acids, `2917` for salts

**Product Slug:** Product name in lowercase with hyphens
- Example: `ammonium-ferrous-sulphate`, `calcium-chloride`
- Remove special characters, spaces → hyphens
- Maximum 50 characters

**Size:** Image size/variant (optional)
- `main` - Primary product image
- `alt` - Alternative angle
- `packaging` - Packaging image
- `detail` - Close-up detail
- If no size, default to main

**Extension:** File type
- `.jpg` - JPEG (preferred for photos)
- `.png` - PNG (for graphics with transparency)
- `.webp` - WebP (modern, optimized)

### Examples

**Good Names:**
```
2913_ammonium-ferrous-sulphate_main.jpg
2913_ammonium-ferrous-sulphate_packaging.jpg
2917_calcium-chloride_main.png
2913_benzoic-acid_detail.jpg
2917_oxalic-acid_main.webp
```

**Bad Names (avoid):**
```
ammonium_sulphate.jpg          ❌ Missing HSN code
2913_Ammonium Ferrous.jpg      ❌ Spaces instead of hyphens
product.jpg                    ❌ Not descriptive
IMG_2024.jpg                   ❌ Generic name
```

## Implementation

### Linking Images to Products

In the pricing database (`gravityLabPricingData.ts`), add optional `image` field:

```typescript
{
  sr: 1,
  name: "Ammonium Ferrous Sulphate",
  hsn: "28429090",
  gst: "18%",
  packing: "500 gm",
  price: 300,
  image: "/products/images/gravity-lab-chemicals/salts/28429_ammonium-ferrous-sulphate_main.jpg"
}
```

### URL Pattern in Code

```typescript
// Auto-generate image path
const imagePath = `/products/images/gravity-lab-chemicals/salts/${hsn}_${productSlug}_main.jpg`

// With fallback
const imagePath = item.image || `/products/images/general/no-image.png`
```

## Image Specifications

### Technical Requirements
- **Format:** JPG, PNG, or WebP
- **Size:** 
  - Recommended: 400x400 to 800x800px
  - Maximum: 2000x2000px for detail images
  - Minimum: 200x200px
  
- **File Size:**
  - Ideal: 50-200 KB per image
  - Maximum: 500 KB
  - Use compression tools (TinyPNG, ImageOptim)

- **Quality:**
  - JPG Quality: 80-90% (good balance)
  - PNG: Compress using PNGCrush
  - WebP: Use Cwebp for conversion

### Best Practices

1. **Consistent Styling**
   - Use white or neutral background
   - Similar lighting conditions
   - Consistent angle/perspective

2. **Multiple Views**
   - Main product image (main)
   - Packaging/label (packaging)
   - Detail shot if relevant (detail)
   - Alternative angle (alt)

3. **Organization**
   - Group by supplier folder
   - Further group by category (optional)
   - Keep filenames lowercase

4. **Version Control**
   - Don't version in filename (use git)
   - Use consistent naming for replacements
   - Archive old images if needed

## Usage in Application

### Displaying Images

```typescript
// In QuoteGenerator component
<img 
  src={item.image || '/products/images/general/no-image.png'}
  alt={item.description}
  className="w-16 h-16 object-cover rounded"
  onError={(e) => e.currentTarget.src = '/products/images/general/no-image.png'}
/>
```

### In Exports

Excel:
- Include image path/reference
- Can add thumbnail if library supports

PDF:
- Embed images if available
- Fall back to text description

## Admin Tasks

When uploading images:
1. Ensure file follows naming convention
2. Place in correct supplier/category folder
3. Update product database with image path
4. Test display in quote form
5. Verify file size < 500 KB

When removing/replacing:
1. Update database reference
2. Backup old image (optional)
3. Delete from folder
4. Test quote display

## Troubleshooting

**Image not showing?**
- Check file path in database
- Verify file exists in folder
- Check file name spelling (case-sensitive on Linux)
- Browser cache - hard refresh (Ctrl+Shift+R)

**File too large?**
- Compress using TinyPNG.com
- Reduce dimensions
- Convert to WebP format

**Wrong image appearing?**
- Verify HSN code in filename
- Check product slug matches
- Clear cache and reload
