import { useEffect, useState } from 'react'

export default function PasswordDeleteDialog({
  open,
  title = 'Confirm delete',
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setPassword('')
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!password.trim() || busy) return
    setBusy(true)
    try {
      await onConfirm(password)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onCancel}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Manager password</span>
          <input
            type="password"
            autoComplete="off"
            className="w-full rounded-lg border border-slate-200 p-2.5 text-base focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
          />
        </label>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="flex-1 rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
