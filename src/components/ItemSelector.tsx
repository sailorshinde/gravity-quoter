'use client'

import { useState, useMemo } from 'react'
import { loadPriceLists, searchItems, PriceItem, MatchResult } from '@/lib/pricingStorage'

interface ItemSelectorProps {
  selectedListIds: string[]
  onItemSelect: (item: PriceItem, listId: string, quantity: number) => void
}

export default function ItemSelector({ selectedListIds, onItemSelect }: ItemSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [showSelector, setShowSelector] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<{ [key: string]: string }>({})

  console.log('[ItemSelector] Received selectedListIds:', selectedListIds)

  const searchResults = useMemo(() => {
    if (!searchTerm || selectedListIds.length === 0) {
      console.log('[ItemSelector] Skipping search - searchTerm:', searchTerm, 'listIds:', selectedListIds)
      return []
    }
    console.log('[ItemSelector] Searching for:', searchTerm, 'in lists:', selectedListIds)
    const results = searchItems(searchTerm, selectedListIds)
    console.log('[ItemSelector] Search results:', results.length, results.slice(0, 3))
    return results
  }, [searchTerm, selectedListIds])

  // Group results by item name to detect conflicts
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: MatchResult[] } = {}

    searchResults.forEach(result => {
      const key = result.item.name.toLowerCase()
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(result)
    })

    return Object.entries(groups).map(([name, matches]) => ({
      itemName: name,
      matches,
      hasConflict: matches.length > 1
    }))
  }, [searchResults])

  const handleSelectItem = (item: PriceItem, listId: string, matchedItems: MatchResult[]) => {
    // If there's a conflict, resolve it
    if (matchedItems.length > 1) {
      const selected = conflictResolution[item.name]
      if (!selected) {
        alert('Please select which pricing list to use for this item (see conflicts above)')
        return
      }
      listId = selected
    }

    onItemSelect(item, listId, selectedQuantity)
    setSearchTerm('')
    setSelectedQuantity(1)
    setShowSelector(false)
  }

  const handleConflictResolution = (itemName: string, listId: string) => {
    setConflictResolution(prev => ({
      ...prev,
      [itemName]: listId
    }))
  }

  if (selectedListIds.length === 0) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">⚠️ Please select at least one pricing list in the sidebar to add items</p>
      </div>
    )
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
        <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 space-y-4">
          {/* Search input */}
          <div>
            <input
              type="text"
              placeholder="Search by item name or HSN code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <p className="text-xs text-gray-600 mt-1">
              {searchTerm ? `Found ${searchResults.length} matches` : 'Start typing to search'}
            </p>
          </div>

          {/* Results */}
          {searchTerm && (
            <>
              {groupedResults.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-gray-600">
                  No items found. Try a different search.
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {groupedResults.map((group, idx) => (
                    <div key={idx} className="border-b border-gray-200 last:border-b-0">
                      {/* Conflict warning */}
                      {group.hasConflict && (
                        <div className="bg-yellow-50 border-b border-yellow-200 p-3">
                          <p className="text-xs font-semibold text-yellow-800 mb-2">⚠️ Item found in multiple pricing lists:</p>
                          <div className="space-y-2">
                            {group.matches.map((match) => (
                              <label key={match.listId} className="flex items-center text-xs">
                                <input
                                  type="radio"
                                  name={`conflict-${group.itemName}`}
                                  value={match.listId}
                                  checked={conflictResolution[group.itemName] === match.listId}
                                  onChange={() => handleConflictResolution(group.itemName, match.listId)}
                                  className="mr-2"
                                />
                                <span className="text-gray-900">{match.listName}: ₹{match.item.price}</span>
                                <span className="ml-auto text-gray-600">({Math.round(match.confidence * 100)}% match)</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Item results */}
                      {group.matches.map((match) => (
                        <div
                          key={`${match.listId}-${match.item.name}`}
                          className="px-4 py-3 hover:bg-gray-50 transition-all"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 text-sm">{match.item.name}</p>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {Math.round(match.confidence * 100)}% match
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                Source: <span className="font-medium">{match.listName}</span>
                              </p>
                              <p className="text-xs text-gray-600">
                                HSN: {match.item.hsn} | GST: {match.item.gst} | Packing: {match.item.packing || '-'}
                              </p>
                            </div>
                            <p className="font-bold text-gray-900 text-sm">₹{match.item.price}</p>
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
                              onClick={() => handleSelectItem(match.item, match.listId, group.matches)}
                              disabled={group.hasConflict && !conflictResolution[group.itemName]}
                              className={`flex-1 px-3 py-1 rounded text-sm font-medium transition-all ${
                                group.hasConflict && !conflictResolution[group.itemName]
                                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              Add to Quote
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Close button */}
          <button
            onClick={() => setShowSelector(false)}
            className="w-full px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium"
          >
            Close Selector
          </button>
        </div>
      )}
    </div>
  )
}
