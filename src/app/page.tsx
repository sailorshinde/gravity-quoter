'use client'

import { useState } from 'react'
import UploadSection from '@/components/UploadSection'
import QuoteGenerator from '@/components/QuoteGenerator'
import ExportOptions from '@/components/ExportOptions'

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [generatedQuote, setGeneratedQuote] = useState<any>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Gravity Lab Quoter</h1>
          <p className="text-gray-600 mt-2">AI-powered intelligent quotation generator</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <UploadSection onFilesUploaded={setUploadedFiles} />
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Active pricing files</h3>
              <ul className="space-y-2">
                {uploadedFiles.map(f => (
                  <li key={f.id} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    {f.filename}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <QuoteGenerator
              files={uploadedFiles}
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
