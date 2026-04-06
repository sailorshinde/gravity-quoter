'use client'

import { useState, useMemo } from 'react'

interface Item {
  sr: number
  name: string
  hsn: string
  gst: string
  packing: string
  price: number
}

interface ItemSelectorProps {
  items: Item[]
  onItemSelect: (item: Item, quantity: number) => void
  selectedItems?: Item[]
}

export default function ItemSelector({ items, onItemSelect, selectedItems = [] }: ItemSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showSelector, setShowSelector] = useState(false)

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.hsn.includes(searchTerm)
      return matchesSearch
    })
  }, [searchTerm, items])

  const handleSelectItem = (item: Item) => {
    onItemSelect(item, selectedQuantity)
    setSearchTerm('')
    setSelectedQuantity(1)
    setShowSelector(false)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-300 rounded-lg text-blue-700 font-semibold hover:bg-blue-100 transition-all"
      >
        + Select from Pricing Database
      </button>

      {showSelector && (
        <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
          <div className="space-y-4">
            {/* Search input */}
            <div>
              <input
                type="text"
                placeholder="Search by item name or HSN code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Found {filteredItems.length} items
              </p>
            </div>

            {/* Results */}
            <div className="bg-white rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-gray-600">
                  No items found. Try a different search.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.sr}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all last:border-b-0"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          HSN: {item.hsn} | GST: {item.gst} | Packing: {item.packing}
                        </p>
                      </div>
                      <p className="font-bold text-gray-900">₹{item.price}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="1"
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => handleSelectItem(item)}
                        className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                      >
                        Add to Quote
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowSelector(false)}
              className="w-full px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
            >
              Close Selector
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
