'use client'

import { useState, useEffect } from 'react'
import ItemSelector from './ItemSelector'
import { gravityLabItems } from '@/data/gravityLabPricingData'

interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  notes?: string
  hsn?: string
  gst?: string
  packing?: string
}

export default function QuoteGenerator({ pricingSource, onQuoteGenerated }: any) {
  const [clientName, setClientName] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ])
  const [loading, setLoading] = useState(false)

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])
  }

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const generateQuote = async () => {
    if (!clientName || items.some(i => !i.description)) {
      alert('Please fill in client name and all item descriptions')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          items,
          pricingSourceId: pricingSource?.id || 'gravity-lab-chem',
        }),
      })
      const quote = await res.json()
      onQuoteGenerated(quote)
    } catch (err) {
      console.error('Generation failed:', err)
      alert('Quote generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Create quote</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Client name
        </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          placeholder="e.g., ABC Lab Services"
        />
      </div>

      <div className="space-y-4 mb-6">
        <h3 className="font-semibold text-gray-900">Items</h3>

        {/* Item Selector from Pricing Database */}
        <ItemSelector
          items={gravityLabItems}
          onItemSelect={(item, quantity) => {
            setItems([...items, {
              description: `${item.name} (${item.packing})`,
              quantity,
              unitPrice: item.price,
              notes: `HSN: ${item.hsn}`,
              hsn: item.hsn,
              gst: item.gst,
              packing: item.packing
            }])
          }}
        />

        {/* Manual Item Entry */}
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-3 items-end">
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              placeholder="Item description"
              className="col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', +e.target.value)}
              className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Qty"
            />
            <input
              type="number"
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => updateItem(i, 'unitPrice', +e.target.value)}
              className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Price"
            />
            <button
              onClick={() => removeItem(i)}
              className="col-span-1 text-red-600 hover:text-red-800 text-sm font-medium"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={addItem}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          + Add item manually
        </button>
      </div>

      <button
        onClick={generateQuote}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Generating...' : 'Generate quote'}
      </button>
    </div>
  )
}
