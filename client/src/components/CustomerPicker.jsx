import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api'

export const WALK_IN = '__walkin__'

function Field({ label, htmlFor, children, className = '' }) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium leading-5 text-slate-600"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

export default function CustomerPicker({
  value,
  onChange,
  note = '',
  onNoteChange,
  compact = false,
}) {
  const { customerPick, walkInName } = value
  const isWalkIn = customerPick === WALK_IN

  const [mode, setMode] = useState(isWalkIn ? 'walkin' : 'registered')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const wrapRef = useRef(null)

  const controlH = compact ? 'h-10' : 'h-11'
  const inputClass = `w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${controlH}`

  const syncSelected = useCallback(async () => {
    if (isWalkIn || !customerPick) {
      setSelected(null)
      return
    }
    const fromResults = results.find((c) => c._id === customerPick)
    if (fromResults) {
      setSelected(fromResults)
      return
    }
    try {
      const { data } = await api.get('/customers')
      const found = data.items.find((c) => c._id === customerPick)
      if (found) setSelected(found)
    } catch {
      setSelected(null)
    }
  }, [customerPick, isWalkIn, results])

  useEffect(() => {
    syncSelected()
  }, [syncSelected])

  useEffect(() => {
    if (isWalkIn) setMode('walkin')
    else if (customerPick && customerPick !== WALK_IN) setMode('registered')
  }, [customerPick, isWalkIn])

  useEffect(() => {
    if (mode !== 'registered') return undefined

    const q = search.trim()
    const timer = setTimeout(() => {
      setSearching(true)
      api
        .get('/customers', { params: q ? { q } : {} })
        .then((r) => setResults(r.data.items || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, q ? 250 : 0)

    return () => clearTimeout(timer)
  }, [search, mode])

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setListOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pickWalkIn() {
    setMode('walkin')
    setListOpen(false)
    setSearch('')
    onChange({ customerPick: WALK_IN, walkInName })
  }

  function pickRegistered() {
    setMode('registered')
    onChange({ customerPick: '', walkInName: '' })
    setSearch('')
    setListOpen(true)
  }

  function selectCustomer(c) {
    setSelected(c)
    setSearch('')
    setListOpen(false)
    onChange({ customerPick: c._id, walkInName: '' })
  }

  function clearRegistered() {
    setSelected(null)
    setSearch('')
    onChange({ customerPick: '', walkInName: '' })
    setListOpen(true)
  }

  const showList = mode === 'registered' && listOpen && !selected
  const searchId = 'sale-customer-search'
  const walkInId = 'sale-walkin-name'
  const noteId = 'sale-note'

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold text-slate-800">Customer</span>
        <div
          className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-0.5 sm:w-auto sm:min-w-[220px]"
          role="group"
          aria-label="Customer type"
        >
          <button
            type="button"
            onClick={pickRegistered}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
              mode === 'registered'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Registered
          </button>
          <button
            type="button"
            onClick={pickWalkIn}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
              mode === 'walkin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Walk-in
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        {mode === 'walkin' ? (
          <Field label="Customer name *" htmlFor={walkInId}>
            <input
              id={walkInId}
              className={inputClass}
              value={walkInName}
              onChange={(e) => onChange({ customerPick: WALK_IN, walkInName: e.target.value })}
              placeholder="Enter name"
              required
            />
          </Field>
        ) : (
          <Field label="Find customer" htmlFor={selected ? undefined : searchId}>
            <div className="relative">
              {selected ? (
                <div
                  className={`flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 ${controlH}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {selected.name}
                    </p>
                    {selected.phone && (
                      <p className="truncate text-xs text-slate-600">{selected.phone}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearRegistered}
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id={searchId}
                    type="search"
                    className={inputClass}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setListOpen(true)
                    }}
                    onFocus={() => setListOpen(true)}
                    placeholder="Search name or phone…"
                    autoComplete="off"
                  />
                  {showList && (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {searching && (
                        <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
                      )}
                      {!searching && results.length === 0 && (
                        <li className="px-3 py-2 text-sm text-slate-500">
                          {search.trim() ? 'No customers found' : 'Type to search'}
                        </li>
                      )}
                      {!searching &&
                        results.map((c) => (
                          <li key={c._id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                              onClick={() => selectCustomer(c)}
                            >
                              <span className="font-medium text-slate-900">{c.name}</span>
                              {c.phone && (
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {c.phone}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </Field>
        )}

        {onNoteChange && (
          <Field label="Note" htmlFor={noteId}>
            <input
              id={noteId}
              className={inputClass}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        )}
      </div>
    </div>
  )
}
