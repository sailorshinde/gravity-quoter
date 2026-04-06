'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { gravityLabItems } from '@/data/gravityLabPricingData'

interface RequirementItem {
  sno: number
  itemDescription: string
  specification: string
  qty: number
  uom: string
  brand: string
  matched?: boolean
  matchedItem?: typeof gravityLabItems[0] | null
  matchScore?: number
}

export default function RequirementsUploader({ onRequirementsLoaded }: any) {
  const [loading, setLoading] = useState(false)
  const [requirements, setRequirements] = useState<RequirementItem[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [matchedCount, setMatchedCount] = useState(0)

  // Fuzzy string matching function
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()

    // Exact match
    if (s1 === s2) return 100

    // Contains match
    if (s1.includes(s2) || s2.includes(s1)) return 85

    // Check for key words
    const words1 = s1.split(/\s+/)
    const words2 = s2.split(/\s+/)
    const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)))

    if (commonWords.length > 0) {
      return 50 + (commonWords.length / Math.max(words1.length, words2.length)) * 50
    }

    return 0
  }

  // Match requirement items with pricing database
  const matchRequirements = (items: RequirementItem[]): RequirementItem[] => {
    return items
      .filter(req => req.itemDescription && req.itemDescription.trim()) // Filter empty items first
      .map(req => {
        let bestMatch = null
        let bestScore = 0

        // Try to match with each item in pricing database
        gravityLabItems.forEach(pricingItem => {
          const score = calculateSimilarity(req.itemDescription, pricingItem.name)

          if (score > bestScore) {
            bestScore = score
            bestMatch = pricingItem
          }
        })

        return {
          ...req,
          matched: bestScore >= 60, // 60% match threshold
          matchedItem: bestMatch,
          matchScore: bestScore,
        }
      })
  }

  // Parse Excel file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        // Skip header row and parse data
        const parsedItems: RequirementItem[] = jsonData.slice(1).map((row, idx) => ({
          sno: row[0] || idx + 1,
          itemDescription: row[1] || '',
          specification: row[2] || '',
          qty: parseInt(row[3]) || 0,
          uom: row[4] || '',
          brand: row[5] || '',
        }))

        // Match items with pricing database
        const matchedRequirements = matchRequirements(parsedItems)
        const matched = matchedRequirements.filter(r => r.matched).length

        setRequirements(matchedRequirements)
        setMatchedCount(matched)
        setShowPreview(true)
      }

      reader.readAsArrayBuffer(file)
    } catch (err) {
      console.error('File upload failed:', err)
      alert('Failed to parse Excel file. Please check the format.')
    } finally {
      setLoading(false)
    }
  }

  // Add all items (matched + unmatched) to quote, but only if they have a description
  const addToQuote = () => {
    const quoteItems = requirements
      .filter(r => r.itemDescription && r.itemDescription.trim()) // Only include items with descriptions
      .map(r => {
        const gstString = r.matched && r.matchedItem ? r.matchedItem.gst : '18%'
        const gstNumber = parseFloat(gstString.replace('%', ''))

        return {
          description: `${r.itemDescription} (${r.uom})`,
          quantity: r.qty,
          unitPrice: r.matched && r.matchedItem ? r.matchedItem.price : 0, // 0 for unmatched, user can edit
          notes: `Brand: ${r.brand || 'Not specified'} | Spec: ${r.specification}${!r.matched ? ' | ⚠️ UNMATCHED - needs price lookup' : ''}`,
          hsn: r.matched && r.matchedItem ? r.matchedItem.hsn : '',
          gst: gstNumber,
          packing: r.matched && r.matchedItem ? r.matchedItem.packing : r.uom,
          isUnmatched: !r.matched, // Flag to highlight unmatched items in quote
        }
      })

    onRequirementsLoaded({
      items: quoteItems,
      clientName: extractClientName(), // Pass extracted client name
    })
    setShowPreview(false)
    setRequirements([])
  }

  // Extract client name from Excel (check common positions)
  const extractClientName = (): string => {
    // Common patterns for client name in Excel:
    // 1. In the first few rows, looking for patterns like "Client:" or "School:"
    // 2. In a specific cell before the data starts
    // For now, return empty - user can manually enter if not found
    // This can be enhanced based on specific Excel formats
    return ''
  }

  return (
    <div className="space-y-4">
      {!showPreview ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-8">
          <label className="cursor-pointer block">
            <div className="text-center">
              <p className="text-4xl mb-2">📋</p>
              <p className="font-semibold text-gray-900">Upload Requirements File</p>
              <p className="text-sm text-gray-600 mt-1">
                Excel file with Item Description, Qty, UOM, Brand
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
              />
            </div>
          </label>
          {loading && <p className="text-center mt-4 text-blue-600">Parsing file...</p>}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Requirements Matching Results</h3>
              <p className="text-sm text-gray-600">
                {matchedCount} of {requirements.length} items matched ({Math.round((matchedCount / requirements.length) * 100)}%)
              </p>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-600 hover:text-gray-900 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {requirements.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  item.matched
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {item.sno}. {item.itemDescription}
                    </p>
                    <p className="text-sm text-gray-600">
                      Qty: {item.qty} {item.uom} | Brand: {item.brand || 'Not specified'}
                    </p>
                    {item.specification && (
                      <p className="text-xs text-gray-500 mt-1">
                        Spec: {item.specification}
                      </p>
                    )}
                  </div>

                  {item.matched && item.matchedItem ? (
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-green-700">
                        ✓ Matched
                      </p>
                      <p className="text-xs text-gray-600">
                        {item.matchedItem.name}
                      </p>
                      <p className="text-sm font-bold text-gray-900 mt-1">
                        ₹{item.matchedItem.price}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.matchScore?.toFixed(0)}% match
                      </p>
                    </div>
                  ) : (
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-red-700">
                        ✗ Not matched
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        Manual lookup needed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={addToQuote}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              Add {matchedCount} Items to Quote
            </button>
            <button
              onClick={() => {
                setShowPreview(false)
                setRequirements([])
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          {matchedCount < requirements.length && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-semibold">⚠️ {requirements.length - matchedCount} items not matched</p>
              <p className="mt-1">You can add these items manually after importing the matched ones.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
