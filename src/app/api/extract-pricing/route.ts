import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    console.log('Extract-pricing API called at', new Date().toISOString())

    // Check content length before parsing
    const contentLength = request.headers.get('content-length')
    console.log('Request content-length:', contentLength)

    if (contentLength && parseInt(contentLength) > 4500000) {
      return NextResponse.json({
        success: false,
        error: 'File size exceeds 4.5MB limit. Please compress your PDF and try again. Use online tools like ILovePDF.com to reduce file size.'
      }, { status: 413 })
    }

    let formData
    try {
      formData = await request.formData()
      console.log('FormData parsed successfully')
    } catch (err) {
      console.error('FormData parsing failed:', err)
      return NextResponse.json({
        success: false,
        error: `FormData parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      }, { status: 400 })
    }

    const file = formData.get('file') as File
    console.log('File received:', { name: file?.name, type: file?.type, size: file?.size })

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    const fileName = file.name
    const fileType = file.type
    const fileExt = fileName.split('.').pop()?.toLowerCase()

    console.log('Processing file:', { fileName, fileType, fileExt })

    let fileContent = ''

    if (fileExt === 'pdf' || fileType === 'application/pdf') {
      try {
        console.log('Attempting PDF extraction')
        const buffer = await file.arrayBuffer()

        // Import pdf-parse dynamically
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: Buffer.from(buffer) })

        let extractedText = ''
        let isCorrupted = false

        try {
          // Try primary extraction method
          const data = await parser.getText()
          extractedText = data.text || data
          console.log('PDF text extracted, length:', extractedText.length)
        } catch (primaryErr) {
          console.warn('Primary extraction failed, trying alternative:', primaryErr)
          try {
            // Try alternative extraction method for different PDF types
            const data = await parser.getDocumentLines?.() || []
            extractedText = Array.isArray(data) ? data.join('\n') : String(data)
            console.log('Alternative extraction succeeded, length:', extractedText.length)
          } catch (altErr) {
            console.error('Alternative extraction also failed:', altErr)
            throw primaryErr
          }
        }

        // Validate extracted text quality
        if (!extractedText || extractedText.trim().length === 0) {
          return NextResponse.json({
            success: false,
            error: 'PDF appears to be empty or contains only images. Please use a PDF with extractable text.'
          }, { status: 400 })
        }

        // Check if text looks corrupted (high ratio of special/control characters)
        const specialCharCount = (extractedText.match(/[\u0080-\u009F]/g) || []).length
        const visibleCharCount = extractedText.replace(/[\s\u0080-\u009F\x00-\x1F]/g, '').length

        if (visibleCharCount > 0) {
          const corruptionRatio = specialCharCount / (specialCharCount + visibleCharCount)
          console.log('Text quality check:', { specialCharCount, visibleCharCount, corruptionRatio: (corruptionRatio * 100).toFixed(2) + '%' })

          if (corruptionRatio > 0.3) {
            isCorrupted = true
            console.warn('Extracted text appears corrupted with ' + (corruptionRatio * 100).toFixed(1) + '% special characters')
          }
        }

        if (isCorrupted) {
          return NextResponse.json({
            success: false,
            error: 'The PDF text appears to be corrupted or encoded in an unsupported format. This might be a scanned document. Please use a PDF with standard text encoding.'
          }, { status: 400 })
        }

        fileContent = extractedText
        console.log('PDF processed successfully')
      } catch (err) {
        console.error('PDF parsing error:', err)
        return NextResponse.json({
          success: false,
          error: `Could not extract text from PDF: ${err instanceof Error ? err.message : 'Unknown error'}. Try converting the PDF to a different format or using an online tool like CloudConvert.`
        }, { status: 400 })
      }
    } else if (fileExt === 'csv' || fileType === 'text/csv' || fileType === 'text/plain') {
      fileContent = await file.text()
      console.log('CSV extracted, content length:', fileContent.length)
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

    // Parse pricing data from content using AI
    console.log('Sending content to Claude for AI-powered extraction')
    const pricingData = await extractPricingWithAI(fileContent)
    console.log('Items extracted:', pricingData.length)

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

async function extractPricingWithAI(content: string): Promise<any[]> {
  try {
    const prompt = `Extract pricing data from the following PDF/document content.

Return ONLY a valid JSON array of objects with this exact structure (no markdown, no code blocks, just raw JSON):
[
  {"name": "Product Name", "hsn": "HSN Code or N/A", "price": 100.50, "gst": 18},
  ...
]

Requirements:
- Extract item names, HSN codes, prices, and GST percentages
- Prices must be valid numbers
- GST should be a number (18 for 18%)
- If HSN is not available, use "N/A"
- Include all items found
- Return empty array [] if no pricing data is found

Content to parse:
${content.substring(0, 8000)}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('Claude response:', responseText.substring(0, 200))

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in response')
      return []
    }

    const items = JSON.parse(jsonMatch[0])
    console.log('AI extraction successful, items:', items.length)
    return items
  } catch (err) {
    console.error('AI extraction error:', err)
    // Fallback to regex extraction if AI fails
    console.log('Falling back to regex extraction')
    return extractPricingFromContent(content)
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
