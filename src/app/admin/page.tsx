'use client'

import { useState } from 'react'

interface PriceList {
  id: string
  name: string
  supplier: string
  itemCount: number
  uploadedDate: string
  active: boolean
  status: 'draft' | 'submitted'
}

interface DraftPricing {
  fileName: string
  csv: string
  preview: any[]
  itemCount: number
}

export default function AdminPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([
    {
      id: 'gravity-lab-chem',
      name: 'Gravity Lab Chemicals',
      supplier: 'Gravity Lab',
      itemCount: 694,
      uploadedDate: '2026-04-06',
      active: true,
      status: 'submitted'
    }
  ])
  const [draftPricing, setDraftPricing] = useState<DraftPricing | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedLists, setSelectedLists] = useState<string[]>(['gravity-lab-chem'])
  const [showCSVPreview, setShowCSVPreview] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      // Call API to extract pricing from PDF/file
      const res = await fetch('/api/extract-pricing', {
        method: 'POST',
        body: formData
      })

      const result = await res.json()

      if (result.success) {
        setDraftPricing({
          fileName: file.name,
          csv: result.csv,
          preview: result.preview,
          itemCount: result.itemCount
        })
        setShowCSVPreview(true)
      } else {
        alert(result.error || 'Failed to extract pricing')
      }
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed. Please check the file format.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitPricing = () => {
    if (!draftPricing) return

    const newList: PriceList = {
      id: `custom-${Date.now()}`,
      name: draftPricing.fileName.replace(/\.[^.]+$/, ''),
      supplier: 'Custom Upload',
      itemCount: draftPricing.itemCount,
      uploadedDate: new Date().toLocaleDateString(),
      active: false,
      status: 'submitted'
    }

    setPriceLists([...priceLists, newList])
    setDraftPricing(null)
    setShowCSVPreview(false)
    alert('Price list submitted and is now available in quotes!')
  }

  const handleDiscardDraft = () => {
    setDraftPricing(null)
    setShowCSVPreview(false)
    // Reset file input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    if (input) input.value = ''
  }

  const handleToggle = (id: string) => {
    setSelectedLists(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const handleDelete = (id: string) => {
    if (id === 'gravity-lab-chem') {
      alert('Cannot delete default price list')
      return
    }
    setPriceLists(priceLists.filter(p => p.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-2">Manage pricing files and quotation settings</p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 h-fit"
          >
            ← Back to Quoter
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            {!draftPricing ? (
              <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-8">
                <label className="cursor-pointer block">
                  <div className="text-center">
                    <p className="text-4xl mb-2">📄</p>
                    <p className="font-semibold text-gray-900">Upload Price List</p>
                    <p className="text-sm text-gray-600 mt-1">
                      PDF, Excel, CSV or TXT
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,.txt"
                      onChange={handleUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </div>
                </label>
                {uploading && <p className="text-center mt-4 text-blue-600">Processing file...</p>}
              </div>
            ) : (
              <div className="bg-yellow-50 rounded-lg border-2 border-yellow-300 p-6">
                <p className="font-semibold text-yellow-900 mb-2">⚠️ Draft in Review</p>
                <p className="text-sm text-yellow-800 mb-4">
                  {draftPricing.fileName} ({draftPricing.itemCount} items)
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowCSVPreview(true)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    Review CSV
                  </button>
                  <button
                    onClick={handleSubmitPricing}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                  >
                    Submit & Activate
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="w-full px-3 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {showCSVPreview && draftPricing && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-96 overflow-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">CSV Preview</h3>
                    <button
                      onClick={() => setShowCSVPreview(false)}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-4">Review the extracted pricing data below. Make sure all items and prices are correct before submitting.</p>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                      {draftPricing.csv}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          const element = document.createElement('a')
                          element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(draftPricing.csv))
                          element.setAttribute('download', `pricing-${draftPricing.fileName.replace(/\.[^.]+$/, '')}.csv`)
                          element.style.display = 'none'
                          document.body.appendChild(element)
                          element.click()
                          document.body.removeChild(element)
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                      >
                        ⬇️ Download CSV
                      </button>
                      <button
                        onClick={() => setShowCSVPreview(false)}
                        className="px-3 py-2 bg-gray-300 text-gray-900 rounded text-sm font-medium hover:bg-gray-400"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Instructions</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Upload Excel or CSV files</li>
                <li>✓ Requires columns: Item Name, HSN, Price, GST</li>
                <li>✓ First row should be headers</li>
                <li>✓ Supports batch uploads</li>
                <li>✓ Updates existing lists</li>
              </ul>
            </div>
          </div>

          {/* Price Lists Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Price Lists</h2>

              {priceLists.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No price lists uploaded yet</p>
              ) : (
                <div className="space-y-3">
                  {priceLists.map(list => (
                    <div
                      key={list.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${list.status === 'draft' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedLists.includes(list.id)}
                          onChange={() => handleToggle(list.id)}
                          className="w-4 h-4 rounded"
                          disabled={list.id === 'gravity-lab-chem' || list.status === 'draft'}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{list.name}</p>
                            <span className={`text-xs px-2 py-1 rounded ${list.status === 'draft' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>
                              {list.status === 'draft' ? 'DRAFT' : 'LIVE'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {list.supplier} • {list.itemCount} items • Updated: {list.uploadedDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLists.includes(list.id) && list.status === 'submitted' && (
                          <span className="text-green-600 font-semibold text-sm">Active ✓</span>
                        )}
                        {list.id !== 'gravity-lab-chem' && (
                          <button
                            onClick={() => handleDelete(list.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 hover:bg-red-50 rounded"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Active Price Lists:</strong> {selectedLists.length} selected. These will be available when creating quotes.
                </p>
              </div>
            </div>

            {/* Settings Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Quotation Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default GST Rate (%)
                  </label>
                  <input
                    type="number"
                    defaultValue="18"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-600 mt-1">Applied to items without a specific GST rate</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Currency
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option>INR (₹)</option>
                    <option>USD ($)</option>
                    <option>EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium text-gray-700">
                      Show product images in quotes
                    </span>
                  </label>
                  <p className="text-xs text-gray-600 mt-1">If enabled and images are available, they will appear in quotes</p>
                </div>

                <div>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium text-gray-700">
                      Allow discount editing in quotes
                    </span>
                  </label>
                  <p className="text-xs text-gray-600 mt-1">Users can adjust discounts for individual items</p>
                </div>
              </div>

              <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
