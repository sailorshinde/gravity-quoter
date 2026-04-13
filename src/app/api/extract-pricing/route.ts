import { NextRequest, NextResponse } from 'next/server'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'
import * as protos from '@google-cloud/documentai/build/protos/protos'

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

    let fileContent = ''

    if (fileExt === 'pdf' || file.type === 'application/pdf') {
      // Use Google Document AI to extract text from PDF
      try {
        const buffer = await file.arrayBuffer()
        fileContent = await extractWithDocumentAI(Buffer.from(buffer))
      } catch (docaiError) {
        console.error('Document AI error:', docaiError)
        const errorMessage = (docaiError as any).message || String(docaiError)
        const errorDetails = (docaiError as any).details || (docaiError as any).code || 'Unknown error'
        return NextResponse.json({
          success: false,
          error: 'Failed to extract PDF using Document AI.',
          debug: {
            errorType: errorMessage,
            errorDetails: errorDetails,
            fullError: String(docaiError)
          }
        }, { status: 400 })
      }
    } else if (fileExt === 'csv' || fileExt === 'txt' || file.type === 'text/csv' || file.type === 'text/plain') {
      fileContent = await file.text()
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

    // Parse pricing data from content
    const pricingData = extractPricingFromContent(fileContent, fileExt)

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
    console.error('Extraction error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to extract pricing. Please check the file format.'
    }, { status: 500 })
  }
}

async function extractWithDocumentAI(pdfBuffer: Buffer): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const processorId = process.env.GOOGLE_CLOUD_PROCESSOR_ID
  const region = process.env.GOOGLE_CLOUD_REGION || 'us'
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON

  console.log('Document AI Configuration:', {
    projectId,
    processorId,
    region,
    hasCredentialsJson: !!credentialsJson,
    credentialsJsonLength: credentialsJson?.length || 0
  })

  if (!projectId || !processorId) {
    throw new Error('Missing Google Cloud credentials in environment variables')
  }

  // Parse credentials if provided as JSON string (for Railway/production)
  let credentials: any = undefined
  if (credentialsJson) {
    try {
      credentials = JSON.parse(credentialsJson)
      console.log('Successfully parsed GOOGLE_CREDENTIALS_JSON')
    } catch (e) {
      console.error('Failed to parse GOOGLE_CREDENTIALS_JSON:', e)
      throw new Error(`Invalid GOOGLE_CREDENTIALS_JSON format: ${(e as any).message}`)
    }
  } else {
    console.warn('GOOGLE_CREDENTIALS_JSON not provided, will rely on GOOGLE_APPLICATION_CREDENTIALS')
  }

  const client = new DocumentProcessorServiceClient({
    apiEndpoint: `${region}-documentai.googleapis.com`,
    credentials: credentials,
  })

  const processorName = client.processorPath(projectId, region, processorId)
  console.log('Processor name:', processorName)
  console.log('PDF buffer size:', pdfBuffer.length, 'bytes')

  const request: protos.google.cloud.documentai.v1.IProcessRequest = {
    name: processorName,
    rawDocument: {
      content: pdfBuffer,
      mimeType: 'application/pdf',
    },
  }

  console.log('Sending request to Document AI API...')
  const result = await client.processDocument(request)
  console.log('Document AI API response received')
  const response = result[0]
  const document = response.document

  if (!document) {
    throw new Error('No document returned from Document AI')
  }

  // Extract text from the document
  let extractedText = document.text || ''

  // Also try to extract from entities if available
  if (document.entities && document.entities.length > 0) {
    extractedText += '\n\n' + document.entities
      .map(entity => `${entity.type}: ${entity.textAnchor?.content || entity.mentionText || ''}`)
      .join('\n')
  }

  return extractedText
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
    csv += `${itemName},"${item.hsn}",${item.price},${item.gst},""\n`
  })

  return csv
}
