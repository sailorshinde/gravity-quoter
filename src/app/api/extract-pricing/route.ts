import { NextRequest, NextResponse } from 'next/server'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'
import * as protos from '@google-cloud/documentai/build/protos/protos'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'

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

    if (fileExt === 'pdf' || file.type === 'application/pdf') {
      // Use Google Document AI to extract text from PDF
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
  const MAX_PAGES_PER_REQUEST = 30

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
      console.log('Successfully parsed GOOGLE_CREDENTIALS_JSON', {
        type: credentials.type,
        project_id: credentials.project_id,
        client_email: credentials.client_email,
        hasPrivateKey: !!credentials.private_key
      })
    } catch (e) {
      console.error('Failed to parse GOOGLE_CREDENTIALS_JSON:', e)
      throw new Error(`Invalid GOOGLE_CREDENTIALS_JSON format: ${(e as any).message}`)
    }
  } else {
    console.warn('GOOGLE_CREDENTIALS_JSON not provided, will rely on GOOGLE_APPLICATION_CREDENTIALS file')
  }

  // Get page count and split if necessary
  let pdfChunks: Buffer[] = []

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const pageCount = pdfDoc.getPageCount()
    console.log(`PDF has ${pageCount} pages`)

    if (pageCount > MAX_PAGES_PER_REQUEST) {
      console.log(`PDF exceeds ${MAX_PAGES_PER_REQUEST} page limit. Splitting into chunks...`)

      // Split PDF into chunks of 30 pages each
      for (let i = 0; i < pageCount; i += MAX_PAGES_PER_REQUEST) {
        const endPage = Math.min(i + MAX_PAGES_PER_REQUEST, pageCount)
        console.log(`Creating chunk: pages ${i + 1}-${endPage}`)

        const chunkDoc = await PDFDocument.create()
        const pageIndices = Array.from({ length: endPage - i }, (_, idx) => i + idx)

        // Use copyPages to properly copy pages
        const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices)
        copiedPages.forEach(page => chunkDoc.addPage(page))

        const chunkBuffer = await chunkDoc.save()
        pdfChunks.push(Buffer.from(chunkBuffer))
      }
    } else {
      pdfChunks = [pdfBuffer]
    }
  } catch (e) {
    console.error('Error splitting PDF:', e)
    throw new Error(`Failed to process PDF: ${(e as any).message}`)
  }

  // Process each chunk
  const client = new DocumentProcessorServiceClient({
    apiEndpoint: `${region}-documentai.googleapis.com`,
    credentials: credentials,
  })

  const processorName = client.processorPath(projectId, region, processorId)
  console.log('Processor name:', processorName)

  let allExtractedText = ''

  for (let i = 0; i < pdfChunks.length; i++) {
    const chunk = pdfChunks[i]
    console.log(`Processing chunk ${i + 1} of ${pdfChunks.length} (${chunk.length} bytes)`)

    const request: protos.google.cloud.documentai.v1.IProcessRequest = {
      name: processorName,
      rawDocument: {
        content: chunk,
        mimeType: 'application/pdf',
      },
    }

    console.log('Sending request to Document AI API...')

    let result: any
    try {
      result = await Promise.race([
        client.processDocument(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Document AI API timeout after 5 minutes')), 300000)
        )
      ])
    } catch (error) {
      throw error
    }

    console.log('Document AI API response received for chunk ' + (i + 1))
    const response = result[0]
    const document = response.document

    if (!document) {
      throw new Error(`No document returned from Document AI for chunk ${i + 1}`)
    }

    // Extract text from the document
    let extractedText = document.text || ''

    // Also try to extract from entities if available
    if (document.entities && document.entities.length > 0) {
      extractedText += '\n\n' + document.entities
        .map((entity: any) => `${entity.type}: ${entity.textAnchor?.content || entity.mentionText || ''}`)
        .join('\n')
    }

    allExtractedText += extractedText + '\n\n'
  }

  return allExtractedText
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
