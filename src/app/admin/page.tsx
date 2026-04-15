'use client'

import { useState, useEffect } from 'react'
import { savePriceLists, loadPriceLists, deletePriceList, updatePriceList, PriceList, PriceItem } from '@/lib/pricingStorage'

interface DraftPricing {
  fileName: string
  csv: string
  preview: any[]
  itemCount: number
  items: PriceItem[]
}

export default function AdminPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [draftPricing, setDraftPricing] = useState<DraftPricing | null>(null)
  const [draftName, setDraftName] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [showCSVPreview, setShowCSVPreview] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Load pricing lists from localStorage on mount
  useEffect(() => {
    const lists = loadPriceLists()
    setPriceLists(lists)
    setSelectedLists(lists.filter(l => l.active).map(l => l.id))
    setMounted(true)
  }, [])

  // Save pricing lists to localStorage whenever they change
  useEffect(() => {
    if (mounted && priceLists.length > 0) {
      savePriceLists(priceLists)
    }
  }, [priceLists, mounted])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/extract-pricing', {
        method: 'POST',
        body: formData
      })

      const result = await res.json()

      if (result.success) {
        // Parse CSV to get items
        const items = parseCSVToItems(result.csv)

        // Extract columns from items
        const columns = extractColumns(items)

        setDraftPricing({
          fileName: file.name,
          csv: result.csv,
          preview: result.preview,
          itemCount: result.itemCount,
          items: items
        })
        setDraftName(file.name.replace(/\.[^.]+$/, ''))
        setShowCSVPreview(true)
        setEditingListId(null)
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

  const parseCSVToItems = (csv: string): PriceItem[] => {
    const lines = csv.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const items: PriceItem[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))

      const item: PriceItem = {
        name: values[headers.indexOf('item name')] || '',
        price: parseFloat(values[headers.indexOf('unit price')] || '0') || 0,
        hsn: values[headers.indexOf('hsn code')] || '',
        gst: values[headers.indexOf('gst %')] || '0',
        packing: values[headers.indexOf('packing')] || ''
      }

      if (item.name && item.price && item.hsn) {
        items.push(item)
      }
    }

    return items
  }

  const extractColumns = (items: PriceItem[]): string[] => {
    const columns = new Set<string>()
    columns.add('Item Name')
    columns.add('HSN Code')
    columns.add('Unit Price')
    columns.add('GST %')

    if (items.some(item => item.packing)) {
      columns.add('Packing')
    }

    return Array.from(columns)
  }

  const handleSubmitPricing = () => {
    if (!draftPricing || !draftName.trim()) {
      alert('Please enter a name for the price list')
      return
    }

    if (editingListId) {
      // Update existing list
      const updated: PriceList = {
        id: editingListId,
        name: draftName.trim(),
        supplier: 'Custom Upload',
        itemCount: draftPricing.itemCount,
        uploadedDate: new Date().toLocaleDateString(),
        active: selectedLists.includes(editingListId),
        status: 'submitted',
        items: draftPricing.items,
        columns: extractColumns(draftPricing.items)
      }

      setPriceLists(priceLists.map(l => l.id === editingListId ? updated : l))
      alert('Price list updated successfully!')
    } else {
      // Create new list
      const newList: PriceList = {
        id: `custom-${Date.now()}`,
        name: draftName.trim(),
        supplier: 'Custom Upload',
        itemCount: draftPricing.itemCount,
        uploadedDate: new Date().toLocaleDateString(),
        active: false,
        status: 'submitted',
        items: draftPricing.items,
        columns: extractColumns(draftPricing.items)
      }

      setPriceLists([...priceLists, newList])
      alert('Price list submitted and is now available in quotes!')
    }

    setDraftPricing(null)
    setDraftName('')
    setShowCSVPreview(false)
    setEditingListId(null)
  }

  const handleDiscardDraft = () => {
    setDraftPricing(null)
    setDraftName('')
    setShowCSVPreview(false)
    setEditingListId(null)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    if (input) input.value = ''
  }

  const handleToggle = (id: string) => {
    const updated = priceLists.map(list =>
      list.id === id ? { ...list, active: !list.active } : list
    )
    setPriceLists(updated)

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
    if (confirm('Are you sure you want to delete this price list?')) {
      setPriceLists(priceLists.filter(p => p.id !== id))
    }
  }

  const handleEditList = (list: PriceList) => {
    setEditingListId(list.id)
    setDraftPricing({
      fileName: `${list.name}.csv`,
      csv: generateCSV(list.items),
      preview: list.items.slice(0, 5),
      itemCount: list.items.length,
      items: list.items
    })
    setDraftName(list.name)
    setShowCSVPreview(true)
  }

  const generateCSV = (items: PriceItem[]): string => {
    let csv = 'Item Name,HSN Code,Unit Price,GST %,Packing\n'
    items.forEach(item => {
      const itemName = item.name.includes(',') ? `"${item.name}"` : item.name
      csv += `${itemName},"${item.hsn}",${item.price},${item.gst},"${item.packing || ''}"\n`
    })
    return csv
  }

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>
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
                    <p className="font-semibold text-gray-900">
                      {editingListId ? 'Update Price List' : 'Upload Price List'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      PDF, Excel, CSV, TXT, or JSON
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,.txt,.json"
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
                <p className="font-semibold text-yellow-900 mb-2">⚠️ {editingListId ? 'Update' : 'Draft'} in Review</p>
                <p className="text-sm text-yellow-800 mb-4">
                  {draftPricing.fileName} ({draftPricing.itemCount} items)
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-yellow-900 mb-2">
                    Price List Name
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Enter a custom name for this price list"
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowCSVPreview(true)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    Review Data
                  </button>
                  <button
                    onClick={handleSubmitPricing}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                  >
                    {editingListId ? 'Update & Save' : 'Submit & Activate'}
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
                    <h3 className="text-lg font-bold text-gray-900">Data Preview</h3>
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
                <li>✓ Upload PDF, Excel, CSV, TXT, or JSON files</li>
                <li>✓ For JSON: Export from Reducto with HTML table</li>
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
                          disabled={list.id === 'gravity-lab-chem' && list.status === 'draft'}
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
                          {list.columns && list.columns.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Columns: {list.columns.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLists.includes(list.id) && list.status === 'submitted' && (
                          <span className="text-green-600 font-semibold text-sm">Active ✓</span>
                        )}
                        {list.id !== 'gravity-lab-chem' && (
                          <>
                            <button
                              onClick={() => handleEditList(list)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 hover:bg-blue-50 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(list.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 hover:bg-red-50 rounded"
                            >
                              Delete
                            </button>
                          </>
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
          </div>
        </div>
      </main>
    </div>
  )
}
