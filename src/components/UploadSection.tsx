'use client'

import { useState, useEffect } from 'react'
import { loadPriceLists, PriceList } from '@/lib/pricingStorage'

export default function PricingSelector({ onPricingSelected }: any) {
  const [pricingLists, setPricingLists] = useState<PriceList[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load pricing lists from localStorage
    const lists = loadPriceLists()
    setPricingLists(lists)

    // Pre-select active lists
    const activeLists = lists.filter(l => l.active).map(l => l.id)
    setSelectedListIds(activeLists)

    // Notify parent of selected lists
    if (activeLists.length > 0) {
      onPricingSelected(activeLists)
    }

    setLoading(false)
  }, [])

  const handleToggleList = (listId: string) => {
    const updated = selectedListIds.includes(listId)
      ? selectedListIds.filter(id => id !== listId)
      : [...selectedListIds, listId]

    setSelectedListIds(updated)
    onPricingSelected(updated)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600">Loading pricing lists...</p>
      </div>
    )
  }

  if (pricingLists.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">📊 Select Pricing Source</h3>
        <p className="text-gray-600">No pricing lists available. Please upload one in the Admin Panel.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">📊 Select Pricing Lists</h3>
      <p className="text-sm text-gray-600 mb-4">Select one or more pricing lists to use for creating quotes:</p>

      <div className="space-y-3">
        {pricingLists.map((list) => (
          <label key={list.id} className="flex items-start p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedListIds.includes(list.id)}
              onChange={() => handleToggleList(list.id)}
              className="w-4 h-4 mt-0.5 rounded"
            />
            <div className="ml-3 flex-1">
              <p className="font-medium text-gray-900">{list.name}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {list.supplier} • {list.itemCount} items
              </p>
              {list.columns && list.columns.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Columns: {list.columns.join(', ')}
                </p>
              )}
            </div>
            {selectedListIds.includes(list.id) && (
              <span className="text-blue-600 font-bold ml-2">✓</span>
            )}
          </label>
        ))}
      </div>

      {selectedListIds.length === 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">⚠️ Select at least one pricing list to create quotes</p>
        </div>
      )}
    </div>
  )
}
