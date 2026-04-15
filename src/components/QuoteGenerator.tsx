'use client'

import { useState, useEffect } from 'react'
import ItemSelector from './ItemSelector'

interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  discount?: number // Discount percentage
  gst?: number // GST percentage
  hsn?: string // HSN code
  notes?: string
  packing?: string
  isUnmatched?: boolean
}

export default function QuoteGenerator({ selectedListIds = [], preloadedItems = [], preloadedClientName = '', onQuoteGenerated }: any) {
  const [clientName, setClientName] = useState(preloadedClientName)
  const [items, setItems] = useState<QuoteItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ])
  const [loading, setLoading] = useState(false)
  const [showUnmatchedWarning, setShowUnmatchedWarning] = useState(false)
  const [bulkGst, setBulkGst] = useState<number | ''>('')
  const [bulkDiscount, setBulkDiscount] = useState<number | ''>('')
  const [showBulkApply, setShowBulkApply] = useState(false)

  // Update items and client name when preloaded data changes
  useEffect(() => {
    if (preloadedClientName) {
      setClientName(preloadedClientName)
    }
    if (preloadedItems.length > 0) {
      setItems(preloadedItems)
    }
  }, [preloadedItems, preloadedClientName])

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

  const applyBulkGstAndDiscount = () => {
    const newItems = items.map(item => ({
      ...item,
      gst: bulkGst !== '' ? Number(bulkGst) : item.gst,
      discount: bulkDiscount !== '' ? Number(bulkDiscount) : item.discount,
    }))
    setItems(newItems)
    setShowBulkApply(false)
    setBulkGst('')
    setBulkDiscount('')
  }

  const generateQuote = async () => {
    if (!clientName) {
      alert('Please enter client name')
      return
    }

    if (items.some(i => !i.description)) {
      alert('Please fill in all item descriptions')
      return
    }

    // Check for unpriced items (price = 0)
    const unpricedItems = items.filter(i => i.unitPrice === 0 && i.description)
    if (unpricedItems.length > 0) {
      setShowUnmatchedWarning(true)
      if (!confirm(`${unpricedItems.length} items have no price set. Add prices before generating quote?\n\nCancel to edit prices, OK to continue.`)) {
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          items,
          selectedListIds: selectedListIds,
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
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Items</h3>
          <button
            onClick={() => setShowBulkApply(true)}
            className="text-sm px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium"
          >
            ⚙️ Apply GST & Discount to All
          </button>
        </div>

        {/* Bulk Apply Modal */}
        {showBulkApply && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Apply to All Items</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST % (optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={bulkGst}
                    onChange={(e) => setBulkGst(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="Leave empty to skip"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to keep current values</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount % (optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={bulkDiscount}
                    onChange={(e) => setBulkDiscount(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="Leave empty to skip"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to keep current values</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkApply(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={applyBulkGstAndDiscount}
                  disabled={bulkGst === '' && bulkDiscount === ''}
                  className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Apply to All Items
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Item Selector from Pricing Database */}
        <ItemSelector
          selectedListIds={selectedListIds}
          onItemSelect={(item, listId, quantity) => {
            const gstNumber = parseFloat(item.gst.replace('%', ''))
            setItems([...items, {
              description: `${item.name} (${item.packing})`,
              quantity,
              unitPrice: item.price,
              discount: 0,
              notes: `HSN: ${item.hsn}`,
              hsn: item.hsn,
              gst: gstNumber,
              packing: item.packing
            }])
          }}
        />

        {/* Manual Item Entry - Headers */}
        <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-bold text-gray-700 px-2">
          <div className="col-span-4">Item</div>
          <div className="col-span-1">HSN</div>
          <div className="col-span-1">Qty</div>
          <div className="col-span-2">Price</div>
          <div className="col-span-1">GST%</div>
          <div className="col-span-1">Disc%</div>
          <div className="col-span-1"></div>
        </div>

        {/* Manual Item Entry */}
        {items.map((item, i) => (
          <div key={i} className={`grid grid-cols-12 gap-2 items-end p-2 rounded ${item.isUnmatched ? 'bg-red-50 border border-red-200' : item.unitPrice === 0 && item.description ? 'bg-orange-50 border border-orange-200' : ''}`}>
            <div className="col-span-4 relative">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(i, 'description', e.target.value)}
                placeholder="Item description"
                className={`w-full px-2 py-2 border rounded text-sm ${item.isUnmatched ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              {item.isUnmatched && (
                <span className="absolute right-2 top-2 text-red-600 font-bold">⚠️</span>
              )}
            </div>
            <input
              type="text"
              value={item.hsn || ''}
              onChange={(e) => updateItem(i, 'hsn', e.target.value)}
              placeholder="HSN"
              className="col-span-1 px-2 py-2 border border-gray-300 rounded text-sm text-center"
            />
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', +e.target.value)}
              className="col-span-1 px-2 py-2 border border-gray-300 rounded text-sm text-center"
              placeholder="Qty"
            />
            <input
              type="number"
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => updateItem(i, 'unitPrice', +e.target.value)}
              className={`col-span-2 px-2 py-2 border rounded text-sm text-center ${item.unitPrice === 0 && item.description ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`}
              placeholder="Price"
            />
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={item.gst || 18}
              onChange={(e) => updateItem(i, 'gst', +e.target.value)}
              className="col-span-1 px-2 py-2 border border-green-300 rounded text-sm text-center bg-green-50 font-semibold"
              placeholder="GST%"
              title="GST percentage"
            />
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={item.discount || 0}
              onChange={(e) => updateItem(i, 'discount', +e.target.value)}
              className="col-span-1 px-2 py-2 border border-blue-300 rounded text-sm text-center bg-blue-50 font-semibold"
              placeholder="Disc%"
              title="Discount %"
            />
            <button
              onClick={() => removeItem(i)}
              className="col-span-1 text-red-600 hover:text-red-800 text-sm font-medium text-center"
            >
              ✕
            </button>
            {item.isUnmatched && (
              <div className="col-span-12 text-xs text-red-600 font-semibold">
                ⚠️ UNMATCHED ITEM - Please verify price and details before finalizing
              </div>
            )}
            {!item.isUnmatched && item.unitPrice === 0 && item.description && (
              <div className="col-span-12 text-xs text-orange-600">
                ⚠️ Price needed for this item
              </div>
            )}
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
