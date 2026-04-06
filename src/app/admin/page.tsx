'use client'

import { useState } from 'react'

interface PriceList {
  id: string
  name: string
  supplier: string
  itemCount: number
  uploadedDate: string
  active: boolean
}

export default function AdminPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([
    {
      id: 'gravity-lab-chem',
      name: 'Gravity Lab Chemicals',
      supplier: 'Gravity Lab',
      itemCount: 694,
      uploadedDate: '2026-04-06',
      active: true
    }
  ])
  const [uploading, setUploading] = useState(false)
  const [selectedLists, setSelectedLists] = useState<string[]>(['gravity-lab-chem'])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // In production, this would upload to an API endpoint
      // For now, we'll just show a demo
      const newList: PriceList = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        supplier: 'Custom Upload',
        itemCount: 0,
        uploadedDate: new Date().toLocaleDateString(),
        active: false
      }
      setPriceLists([...priceLists, newList])
      alert('Price list uploaded successfully! (Demo mode)')
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
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
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-2">Manage pricing files and quotation settings</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-8">
              <label className="cursor-pointer block">
                <div className="text-center">
                  <p className="text-4xl mb-2">📁</p>
                  <p className="font-semibold text-gray-900">Upload Price List</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Excel or CSV file
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </div>
              </label>
              {uploading && <p className="text-center mt-4 text-blue-600">Uploading...</p>}
            </div>

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
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedLists.includes(list.id)}
                          onChange={() => handleToggle(list.id)}
                          className="w-4 h-4 rounded"
                          disabled={list.id === 'gravity-lab-chem'}
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{list.name}</p>
                          <p className="text-sm text-gray-600">
                            {list.supplier} • {list.itemCount} items • Updated: {list.uploadedDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLists.includes(list.id) && (
                          <span className="text-green-600 font-semibold">Active ✓</span>
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
