import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

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
      // Use PDFParse for robust Node.js text extraction
      const buffer = await file.arrayBuffer()
      try {
        const pdfParser = new PDFParse({ data: new Uint8Array(buffer) })
        const textResult = await pdfParser.getText()
        fileContent = textResult.text

        // Normalize whitespace and remove control characters that cause mojibake
        fileContent = fileContent
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F\x80-\x9F]/g, '') // Remove control and extended ASCII
          .replace(/\s+/g, ' ') // Collapse multiple whitespaces
          .trim()
      } catch (pdfError) {
        console.error('PDF parse error:', pdfError)
        return NextResponse.json({
          success: false,
          error: 'Failed to parse PDF. Please check if the file is a valid PDF.',
          debug: { errorType: (pdfError as any).name }
        }, { status: 400 })
      }
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
        error: 'No pricing data found in file. Expected format: Item Name | HSN Code | Unit Price | GST %',
        debug: {
          extractedText: fileContent.slice(0, 500), // First 500 chars of extracted text
          totalChars: fileContent.length
        }
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
  let skipUntilData = true

  lines.forEach((line) => {
    const trimmed = line.trim()

    // Skip empty lines and headers
    if (!trimmed || trimmed.toLowerCase().includes('s.no') || trimmed.toLowerCase().includes('products')) return
    if (trimmed.toLowerCase().includes('item name') && trimmed.toLowerCase().includes('hsn')) return
    if (trimmed.toLowerCase().includes('pk') && trimmed.toLowerCase().includes('price')) return

    // Try pipe-separated format first (for CSV-style input)
    let match = line.match(/([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)/)
    if (match) {
      const price = parseFloat(match[3].trim())
      if (price > 0) {
        items.push({
          name: match[1].trim(),
          hsn: match[2].trim(),
          price: price,
          gst: parseFloat(match[4].trim()) || 18
        })
      }
      return
    }

    // Try space/tab-separated table format
    // Pattern: NUMBER PRODUCTNAME ... ML/Ml PRICE HSN GST%
    // Look for: starts with number, ends with % or number
    const spaceMatch = trimmed.match(/^(\d+)\s+(.+?)\s+(\d+\s+(?:ML|Ml|ml|LTR|Ltr|ltr|Kg|kg))\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+%?)/)
    if (spaceMatch) {
      const price = parseFloat(spaceMatch[4])
      if (price > 0) {
        items.push({
          name: spaceMatch[2].trim(),
          hsn: spaceMatch[5].trim(),
          price: price,
          gst: spaceMatch[6].replace('%', '')
        })
      }
      return
    }

    // Fallback: Try CSV format (comma-separated)
    const csvMatch = trimmed.match(/^"?([^"]+?)"?,\s*"?([^"]+?)"?,\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/)
    if (csvMatch) {
      const price = parseFloat(csvMatch[3])
      if (price > 0) {
        items.push({
          name: csvMatch[1].trim(),
          hsn: csvMatch[2].trim(),
          price: price,
          gst: parseFloat(csvMatch[4]) || 18
        })
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
