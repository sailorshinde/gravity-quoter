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
      // Use pdf-parse library to properly extract text from PDF
      const buffer = await file.arrayBuffer()
      const pdfParser = new PDFParse({ data: new Uint8Array(buffer) })
      const textResult = await pdfParser.getText()
      fileContent = textResult.text
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

  lines.forEach((line, index) => {
    // Skip empty lines and header rows
    if (!line.trim() || index === 0) return
    if (line.toLowerCase().includes('item name') && line.toLowerCase().includes('hsn')) return

    // Try pipe-separated format first
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

    // Try CSV format (comma-separated with flexible regex)
    // Match: "quoted text",number or text,number,number pattern
    const csvMatch = line.match(/^"?([^"]+?)"?,\s*"?([^"]+?)"?,\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/)
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
