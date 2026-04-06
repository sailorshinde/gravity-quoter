import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const { quote, subtotal, tax, total } = await request.json()

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([])

    let row = 0

    // Header
    XLSX.utils.sheet_add_aoa(ws, [['QUOTATION']], { origin: row })
    row++

    // Client info
    XLSX.utils.sheet_add_aoa(ws, [['Client:', quote.clientName]], { origin: row })
    row++
    XLSX.utils.sheet_add_aoa(ws, [['Date:', new Date().toLocaleDateString()]], { origin: row })
    row += 2

    // Table headers
    const headers = ['Sr. No.', 'Description', 'HSN Code', 'Qty', 'Unit Price', 'GST%', 'Discount%', 'Total']
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: row })
    row++

    // Items
    quote.items.forEach((item: any, index: number) => {
      const unitPrice = item.unitPrice || 0
      const quantity = item.quantity || 0
      const discount = item.discount || 0
      const gst = item.gst || 18

      const discountAmount = unitPrice * quantity * (discount / 100)
      const priceAfterDiscount = unitPrice * quantity - discountAmount
      const gstAmount = priceAfterDiscount * (gst / 100)
      const itemTotal = priceAfterDiscount + gstAmount

      XLSX.utils.sheet_add_aoa(ws, [[
        index + 1,
        item.description,
        item.hsn || 'N/A',
        quantity,
        unitPrice,
        gst,
        discount,
        itemTotal
      ]], { origin: row })
      row++
    })

    row += 1

    // Totals section
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', '', '', 'Subtotal:', subtotal]], { origin: row })
    row++
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', '', '', 'Tax (Avg):', tax]], { origin: row })
    row++
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', '', '', 'Grand Total:', total]], { origin: row })

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // Sr. No
      { wch: 30 },  // Description
      { wch: 10 },  // HSN
      { wch: 8 },   // Qty
      { wch: 12 },  // Unit Price
      { wch: 8 },   // GST%
      { wch: 10 },  // Discount%
      { wch: 12 }   // Total
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Quote')

    // Generate buffer
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })

    // Return as downloadable file
    return new NextResponse(wbout, {
      headers: {
        'Content-Disposition': `attachment; filename="quotation-${quote.clientName}-${Date.now()}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
