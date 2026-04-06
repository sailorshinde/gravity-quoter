import { NextRequest, NextResponse } from 'next/server'
import * as pdf from 'pdf-parse'

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
      try {
        const buffer = await file.arrayBuffer()
        const data = await pdf(Buffer.from(buffer))
        fileContent = data.text

        if (!fileContent || fileContent.trim().length === 0) {
          return NextResponse.json({
            success: false,
            error: 'PDF appears to be empty or contains only images. Please use a PDF with extractable text.'
          }, { status: 400 })
        }
      } catch (err) {
        console.error('PDF parsing error:', err)
        return NextResponse.json({
          success: false,
          error: 'Could not extract text from PDF. Ensure it contains text (not just scanned images).'
        }, { status: 400 })
      }
    } else if (fileExt === 'csv' || fileType === 'text/csv' || fileType === 'text/plain') {
      fileContent = await file.text()
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      return NextResponse.json({
        success: false,
        error: 'Excel files not yet supported. Please convert to CSV and re-upload.'
      }, { status: 400 })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file format. Please upload PDF or CSV.'
      }, { status: 400 })
    }

    // Parse pricing data from content
    const pricingData = extractPricingFromContent(fileContent, fileExt)

    if (pricingData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No pricing data found. Expected format:\n• Pipe-separated: Item Name | HSN Code | Unit Price | GST %\n• CSV: Item Name, HSN Code, Unit Price, GST %'
      }, { status: 400 })
    }

    // Generate CSV
    const csv = generateCSV(pricingData)

    return NextResponse.json({
      success: true,
      itemCount: pricingData.length,
      csv: csv,
      preview: pricingData.slice(0, 5)
    })
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json({
      success: false,
      error: `Failed to extract pricing: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}

function extractPricingFromContent(content: string, fileType?: string): any[] {
  const lines = content.split('\n')
  const items: any[] = []

  lines.forEach((line) => {
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
      if (item.price > 0 && item.name.toLowerCase() !== 'item name') {
        items.push(item)
      }
      return
    }

    // Try CSV format (comma-separated)
    const csvMatch = line.match(/^"?([^",]+)"?,\s*"?([^",]+)"?,\s*"?([\d.]+)"?,\s*"?([\d.]+)"?/)
    if (csvMatch) {
      const name = csvMatch[1].trim()
      const hsn = csvMatch[2].trim()
      const price = parseFloat(csvMatch[3].trim())
      const gst = parseFloat(csvMatch[4].trim()) || 18

      // Skip header rows and invalid entries
      if (price > 0 && name.toLowerCase() !== 'item name' && name.toLowerCase() !== 'description') {
        items.push({ name, hsn, price, gst })
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
