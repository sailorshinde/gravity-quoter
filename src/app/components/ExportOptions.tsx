'use client'

import { useState } from 'react'

export default function ExportOptions({ quote }: any) {
  const [exporting, setExporting] = useState(false)

  const calculateTotals = () => {
    const subtotal = quote.items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unitPrice,
      0
    )
    const tax = subtotal * 0.09
    const total = subtotal + tax
    return { subtotal, tax, total }
  }

  const { subtotal, tax, total } = calculateTotals()

  const exportExcel = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote, subtotal, tax, total }),
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quote-${quote.clientName}-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote, subtotal, tax, total }),
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quote-${quote.clientName}-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Quote summary</h3>

      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-gray-700 font-semibold">Description</th>
              <th className="text-right py-2 text-gray-700 font-semibold">Qty</th>
              <th className="text-right py-2 text-gray-700 font-semibold">Unit price</th>
              <th className="text-right py-2 text-gray-700 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 text-gray-900">{item.description}</td>
                <td className="text-right text-gray-900">{item.quantity}</td>
                <td className="text-right text-gray-900">${item.unitPrice.toFixed(2)}</td>
                <td className="text-right text-gray-900">
                  ${(item.quantity * item.unitPrice).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 mb-6 text-right">
        <div className="text-gray-700">
          Subtotal: <span className="font-semibold">${subtotal.toFixed(2)}</span>
        </div>
        <div className="text-gray-700">
          Tax (9%): <span className="font-semibold">${tax.toFixed(2)}</span>
        </div>
        <div className="text-lg text-gray-900 pt-2 border-t border-gray-200">
          Grand total: <span className="font-bold">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
        >
          📊 Export Excel
        </button>
        <button
          onClick={exportPDF}
          disabled={exporting}
          className="bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400"
        >
          📄 Export PDF
        </button>
      </div>

      <button
        className="w-full mt-3 bg-blue-100 text-blue-600 py-2 rounded-lg font-semibold hover:bg-blue-200"
      >
        💾 Save to Google Drive
      </button>
    </div>
  )
}