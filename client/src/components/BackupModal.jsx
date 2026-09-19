import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'

export default function BackupModal({ open, onClose }) {
  const [downloading, setDownloading] = useState(false)
  const [creatingLocal, setCreatingLocal] = useState(false)
  const [lastLocalPath, setLastLocalPath] = useState(null)

  if (!open) return null

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/backup/download', { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      a.href = url
      a.download = `BappiStores-Backup-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Database backup downloaded successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to download backup')
    } finally {
      setDownloading(false)
    }
  }

  const handleCreateLocal = async () => {
    setCreatingLocal(true)
    try {
      const res = await api.post('/backup/local')
      setLastLocalPath(res.data.path)
      toast.success('Local backup saved in Backups/ folder')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to create local backup')
    } finally {
      setCreatingLocal(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Database Backup</h3>
            <p className="text-sm text-slate-500">
              Save a safe copy of sales, products, debts, and store data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-emerald-950">1. Download to PC or Flash Drive</h4>
                <p className="mt-0.5 text-xs text-emerald-800">
                  Exports all store data into a single portable backup file.
                </p>
              </div>
              <button
                type="button"
                disabled={downloading}
                onClick={handleDownload}
                className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
              >
                {downloading ? 'Exporting…' : '⬇ Download .json'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sky-950">2. Save in Local Backups Folder</h4>
                <p className="mt-0.5 text-xs text-sky-800">
                  Creates a timestamped snapshot inside the app directory.
                </p>
              </div>
              <button
                type="button"
                disabled={creatingLocal}
                onClick={handleCreateLocal}
                className="shrink-0 rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-sky-800 disabled:opacity-50"
              >
                {creatingLocal ? 'Saving…' : '💾 Snapshot Folder'}
              </button>
            </div>
            {lastLocalPath && (
              <p className="mt-2 text-[11px] font-mono text-sky-900 break-all">
                Saved: {lastLocalPath}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">💡 Pro Tip for Shop Owners:</span>
            <p className="mt-1">
              Insert a USB flash drive, click <strong>Download .json</strong>, and save it directly
              to your flash drive once a week. This ensures your sales and credit records are always
              safe even if your computer experiences hardware trouble.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
