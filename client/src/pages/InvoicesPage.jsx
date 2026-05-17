import { useCallback, useEffect, useMemo, useState } from 'react'
import ClassicInvoice from '../components/ClassicInvoice'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import api from '../api'
import { formatDateTable, formatNaira } from '../utils/format'
import { printClassicInvoice } from '../utils/print'

export default function InvoicesPage() {
  const [sales, setSales] = useState([])
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get('/sales?limit=100')
      .then((r) => setSales(r.data.items))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sales
    return sales.filter(
      (s) =>
        (s.invoiceNumber || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q),
    )
  }, [sales, query])

  const openInvoice = async (id) => {
    setLoadingPreview(true)
    try {
      const { data } = await api.get(`/sales/${id}`)
      setPreview(data)
    } finally {
      setLoadingPreview(false)
    }
  }

  const printCurrent = () => {
    printClassicInvoice()
  }

  return (
    <PageShell
      scroll={false}
      header={
        <PageHeader
          title="Invoices"
          subtitle="Classic invoices — view, print, or save as PDF (A4)"
        />
      }
    >
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:grid-rows-1">
        <section className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Search</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-base focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Invoice # or customer…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[32%]" />
                  <col className="w-[24%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-xs uppercase tracking-wide text-white sm:text-sm">
                    <th className="p-2 text-left font-semibold sm:p-2.5">Invoice</th>
                    <th className="p-2 text-left font-semibold sm:p-2.5">Customer</th>
                    <th className="p-2 text-left font-semibold sm:p-2.5">Date</th>
                    <th className="p-2 text-right font-semibold sm:p-2.5">Total</th>
                    <th className="p-2 text-center font-semibold sm:p-2.5"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, index) => {
                    const active = preview?._id === s._id
                    const saleWhen = formatDateTable(s.date)
                    return (
                      <tr
                        key={s._id}
                        className={`border-b border-slate-200/80 transition-colors ${
                          active
                            ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-300'
                            : index % 2 === 0
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <td className="overflow-hidden p-2 align-middle sm:p-2.5">
                          <span
                            className="block truncate font-mono font-medium text-slate-900"
                            title={s.invoiceNumber}
                          >
                            {s.invoiceNumber || '—'}
                          </span>
                        </td>
                        <td
                          className="overflow-hidden truncate p-2 align-middle sm:p-2.5"
                          title={s.customerName}
                        >
                          {s.customerName}
                        </td>
                        <td
                          className="whitespace-nowrap p-2 align-middle text-slate-600 sm:p-2.5"
                          title={saleWhen}
                        >
                          {saleWhen}
                        </td>
                        <td className="overflow-hidden truncate p-2 text-right align-middle font-semibold tabular-nums text-emerald-800 sm:p-2.5">
                          {formatNaira(s.totalAmount)}
                        </td>
                        <td className="p-2 text-center align-middle sm:p-2.5">
                          <button
                            type="button"
                            onClick={() => openInvoice(s._id)}
                            className="rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 sm:text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="border-t border-slate-100 px-6 py-12 text-center">
                  <p className="text-base text-slate-500">
                    {query ? 'No invoices match your search.' : 'No sales yet.'}
                  </p>
                </div>
              )}
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col">
          {loadingPreview && (
            <p className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm">
              Loading invoice…
            </p>
          )}
          {!loadingPreview && !preview && (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
              <p className="text-base">Select an invoice and tap <strong>View</strong></p>
              <p className="mt-2 text-sm">The classic document appears here for printing.</p>
            </div>
          )}
          {!loadingPreview && preview && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="no-print flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={printCurrent}
                  className="flex-1 rounded-lg bg-emerald-700 py-2.5 text-base font-semibold text-white hover:bg-emerald-800"
                >
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-md">
                <ClassicInvoice invoice={preview} className="h-full overflow-y-auto" />
              </div>
            </div>
          )}
        </aside>
      </div>

      {preview && (
        <div id="classic-invoice-print" className="classic-invoice-print" aria-hidden="true">
          <ClassicInvoice invoice={preview} />
        </div>
      )}
    </PageShell>
  )
}
