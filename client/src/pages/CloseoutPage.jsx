import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import StoreLogo from '../components/StoreLogo'
import { STORE_ADDRESSES, STORE_NAME, STORE_PHONES } from '../constants'
import { formatDateOnly, formatNaira } from '../utils/format'

export default function CloseoutPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  // Closeout input form
  const [openingCash, setOpeningCash] = useState('0')
  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes] = useState('')

  // Optional Denomination Calculator
  const [showDenom, setShowDenom] = useState(false)
  const [denoms, setDenoms] = useState({
    1000: '',
    500: '',
    200: '',
    100: '',
    50: '',
  })

  // Printable slip state
  const [printableRecord, setPrintableRecord] = useState(null)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    try {
      const [resPreview, resHistory] = await Promise.all([
        api.get(`/closeout/preview?date=${selectedDate}`),
        api.get('/closeout/history'),
      ])
      setPreview(resPreview.data)
      setHistory(resHistory.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load closeout data')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  // Denomination calc
  const handleDenomChange = (val, count) => {
    const next = { ...denoms, [val]: count }
    setDenoms(next)
    const sum = Object.entries(next).reduce(
      (s, [denom, qty]) => s + Number(denom) * (Number(qty) || 0),
      0
    )
    setActualCash(String(sum))
  }

  const numOpening = Number(openingCash) || 0
  const numExpected = (preview?.expectedCash || 0) + numOpening
  const numActual = Number(actualCash) || 0
  const difference = actualCash === '' ? 0 : numActual - numExpected

  const handleSaveCloseout = async (e) => {
    e.preventDefault()
    if (actualCash === '') {
      return toast.error('Please enter the actual physical cash counted in drawer')
    }

    setSaving(true)
    try {
      const payload = {
        date: selectedDate,
        openingCash: numOpening,
        salesCash: preview?.salesCash || 0,
        debtPaymentsCash: preview?.debtPaymentsCash || 0,
        cashExpenses: preview?.cashExpenses || 0,
        cashBorrowed: preview?.cashBorrowed || 0,
        expectedCash: preview?.expectedCash || 0,
        actualCash: numActual,
        posTotal: preview?.posTotal || 0,
        transferTotal: preview?.transferTotal || 0,
        totalSales: preview?.totalSales || 0,
        notes,
      }
      const res = await api.post('/closeout', payload)
      toast.success('Shift closeout saved!')
      setPrintableRecord(res.data)
      loadPreview()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to save closeout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell
      scroll={false}
      header={
        <PageHeader
          title="End-of-Day Shift Closeout"
          subtitle="Cash drawer reconciliation (Z-Report) — balance physical cash against sales, debt payments & expenses"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Shift Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </PageHeader>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
          {/* Left / Main: Live Cash Drawer Balancing */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0 overflow-y-auto">
            {/* Live Register Flow Card */}
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-bold text-slate-900">Expected Register Cash Flow</h3>
                <span className="text-xs font-semibold text-slate-500">{formatDateOnly(selectedDate)}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Opening Cash Float (Morning Start):</span>
                  <span className="font-bold text-slate-900">+{formatNaira(numOpening)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Today&apos;s Cash Sales ({preview?.salesCount || 0} sales):</span>
                  <span className="font-bold text-emerald-800">+{formatNaira(preview?.salesCash || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Cash Credit Repayments Received:</span>
                  <span className="font-bold text-emerald-800">+{formatNaira(preview?.debtPaymentsCash || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Cash Expenses Paid Out (Fuel, Light, etc.):</span>
                  <span className="font-bold text-rose-700">-{formatNaira(preview?.cashExpenses || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Cash Borrowed / Withdrawn (IOUs):</span>
                  <span className="font-bold text-rose-700">-{formatNaira(preview?.cashBorrowed || 0)}</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-base font-bold text-slate-900">
                  <span>Expected Cash in Drawer:</span>
                  <span className="text-emerald-900">{formatNaira(numExpected)}</span>
                </div>
              </div>

              {/* Electronic Collections Bar */}
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div className="rounded-lg bg-sky-50 border border-sky-100 p-2 text-sky-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">POS Card Payments</span>
                  <span className="font-bold text-sm">{formatNaira(preview?.posTotal || 0)}</span>
                </div>
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-2 text-violet-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 block">Bank Transfers</span>
                  <span className="font-bold text-sm">{formatNaira(preview?.transferTotal || 0)}</span>
                </div>
              </div>
            </div>

            {/* Cash Count Entry Form */}
            <form onSubmit={handleSaveCloseout} className="glass-panel p-4 space-y-4">
              <h3 className="font-bold text-slate-900">Physical Cash Drawer Count</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Opening Float (₦)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 10000"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Physical Cash Counted (₦) *</span>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="Total cash physically counted"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold tabular-nums focus:border-emerald-500 focus:outline-none text-emerald-950"
                  />
                </label>
              </div>

              {/* Denomination Counter Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDenom(!showDenom)}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  {showDenom ? 'Hide Denomination Breakdown' : '🔢 Use Naira Notes Counter (₦1,000, ₦500, etc.)'}
                </button>

                {showDenom && (
                  <div className="mt-2.5 grid grid-cols-5 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    {[1000, 500, 200, 100, 50].map((d) => (
                      <label key={d} className="block text-center">
                        <span className="font-bold text-slate-700 block mb-1">₦{d}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={denoms[d]}
                          onChange={(e) => handleDenomChange(d, e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white p-1 text-center font-bold"
                        />
                        <span className="text-[10px] text-slate-500 block mt-0.5 tabular-nums">
                          {formatNaira((Number(denoms[d]) || 0) * d)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Difference Status Box */}
              {actualCash !== '' && (
                <div
                  className={`rounded-xl border p-4 text-center ${
                    difference === 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : difference < 0
                        ? 'border-rose-200 bg-rose-50 text-rose-900'
                        : 'border-sky-200 bg-sky-50 text-sky-900'
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider">
                    {difference === 0 ? '✓ Balanced Register' : difference < 0 ? '⚠ Cash Shortage' : 'ℹ Cash Overage'}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {difference === 0 ? 'Exact Match (₦0 Difference)' : `${difference > 0 ? '+' : ''}${formatNaira(difference)}`}
                  </p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Expected: {formatNaira(numExpected)} · Actual Counted: {formatNaira(numActual)}
                  </p>
                </div>
              )}

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Closeout Notes (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Closing shift with Aminu, generator refueled before close"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (actualCash === '') return toast.error('Enter counted cash first')
                    setPrintableRecord({
                      date: selectedDate,
                      openingCash: numOpening,
                      salesCash: preview?.salesCash || 0,
                      debtPaymentsCash: preview?.debtPaymentsCash || 0,
                      cashExpenses: preview?.cashExpenses || 0,
                      cashBorrowed: preview?.cashBorrowed || 0,
                      expectedCash: numExpected,
                      actualCash: numActual,
                      difference,
                      posTotal: preview?.posTotal || 0,
                      transferTotal: preview?.transferTotal || 0,
                      totalSales: preview?.totalSales || 0,
                      notes,
                      closedBy: 'Admin',
                    })
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  🖨 Preview Z-Report Slip
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : '✓ Save Shift Closeout'}
                </button>
              </div>
            </form>
          </div>

          {/* Right: Past Closeouts Archive */}
          <div className="lg:col-span-5 glass-panel flex min-h-0 flex-col overflow-hidden p-4">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
              Past Shift Closeout History
            </h3>

            {loading ? (
              <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
                Loading history…
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-slate-400 text-sm text-center p-4">
                No past closeout records saved yet.
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto space-y-2.5 pr-1">
                {history.map((h) => {
                  const isBalanced = (h.difference || 0) === 0
                  const isShort = (h.difference || 0) < 0

                  return (
                    <div
                      key={h._id}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{formatDateOnly(h.date)}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            isBalanced
                              ? 'bg-emerald-100 text-emerald-800'
                              : isShort
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {isBalanced ? 'Balanced' : `${h.difference > 0 ? '+' : ''}${formatNaira(h.difference)}`}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-1 text-slate-600">
                        <div>Sales: <span className="font-semibold text-slate-800">{formatNaira(h.totalSales)}</span></div>
                        <div>Counted Cash: <span className="font-semibold text-slate-800">{formatNaira(h.actualCash)}</span></div>
                        <div>POS: <span className="font-semibold text-slate-800">{formatNaira(h.posTotal || 0)}</span></div>
                        <div>Transfers: <span className="font-semibold text-slate-800">{formatNaira(h.transferTotal || 0)}</span></div>
                      </div>

                      {h.notes && (
                        <p className="mt-1 text-[11px] text-slate-500 italic">&ldquo;{h.notes}&rdquo;</p>
                      )}

                      <div className="mt-2.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setPrintableRecord(h)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          🖨 Print Z-Report
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Thermal Z-Report Slip Preview & Print */}
      {printableRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="glass-panel flex max-h-[92vh] w-full max-w-sm flex-col rounded-2xl bg-white p-5 shadow-2xl overflow-y-auto">
            {/* Printable Thermal Area */}
            <div id="thermal-closeout-slip" className="font-mono text-xs text-slate-900 space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <StoreLogo className="h-8 w-auto mx-auto mb-1" />
                <p className="font-bold text-sm tracking-tight">{STORE_NAME}</p>
                <p className="text-[10px] text-slate-500">{STORE_ADDRESSES[0]}</p>
                <p className="text-[10px] text-slate-500">Tel: {STORE_PHONES.join(', ')}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest bg-slate-900 text-white py-0.5">
                  END-OF-DAY Z-REPORT
                </p>
              </div>

              <div className="text-[11px] space-y-0.5 pt-1">
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{formatDateOnly(printableRecord.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>TIME:</span>
                  <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>CLOSED BY:</span>
                  <span>{printableRecord.closedBy || 'Admin'}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <p className="font-bold uppercase tracking-wider">SALES SUMMARY</p>
                <div className="flex justify-between">
                  <span>Total Sales:</span>
                  <span className="font-bold">{formatNaira(printableRecord.totalSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>POS / Card:</span>
                  <span>{formatNaira(printableRecord.posTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bank Transfers:</span>
                  <span>{formatNaira(printableRecord.transferTotal || 0)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <p className="font-bold uppercase tracking-wider">CASH DRAWER RECONCILIATION</p>
                <div className="flex justify-between">
                  <span>Opening Float:</span>
                  <span>+{formatNaira(printableRecord.openingCash || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Sales:</span>
                  <span>+{formatNaira(printableRecord.salesCash || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Repayments:</span>
                  <span>+{formatNaira(printableRecord.debtPaymentsCash || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Expenses:</span>
                  <span>-{formatNaira(printableRecord.cashExpenses || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Borrowed:</span>
                  <span>-{formatNaira(printableRecord.cashBorrowed || 0)}</span>
                </div>

                <div className="flex justify-between border-t border-slate-300 pt-1 font-bold">
                  <span>EXPECTED CASH:</span>
                  <span>{formatNaira(printableRecord.expectedCash || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm">
                  <span>COUNTED CASH:</span>
                  <span>{formatNaira(printableRecord.actualCash || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 font-bold">
                  <span>VARIANCE:</span>
                  <span>{printableRecord.difference === 0 ? 'BALANCED' : `${printableRecord.difference > 0 ? '+' : ''}${formatNaira(printableRecord.difference)}`}</span>
                </div>
              </div>

              {printableRecord.notes && (
                <div className="border-t border-dashed border-slate-300 pt-2 text-[10px] text-slate-600">
                  <p className="font-bold">NOTES:</p>
                  <p>{printableRecord.notes}</p>
                </div>
              )}

              <div className="border-t border-dashed border-slate-400 pt-6 text-center text-[10px] space-y-4">
                <div>
                  <div className="w-32 border-b border-slate-400 mx-auto mb-1"></div>
                  <p>Cashier Signature</p>
                </div>
                <div>
                  <div className="w-32 border-b border-slate-400 mx-auto mb-1"></div>
                  <p>Manager Signature</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setPrintableRecord(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800"
              >
                🖨 Print Z-Report
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
