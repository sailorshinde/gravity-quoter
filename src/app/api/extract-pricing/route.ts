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
    } else if (fileExt === 'json' || file.type === 'application/json') {
      // Handle Reducto JSON export with nested structure
      const jsonText = await file.text()
      try {
        const jsonData = JSON.parse(jsonText)

        // Reducto exports as array with extracted fields
        if (Array.isArray(jsonData)) {
          // Find the HTML table in citation.parentBlock of any field
          let htmlTable = ''
          for (let i = 0; i < jsonData.length; i++) {
            const item = jsonData[i]

            for (const key in item) {
              const field = item[key]
              // The parentBlock is inside citation, not at top level
              if (field?.citation?.parentBlock?.content && field.citation.parentBlock.content.includes('<table>')) {
                htmlTable = field.citation.parentBlock.content
                break
              }
            }
            if (htmlTable) break
          }

          if (htmlTable) {
            pricingData = parseHtmlTableToPricing(htmlTable)
          } else {
            return NextResponse.json({
              success: false,
              error: 'Could not find HTML table in JSON export. Make sure you exported from Reducto with table data.'
            }, { status: 400 })
          }
        } else if (jsonData.result && jsonData.result.chunks && Array.isArray(jsonData.result.chunks)) {
          // Format 2: Result with chunks (markdown tables)
          let found = false
          for (const chunk of jsonData.result.chunks) {
            if (chunk.content) {
              // Parse markdown table arrays from the content
              pricingData = parseReductoMarkdownTable(chunk.content)
              if (pricingData.length > 0) {
                found = true
                break
              }
            }
          }

          if (!found || pricingData.length === 0) {
            return NextResponse.json({
              success: false,
              error: 'Could not extract pricing data from Reducto export. Make sure it contains a price list table.'
            }, { status: 400 })
          }
        } else {
          return NextResponse.json({
            success: false,
            error: 'Unrecognized JSON format. Please make sure you exported from Reducto.'
          }, { status: 400 })
        }
      } catch (e) {
        return NextResponse.json({
          success: false,
          error: 'Invalid JSON file format: ' + (e as any).message
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

    console.log('Base64 file size:', base64File.length, 'bytes')

    // Add timeout to upload (120 seconds for large files)
    const uploadResponse = await Promise.race([
      client.upload({
        file: base64File,
        extension: fileExtension
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Reducto upload timeout after 120 seconds')), 120000)
      )
    ]) as any

    console.log('File uploaded successfully:', uploadResponse.file_id)

    // Define schema for pricing extraction
    // Reducto expects a schema that directly describes the extraction output
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              hsn: { type: 'string' },
              gst: { type: 'string' },
              packing: { type: 'string' }
            },
            required: ['name', 'price', 'hsn', 'gst']
          }
        }
      },
      required: ['items']
    }

    console.log('Extracting pricing data with Reducto...')

    // Add timeout to extract (60 seconds)
    const extractResponse = await Promise.race([
      client.extract.run({
        input: uploadResponse,
        instructions: {
          schema: schema
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Reducto extraction timeout after 60 seconds')), 60000)
      )
    ]) as any

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

function parseReductoMarkdownTable(content: string): any[] {
  const items: any[] = []

  // Extract all array rows from the content
  // Tables are formatted like: [["Sr.No", "Item Name", ...], ["1", "Product", ...], ...]
  const arrayPattern = /\[\s*"([^"]+)"\s*(?:,\s*"([^"]*)"\s*)*\]/g
  const rows: string[][] = []

  let match
  while ((match = arrayPattern.exec(content)) !== null) {
    const row: string[] = []
    // Extract all quoted strings in this array
    const innerContent = match[0]
    const stringPattern = /"([^"]*)"/g
    let stringMatch
    while ((stringMatch = stringPattern.exec(innerContent)) !== null) {
      row.push(stringMatch[1])
    }
    if (row.length > 0) {
      rows.push(row)
    }
  }

  if (rows.length < 2) return items

  // First row is header
  const headers = rows[0].map(h => h.toLowerCase())
  const nameIdx = headers.findIndex(h => h.includes('item'))
  const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('retail'))
  const hsnIdx = headers.findIndex(h => h.includes('hsn'))
  const gstIdx = headers.findIndex(h => h.includes('gst'))
  const packIdx = headers.findIndex(h => h.includes('packing') || h.includes('pack'))

  // Parse data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length === 0) continue

    const name = row[nameIdx]?.trim() || ''
    const priceStr = row[priceIdx]?.trim().replace(/[^0-9.]/g, '') || '0'
    const price = parseFloat(priceStr) || 0
    const hsn = row[hsnIdx]?.trim() || ''
    const gst = row[gstIdx]?.trim().replace('%', '').replace(/[^0-9]/g, '') || '0'
    const packing = row[packIdx]?.trim() || ''

    if (name && price > 0 && hsn) {
      items.push({
        name,
        price,
        hsn,
        gst,
        packing
      })
    }
  }

  return items
}

function parseHtmlTableToPricing(htmlContent: string): any[] {
  const items: any[] = []

  // Extract all table rows
  const rowMatches = Array.from(htmlContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g))

  let isHeaderRow = true
  const columnIndices: { [key: string]: number } = {}

  for (let i = 0; i < rowMatches.length; i++) {
    const match = rowMatches[i]
    const rowContent = match[1]
    // Match both <td> and <th> cells (headers use <th>, data uses <td>)
    const cellMatches = rowContent.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)
    const cells = Array.from(cellMatches).map(m => {
      // Remove HTML tags and clean whitespace
      return m[1]
        .replace(/<[^>]*>/g, '')
        .replace(/\n/g, ' ')
        .trim()
    })

    // First row is header
    if (isHeaderRow) {
      cells.forEach((cell, idx) => {
        const normalized = cell.toUpperCase()
        if (normalized.includes('PRODUCT')) columnIndices['name'] = idx
        if (normalized.includes('PRICE')) columnIndices['price'] = idx
        if (normalized.includes('HSN')) columnIndices['hsn'] = idx
        if (normalized.includes('GST')) columnIndices['gst'] = idx
        if (normalized.includes('PKG')) columnIndices['packing'] = idx
      })
      isHeaderRow = false
      continue
    }

    // Skip empty rows
    if (cells.length === 0 || !cells.some(c => c.trim())) continue

    // Extract pricing data
    const item: any = {}
    if (columnIndices['name'] !== undefined) item.name = cells[columnIndices['name']]?.trim() || ''
    if (columnIndices['price'] !== undefined) {
      const priceStr = cells[columnIndices['price']]?.trim() || '0'
      item.price = parseFloat(priceStr) || 0
    }
    if (columnIndices['hsn'] !== undefined) item.hsn = cells[columnIndices['hsn']]?.trim() || ''
    if (columnIndices['gst'] !== undefined) {
      item.gst = cells[columnIndices['gst']]?.trim().replace('%', '') || '0'
    }
    if (columnIndices['packing'] !== undefined) item.packing = cells[columnIndices['packing']]?.trim() || ''

    // Only add if we have required fields
    if (item.name && item.price && item.hsn && item.gst) {
      items.push(item)
    }
  }

  return items
}

function generateCSV(items: any[]): string {
  let csv = 'Item Name,HSN Code,Unit Price,GST %,Packing\n'

  items.forEach(item => {
    const itemName = item.name.includes(',') ? `"${item.name}"` : item.name
    csv += `${itemName},"${item.hsn}",${item.price},${item.gst},"${item.packing || ''}"\n`
  })

  return csv
}
