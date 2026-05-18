import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api'

export const WALK_IN = '__walkin__'

export default function CustomerPicker({ value, onChange, compact = false }) {
  const { customerPick, walkInName } = value
  const isWalkIn = customerPick === WALK_IN

  const [mode, setMode] = useState(isWalkIn ? 'walkin' : 'registered')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const wrapRef = useRef(null)

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

  const inputClass = compact
    ? 'w-full rounded-lg border p-2 text-base'
    : 'w-full rounded-lg border p-2.5 text-base'

  const showList = mode === 'registered' && listOpen && !selected

  return (
    <div ref={wrapRef} className="space-y-2 sm:col-span-2">
      <span className="mb-1 block font-medium text-slate-600">Customer</span>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={pickWalkIn}
          className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
            mode === 'walkin'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Walk-in
        </button>
        <button
          type="button"
          onClick={pickRegistered}
          className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
            mode === 'registered'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Registered
        </button>
      </div>

      {mode === 'walkin' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Name *</span>
          <input
            className={inputClass}
            value={walkInName}
            onChange={(e) => onChange({ customerPick: WALK_IN, walkInName: e.target.value })}
            placeholder="Customer name"
            required
          />
        </label>
      ) : (
        <div className="relative">
          {selected ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{selected.name}</p>
                {selected.phone && (
                  <p className="truncate text-sm text-slate-600">{selected.phone}</p>
                )}
              </div>
              <button
                type="button"
                onClick={clearRegistered}
                className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:bg-white"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
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
                <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {searching && (
                    <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
                  )}
                  {!searching && results.length === 0 && (
                    <li className="px-3 py-2 text-sm text-slate-500">
                      {search.trim() ? 'No customers found' : 'Type to search or pick below'}
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
                            <span className="mt-0.5 block text-slate-500">{c.phone}</span>
                          )}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
