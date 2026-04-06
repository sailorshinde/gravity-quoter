import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const execPromise = promisify(exec)

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
      // Use pdftotext (Poppler) for better font encoding handling
      const buffer = await file.arrayBuffer()
      const tmpPdfPath = join(tmpdir(), `pdf-${Date.now()}.pdf`)
      const tmpTextPath = join(tmpdir(), `text-${Date.now()}.txt`)

      try {
        // Write PDF to temp file
        writeFileSync(tmpPdfPath, Buffer.from(buffer))

        // Extract text using pdftotext
        await execPromise(`pdftotext -enc UTF-8 "${tmpPdfPath}" "${tmpTextPath}"`)

        // Read extracted text
        const fs = await import('fs')
        fileContent = fs.readFileSync(tmpTextPath, 'utf-8')

        // Normalize whitespace and remove control characters
        fileContent = fileContent
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
          .replace(/\s+/g, ' ') // Collapse multiple whitespaces
          .trim()

        // Clean up temp files
        unlinkSync(tmpPdfPath)
        unlinkSync(tmpTextPath)
      } catch (pdfError) {
        console.error('PDF extraction error:', pdfError)
        // Clean up temp files if they exist
        try { unlinkSync(tmpPdfPath) } catch (e) {}
        try { unlinkSync(tmpTextPath) } catch (e) {}

        return NextResponse.json({
          success: false,
          error: 'Failed to extract PDF. Please check if the file is a valid PDF.',
          debug: { errorType: (pdfError as any).message }
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
      // Return detailed debug info
      const headerMatch = fileContent.match(/S\.NO\s+PRODUCTS\s+PKG\s+PRICE\s+HSN\s+CODE\s+GST/i)
      const firstLines = fileContent.split('\n').slice(0, 15).join('\n')
      const contextAround = headerMatch ? fileContent.substring(Math.max(0, fileContent.indexOf(headerMatch[0]) - 100), fileContent.indexOf(headerMatch[0]) + 200) : 'Header not found'

      return NextResponse.json({
        success: false,
        error: 'No pricing data found in file.',
        debug: {
          headerFound: !!headerMatch,
          firstLines: firstLines,
          totalChars: fileContent.length,
          contextAroundHeader: contextAround,
          message: 'Header found: ' + (!!headerMatch) + '. Check if format matches expected pattern.'
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
  // Find where the actual pricing table starts
  const tableStartMatch = content.match(/S\.NO\s+PRODUCTS\s+PKG\s+PRICE\s+HSN\s+CODE\s+GST/i)
  if (!tableStartMatch) {
    return [] // No pricing table found
  }

  // Get content after the header
  const tableStart = content.indexOf(tableStartMatch[0]) + tableStartMatch[0].length
  const tableContent = content.substring(tableStart)
  const lines = tableContent.split('\n')
  const items: any[] = []

  // Join multi-line entries and process
  let currentLine = ''

  lines.forEach((line) => {
    const trimmed = line.trim()

    // Skip empty lines, page breaks, and headers
    if (!trimmed || trimmed.match(/^(ANNEXURE|W\.E\.F|DETAILS|Pg\s*–|BIOLOGICAL|ACIDS|BUFFER|SOLUTIONS|INDICATORS|REAGENTS|SOLVENTS)/) || trimmed.match(/^\d+\s*$/) ) {
      currentLine = ''
      return
    }

    // Check if this line starts with a number (new pricing entry)
    if (trimmed.match(/^\d+\s+[A-Z]/)) {
      // Process previous line if exists
      if (currentLine) {
        extractItem(currentLine, items)
      }
      currentLine = trimmed
    } else {
      // Continue the previous line (multi-line product name)
      if (currentLine) {
        currentLine += ' ' + trimmed
      }
    }
  })

  // Process last line
  if (currentLine) {
    extractItem(currentLine, items)
  }

  return items
}

function extractItem(line: string, items: any[]) {
  const trimmed = line.trim()

  // Skip footer and non-data lines
  if (trimmed.toLowerCase().includes('contact') || trimmed.toLowerCase().includes('email')) return
  if (trimmed.match(/^\d{4,}\s*$/)) return // Just phone numbers

  // Pattern: NUMBER PRODUCTNAME ... SIZE PRICE HSN GST%
  // Match line starting with number, containing ML/LTR, price, 6-digit HSN, and percentage
  const match = trimmed.match(/^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d{6})\s+(\d+)%?$/)

  if (match) {
    const price = parseFloat(match[3])

    // Validate
    if (price > 0 && price < 100000) {
      items.push({
        name: match[2].trim(),
        hsn: match[4].trim(),
        price: price,
        gst: match[5]
      })
      return
    }
  }

  // Alternative pattern with more flexible spacing and text
  const match2 = trimmed.match(/^(\d+)\s+(.+)\s+(\d{6})\s+(\d+)%?\s*$/)
  if (match2) {
    // Extract price from the product name part
    const namePart = match2[2]
    const priceMatch = namePart.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*$/)

    if (priceMatch) {
      const price = parseFloat(priceMatch[2])
      if (price > 0 && price < 100000) {
        items.push({
          name: priceMatch[1].trim(),
          hsn: match2[3].trim(),
          price: price,
          gst: match2[4]
        })
      }
    }
  }
}

function generateCSV(items: any[]): string {
  let csv = 'Item Name,HSN Code,Unit Price,GST %,Packing\n'

  items.forEach(item => {
    const itemName = item.name.includes(',') ? `"${item.name}"` : item.name
    csv += `${itemName},"${item.hsn}",${item.price},${item.gst},""\n`
  })

  return csv
}
