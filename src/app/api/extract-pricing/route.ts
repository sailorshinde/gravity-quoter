import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    const fileName = file.name
    const fileType = file.type
    const fileExt = fileName.split('.').pop()?.toLowerCase()

    let fileContent = ''

    if (fileExt === 'pdf' || fileType === 'application/pdf') {
      // For PDFs, read as text (basic extraction)
      // In production, use a proper PDF library like pdf-parse
      const buffer = await file.arrayBuffer()
      fileContent = Buffer.from(buffer).toString('utf-8')
    } else if (fileExt === 'csv' || fileType === 'text/csv') {
      fileContent = await file.text()
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      // For Excel files, we'd need to parse with a library like xlsx
      // For now, return a message asking to convert to CSV
      return NextResponse.json({
        success: false,
        error: 'Please convert Excel files to CSV format and re-upload'
      }, { status: 400 })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file format. Please upload PDF, CSV, or Excel file.'
      }, { status: 400 })
    }

    // Parse pricing data from content
    const pricingData = extractPricingFromContent(fileContent, fileExt)

    if (pricingData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No pricing data found in file. Expected format: Item Name | HSN Code | Unit Price | GST %'
      }, { status: 400 })
    }

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
      success: false,
      error: 'Failed to extract pricing. Please check the file format.'
    }, { status: 500 })
  }
}

function extractPricingFromContent(content: string, fileType?: string): any[] {
  const lines = content.split('\n')
  const items: any[] = []
  let headerRow = 0

  lines.forEach((line, index) => {
    // Skip empty lines and look for header row
    if (!line.trim()) return

    // Try pipe-separated format first
    let match = line.match(/([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)/)
    if (match) {
      const item = {
        name: match[1].trim(),
        hsn: match[2].trim(),
        price: parseFloat(match[3].trim()),
        gst: parseFloat(match[4].trim()) || 18
      }
      if (item.price > 0 || item.name.toLowerCase() !== 'item name') {
        items.push(item)
      }
      return
    }

    // Try CSV format (comma-separated)
    const csvMatch = line.match(/^"?([^",]+)"?,\s*"?([^",]+)"?,\s*"?([\d.]+)"?,\s*"?([\d.]+)"?/)
    if (csvMatch && lines.indexOf(line) > 0) { // Skip header line
      const item = {
        name: csvMatch[1].trim(),
        hsn: csvMatch[2].trim(),
        price: parseFloat(csvMatch[3].trim()),
        gst: parseFloat(csvMatch[4].trim()) || 18
      }
      if (item.price > 0) {
        items.push(item)
      }
    }
  })

  return items
}

function generateCSV(items: any[]): string {
  let csv = 'Item Name,HSN Code,Unit Price,GST %,Packing\n'

  items.forEach(item => {
    const itemName = item.name.includes(',') ? `"${item.name}"` : item.name
    csv += `${itemName},"${item.hsn}",${item.price},${item.gst},""\n`
  })

  return csv
}
