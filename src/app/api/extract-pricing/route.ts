import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { fileContent, fileName } = await request.json()

    // Parse PDF or text content to extract pricing
    // This is a template - in production would use Claude API to extract from PDF

    const pricingData = extractPricingFromContent(fileContent)

    // Generate CSV
    const csv = generateCSV(pricingData)

    return NextResponse.json({
      success: true,
      itemCount: pricingData.length,
      csv: csv,
      preview: pricingData.slice(0, 5) // First 5 items for preview
    })
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json({
      error: 'Failed to extract pricing from PDF'
    }, { status: 500 })
  }
}

function extractPricingFromContent(content: string): any[] {
  // Parse pricing data from PDF text
  // In production, this would be more sophisticated
  const lines = content.split('\n')
  const items: any[] = []

  lines.forEach((line) => {
    // Pattern: Item Name | HSN | Price | GST
    const match = line.match(/([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)/)
    if (match) {
      items.push({
        name: match[1].trim(),
        hsn: match[2].trim(),
        price: parseFloat(match[3].trim()),
        gst: parseFloat(match[4].trim()) || 18
      })
    }
  })

  return items
}

function generateCSV(items: any[]): string {
  let csv = 'Item Name,HSN Code,Unit Price,GST %,Packing\n'

  items.forEach(item => {
    csv += `"${item.name}","${item.hsn}",${item.price},${item.gst},"500 gm"\n`
  })

  return csv
}
