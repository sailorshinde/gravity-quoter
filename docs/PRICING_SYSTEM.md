# Gravity Quoter - Pricing System Documentation

## Overview

The Gravity Quoter now uses a knowledge-based pricing system instead of file uploads. This allows users to select from pre-configured supplier pricing data, making quote generation faster and more consistent.

## Architecture

### Components

1. **PricingSelector** (`src/components/UploadSection.tsx`)
   - Displays available pricing sources
   - Allows users to select their supplier
   - Shows pricing source details

2. **ItemSelector** (`src/components/ItemSelector.tsx`)
   - Search interface for items in the pricing database
   - Real-time filtering by product name or HSN code
   - Quick-add to quote with quantity selection
   - Shows item details (price, packing, GST)

3. **QuoteGenerator** (`src/components/QuoteGenerator.tsx`)
   - Integrates ItemSelector for database product selection
   - Supports manual item entry
   - Generates quotes with selected pricing

### Data Structure

Pricing data is stored in JSON format with the following structure:

```json
{
  "supplier": {
    "name": "Company Name",
    "description": "Company description",
    "address": "Full address",
    "phone": ["phone1", "phone2"],
    "bankDetails": { ... },
    "commercialTerms": { ... }
  },
  "items": [
    {
      "sr": 1,
      "name": "Product Name",
      "hsn": "HSN Code",
      "gst": "GST%",
      "packing": "Package size",
      "price": 1000
    }
  ]
}
```

## Current Pricing Sources

### 1. Gravity Lab Chemicals
- **File**: `src/data/completeGravityLabPricing.json`
- **Items**: 694 chemical products
- **Categories**: Powders, Acids, Salts, Metals, Organic Compounds, Dyes, etc.
- **ISO Certified**: ISO 9001:2008
- **Location**: Mumbai, India

### 2. TypeScript Data
- **File**: `src/data/gravityLabPricingData.ts`
- **Type**: Strongly typed for development
- **Use**: When you need type safety and autocomplete

## Adding New Suppliers

### Step 1: Create Pricing Data File

Create a new JSON file in `src/data/` directory:

```json
{
  "supplier": {
    "name": "New Supplier Name",
    "description": "Company details",
    "address": "Full address",
    "phone": ["phone numbers"],
    "bankDetails": { ... },
    "commercialTerms": { ... }
  },
  "items": [ ... ]
}
```

### Step 2: Register in PricingSelector

Update `src/components/UploadSection.tsx`:

```typescript
const sources: PricingSource[] = [
  {
    id: 'gravity-lab-chem',
    name: 'Gravity Lab Chemicals',
    description: 'Gravity Lab - 694 chemical items',
    itemCount: 694
  },
  {
    id: 'your-new-supplier',
    name: 'New Supplier',
    description: 'Your supplier - X items',
    itemCount: X
  },
  // Add more suppliers here
]
```

### Step 3: Update ItemSelector

Import the new supplier's items in `src/components/ItemSelector.tsx`:

```typescript
import { newSupplierItems } from '@/data/newSupplierPricingData'

// Update component to load appropriate items based on selected source
const filteredItems = useMemo(() => {
  const items = pricingSource.id === 'your-new-supplier' 
    ? newSupplierItems 
    : gravityLabItems
  // ... filtering logic
}, [searchTerm, pricingSource])
```

## Populating Full Database

### Current Status
- 100 items from Gravity Lab Chemicals are configured
- Full list of 694 items available in price list
- TypeScript interface defined for type safety

### To Complete Database

1. **Option A: Manual Entry**
   - Use the price list provided
   - Update `gravityLabPricingData.ts`
   - Add remaining 594 items

2. **Option B: Automated Script**
   - Run `scripts/generate-pricing-db.js`
   - Processes CSV/JSON data
   - Generates complete database automatically

3. **Option C: Import from CSV**
   - Convert PDF/Excel to CSV
   - Use import script to generate JSON
   - Validates and formats data

## Usage

### For End Users

1. **Select Pricing Source**
   - User lands on quote creation page
   - Selects supplier from available sources

2. **Add Items**
   - Click "Select from Pricing Database"
   - Search by product name or HSN code
   - Set quantity
   - Click "Add to Quote"

3. **Manual Adjustments**
   - Can manually edit prices
   - Can add custom items
   - Can modify quantities

4. **Export Quote**
   - Export as Excel or PDF
   - Includes supplier details
   - Professional formatting

### For Developers

```typescript
// Access pricing database
import { gravityLabItems } from '@/data/gravityLabPricingData'

// Search items
const results = gravityLabItems.filter(item => 
  item.name.toLowerCase().includes(searchTerm)
)

// Get item details
const item = gravityLabItems.find(i => i.sr === 1)

// Calculate with GST
const basePrice = item.price
const gstPercent = parseFloat(item.gst)
const gstAmount = (basePrice * gstPercent) / 100
const totalPrice = basePrice + gstAmount
```

## Features

### Search & Filtering
- ✅ Search by product name (partial match)
- ✅ Search by HSN code (exact match)
- ✅ Real-time results
- ✅ Case-insensitive search

### Item Management
- ✅ Add items from database
- ✅ Manual item entry
- ✅ Edit quantities and prices
- ✅ Remove items
- ✅ Preserve item metadata (HSN, GST, packing)

### Quote Generation
- ✅ Automatic GST calculation
- ✅ Subtotal and grand total
- ✅ Professional formatting
- ✅ Supplier details in quote
- ✅ Commercial terms display

### Export Options
- ✅ Excel export (.xlsx)
- ✅ PDF export (.pdf)
- ✅ Professional templates

## Future Enhancements

1. **Multiple Suppliers**
   - Easy switching between suppliers
   - Compare pricing across suppliers
   - Bulk operations

2. **Advanced Filtering**
   - Filter by category
   - Filter by price range
   - Filter by GST rate
   - Filter by packing size

3. **Integration Features**
   - Import from URL
   - Sync with external APIs
   - Real-time price updates
   - Inventory management

4. **Analytics**
   - Most quoted items
   - Price trends
   - Customer preferences
   - Usage statistics

## Troubleshooting

### Items Not Appearing
- Ensure JSON is valid
- Check file path in imports
- Verify item structure matches interface

### Search Not Working
- Check searchTerm is not empty
- Verify item names match search pattern
- Case-insensitive search enabled by default

### GST Calculation Issues
- Verify GST format (should be "5%", "18%", etc.)
- Check parseFloat handling in code
- Verify quantity and price values are numbers

## File Structure

```
src/
├── components/
│   ├── UploadSection.tsx (PricingSelector)
│   ├── ItemSelector.tsx
│   └── QuoteGenerator.tsx
├── data/
│   ├── gravityLabPricingData.ts
│   ├── completeGravityLabPricing.json
│   └── pricingDatabase.json
└── app/
    └── page.tsx

scripts/
├── generate-pricing-db.js
└── generate-sample-excel.js

docs/
└── PRICING_SYSTEM.md (this file)
```

## Contact & Support

For adding new suppliers or updating pricing data:
- Update JSON files in `src/data/`
- Register suppliers in components
- Run `npm run build` to validate
- Test with sample items
- Commit changes with clear messages

## Related Files

- Sample Output: `samples/SAMPLE_OUTPUT.md`
- Quotation Template: `samples/sample-quotation.xlsx`
- Configuration: `src/data/gravityLabPricingData.ts`
