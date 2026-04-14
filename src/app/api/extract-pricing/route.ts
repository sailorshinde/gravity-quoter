import { NextRequest, NextResponse } from 'next/server'
import Reducto from 'reductoai'

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
    const fileExt = fileName.split('.').pop()?.toLowerCase()
    const fileSizeMB = file.size / (1024 * 1024)

    let fileContent = ''
    let pricingData: any[] = []

    if (fileExt === 'pdf' || file.type === 'application/pdf') {
      // Use Reducto to extract text and data from PDF
      console.log(`Processing PDF: ${fileName} (${fileSizeMB.toFixed(2)}MB)`)

      if (fileSizeMB > 50) {
        return NextResponse.json({
          success: false,
          error: 'PDF file is too large. Maximum size is 50MB.',
          debug: { fileSizeMB }
        }, { status: 400 })
      }

      try {
        const buffer = await file.arrayBuffer()
        pricingData = await extractWithReducto(Buffer.from(buffer), fileName)
      } catch (reductoError) {
        console.error('Reducto error:', reductoError)
        const errorMessage = (reductoError as any).message || String(reductoError)
        const errorDetails = (reductoError as any).details || (reductoError as any).code || 'Unknown error'
        return NextResponse.json({
          success: false,
          error: 'Failed to extract PDF using Reducto.',
          debug: {
            errorType: errorMessage,
            errorDetails: errorDetails,
            fullError: String(reductoError)
          }
        }, { status: 400 })
      }
    } else if (fileExt === 'csv' || fileExt === 'txt' || file.type === 'text/csv' || file.type === 'text/plain') {
      fileContent = await file.text()
      pricingData = extractPricingFromContent(fileContent, fileExt)
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      return NextResponse.json({
        success: false,
        error: 'Please convert Excel files to CSV format and re-upload'
      }, { status: 400 })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file format. Please upload PDF, CSV, TXT, or Excel file.'
      }, { status: 400 })
    }

    // Validate extracted data
    console.log('Extracted items:', pricingData.length)

    if (pricingData.length === 0) {
      const firstLines = fileContent.split('\n').slice(0, 15).join('\n')
      return NextResponse.json({
        success: false,
        error: 'No pricing data found in file.',
        debug: {
          firstLines: firstLines,
          totalChars: fileContent.length,
          message: 'Check if format matches expected pattern.'
        }
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
    const errorMessage = (error as any)?.message || String(error)
    const errorCode = (error as any)?.code || 'UNKNOWN'
    const errorDetails = (error as any)?.details || (error as any)?.description || ''

    console.error('Extraction error details:', {
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
      fullError: JSON.stringify(error, null, 2)
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to extract pricing. Please check the file format.',
      debug: {
        errorMessage,
        errorCode,
        errorDetails
      }
    }, { status: 500 })
  }
}

async function extractWithReducto(pdfBuffer: Buffer, fileName: string): Promise<any[]> {
  const apiKey = process.env.REDUCTO_API_KEY

  console.log('Reducto Configuration:', {
    hasApiKey: !!apiKey,
    fileName: fileName,
    bufferSize: pdfBuffer.length
  })

  if (!apiKey) {
    throw new Error('Missing REDUCTO_API_KEY in environment variables')
  }

  const client = new Reducto({ apiKey })

  console.log('Uploading PDF to Reducto...')

  try {
    // Upload the file (convert Buffer to base64)
    const base64File = pdfBuffer.toString('base64')
    const fileExtension = fileName.split('.').pop() || 'pdf'
    const uploadResponse = await client.upload({
      file: base64File,
      extension: fileExtension
    })

    console.log('File uploaded successfully:', uploadResponse.file_id)

    // Define schema for pricing extraction
    const schema = {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Product or item name' },
            price: { type: 'number', description: 'Unit price' },
            hsn: { type: 'string', description: 'HSN code' },
            gst: { type: 'string', description: 'GST percentage' },
            packing: { type: 'string', description: 'Packing size or quantity' }
          },
          required: ['name', 'price', 'hsn', 'gst']
        }
      }
    }

    console.log('Extracting pricing data with Reducto...')

    // Extract data using schema
    const extractResponse = await client.extract.run({
      input: uploadResponse,
      instructions: {
        schema: schema
      }
    })

    console.log('Extraction complete. Response:', JSON.stringify(extractResponse).substring(0, 500))

    // Extract items from response - Reducto returns result which should contain our schema structure
    let extractedItems: any[] = []
    const response = extractResponse as any
    if (response.result) {
      if (Array.isArray(response.result)) {
        extractedItems = response.result.length > 0 && response.result[0].items ? response.result[0].items : []
      } else if (response.result.items) {
        extractedItems = response.result.items
      }
    }

    console.log('Extracted items count:', extractedItems.length)

    // Validate and transform extracted items
    const items = (extractedItems || [])
      .filter((item: any) => {
        // Validate required fields
        if (!item.name || !item.price || !item.hsn || !item.gst) {
          return false
        }

        // Validate price is a reasonable number
        const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price
        return price > 0 && price < 100000
      })
      .map((item: any) => ({
        name: String(item.name).trim(),
        price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
        hsn: String(item.hsn).trim(),
        gst: String(item.gst).trim().replace('%', ''),
        packing: item.packing ? String(item.packing).trim() : ''
      }))

    console.log('Validated items:', items.length)

    return items
  } catch (error) {
    const errorMsg = (error as any).message || String(error)
    console.error('Raw Reducto error:', {
      message: errorMsg,
      fullError: JSON.stringify(error)
    })

    throw error
  }
}

function extractPricingFromContent(content: string, fileType?: string): any[] {
  // Find where the actual pricing table starts
  const tableStartMatch = content.match(/S\.NO\s+PRODUCTS\s+PKG\s+PRICE\s+HSN\s+CODE\s+GST/i)
  if (!tableStartMatch) {
    return []
  }

  const tableStart = content.indexOf(tableStartMatch[0]) + tableStartMatch[0].length
  const tableContent = content.substring(tableStart)
  const lines = tableContent.split('\n')
  const items: any[] = []

  let currentLine = ''

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (!trimmed || trimmed.match(/^(ANNEXURE|W\.E\.F|DETAILS|Pg\s*–|BIOLOGICAL|ACIDS|BUFFER|SOLUTIONS|INDICATORS|REAGENTS|SOLVENTS)/) || trimmed.match(/^\d+\s*$/) ) {
      currentLine = ''
      return
    }

    if (trimmed.match(/^\d+\s+[A-Z]/)) {
      if (currentLine) {
        extractItem(currentLine, items)
      }
      currentLine = trimmed
    } else {
      if (currentLine) {
        currentLine += ' ' + trimmed
      }
    }
  })

  if (currentLine) {
    extractItem(currentLine, items)
  }

  return items
}

function extractItem(line: string, items: any[]) {
  const trimmed = line.trim()

  if (trimmed.toLowerCase().includes('contact') || trimmed.toLowerCase().includes('email')) return
  if (trimmed.match(/^\d{4,}\s*$/)) return

  const match = trimmed.match(/^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d{6})\s+(\d+)%?$/)

  if (match) {
    const price = parseFloat(match[3])

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

  const match2 = trimmed.match(/^(\d+)\s+(.+)\s+(\d{6})\s+(\d+)%?\s*$/)
  if (match2) {
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
    csv += `${itemName},"${item.hsn}",${item.price},${item.gst},"${item.packing || ''}"\n`
  })

  return csv
}
