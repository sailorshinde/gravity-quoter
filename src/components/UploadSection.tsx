'use client'

import { useState, useEffect } from 'react'

interface PricingSource {
  id: string
  name: string
  description: string
  itemCount?: number
}

export default function PricingSelector({ onPricingSelected }: any) {
  const [pricingSources, setPricingSources] = useState<PricingSource[]>([])
  const [selectedPricing, setSelectedPricing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load available pricing sources
    const sources: PricingSource[] = [
      {
        id: 'gravity-lab-chem',
        name: 'Gravity Lab Chemicals',
        description: 'Accredited ISO 9001:2008 Certified Chemical Supplier - 694 items',
        itemCount: 694
      },
      // Additional pricing sources can be added here
    ]
    setPricingSources(sources)
    setLoading(false)
  }, [])

  const handleSelectPricing = (sourceId: string) => {
    setSelectedPricing(sourceId)
    onPricingSelected({
      id: sourceId,
      name: pricingSources.find(s => s.id === sourceId)?.name
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">📊 Select Pricing Source</h3>

      {loading ? (
        <p className="text-gray-600">Loading pricing sources...</p>
      ) : (
        <div className="space-y-3">
          {pricingSources.map((source) => (
            <button
              key={source.id}
              onClick={() => handleSelectPricing(source.id)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedPricing === source.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{source.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{source.description}</p>
                </div>
                {selectedPricing === source.id && (
                  <span className="text-blue-600 font-bold">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
