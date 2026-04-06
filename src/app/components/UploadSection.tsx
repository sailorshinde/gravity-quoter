'use client'

import { useState } from 'react'

export default function UploadSection({ onFilesUploaded }: any) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (!files) return

    setUploading(true)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (data.success) {
          onFilesUploaded((prev: any) => [...prev, data.file])
        }
      }
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8">
      <label className="cursor-pointer">
        <div className="text-center">
          <p className="text-4xl mb-2">📁</p>
          <p className="font-semibold text-gray-900">Upload pricing files</p>
          <p className="text-sm text-gray-600 mt-1">
            PDF, Excel, CSV, images of price lists
          </p>
          <input
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.gif"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </div>
      </label>
      {uploading && <p className="text-center mt-4 text-blue-600">Uploading...</p>}
    </div>
  )
}