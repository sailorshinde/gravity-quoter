'use client'

import { useState } from 'react'
import PricingSelector from '@/components/UploadSection'
import RequirementsUploader from '@/components/RequirementsUploader'
import QuoteGenerator from '@/components/QuoteGenerator'
import ExportOptions from '@/components/ExportOptions'

export default function Home() {
  const [selectedPricingListIds, setSelectedPricingListIds] = useState<string[]>([])
  const [generatedQuote, setGeneratedQuote] = useState<any>(null)
  const [preloadedItems, setPreloadedItems] = useState<any[]>([])
  const [preloadedClientName, setPreloadedClientName] = useState<string>('')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gravity Lab Quoter</h1>
            <p className="text-gray-600 mt-2">AI-powered intelligent quotation generator</p>
          </div>
          <a href="/admin" className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300">
            ⚙️ Admin Panel
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <PricingSelector onPricingSelected={setSelectedPricingListIds} />
            {selectedPricingListIds.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Active Pricing Lists</h3>
                <p className="text-sm text-gray-700">
                  <span className="w-2 h-2 bg-green-500 rounded-full inline-block mr-2"></span>
                  {selectedPricingListIds.length} list{selectedPricingListIds.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}

            <RequirementsUploader
              onRequirementsLoaded={(data: any) => {
                setPreloadedItems(data.items || data)
                if (data.clientName) setPreloadedClientName(data.clientName)
              }}
            />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <QuoteGenerator
              selectedListIds={selectedPricingListIds}
              preloadedItems={preloadedItems}
              preloadedClientName={preloadedClientName}
              onQuoteGenerated={setGeneratedQuote}
            />
            {generatedQuote && (
              <ExportOptions quote={generatedQuote} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
