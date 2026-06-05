import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import InvoiceReceipt from '../components/InvoiceReceipt'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import EditSaleDialog from '../components/EditSaleDialog'
import PasswordDeleteDialog from '../components/PasswordDeleteDialog'
import api from '../api'
import { formatDateTable, formatNaira } from '../utils/format'
import { deleteWithPassword } from '../utils/secureDelete'



export default function InvoicesPage() {

  const [sales, setSales] = useState([])
  const [salesTotal, setSalesTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const load = useCallback((pageNum = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    api
      .get(`/sales?limit=100&page=${pageNum}`)
      .then((r) => {
        const items = r.data.items || []
        setSales((prev) => (append ? [...prev, ...items] : items))
        setSalesTotal(r.data.total ?? items.length)
        setPage(pageNum)
        setHasMore(pageNum < (r.data.pages || 1))
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load invoices'))
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
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



  const confirmDeleteInvoice = async (password) => {
    if (!deleteTarget) return
    try {
      await deleteWithPassword(`/sales/${deleteTarget._id}`, password)
      toast.success('Invoice deleted — stock restored')
      if (preview?._id === deleteTarget._id) setPreview(null)
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete invoice')
      throw err
    }
  }

  const openInvoice = async (id) => {

    setLoadingPreview(true)

    try {
      const { data } = await api.get(`/sales/${id}`)
      setPreview(data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load invoice')
    } finally {
      setLoadingPreview(false)
    }

  }



  return (

    <PageShell

      header={

        <PageHeader

          title="Invoices"

          subtitle="View, edit, or print invoices (same layout as Make Sales)"

        />

      }

    >

      <div className="flex min-h-0 flex-1 flex-col gap-3">

        <div className="glass-panel shrink-0 p-4">

          <label className="block text-base">

            <span className="mb-1 block font-medium text-slate-700">Search</span>

            <input

              className="glass-input w-full p-2.5 text-base"

              placeholder="Invoice # or customer…"

              value={query}

              onChange={(e) => setQuery(e.target.value)}

            />

          </label>

        </div>



        {loading ? (

          <p className="text-slate-500">Loading…</p>

        ) : (

          <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">

            <div className="min-h-0 flex-1 overflow-y-auto">

              <table className="w-full table-fixed border-collapse text-xs sm:text-sm">

                <colgroup>

                  <col className="w-[18%]" />

                  <col className="w-[32%]" />

                  <col className="w-[20%]" />

                  <col className="w-[14%]" />

                  <col className="w-[22%]" />

                </colgroup>

                <thead className="sticky top-0 z-10">

                  <tr className="glass-table-head text-xs uppercase tracking-wide text-white sm:text-sm">

                    <th className="p-2 text-left font-semibold sm:p-2.5">Invoice</th>

                    <th className="p-2 text-left font-semibold sm:p-2.5">Customer</th>

                    <th className="p-2 text-left font-semibold sm:p-2.5">Date</th>

                    <th className="p-2 text-right font-semibold sm:p-2.5">Total</th>

                    <th className="p-2 text-center font-semibold sm:p-2.5">Actions</th>

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

                            ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-200'

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

                        <td className="p-2 align-middle sm:p-2.5">
                          <div className="flex flex-col gap-1 sm:flex-row sm:justify-center">
                            <button
                              type="button"
                              onClick={() => openInvoice(s._id)}
                              disabled={loadingPreview}
                              className="rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60 sm:text-sm"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditTarget(s)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 sm:text-sm"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(s)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 sm:text-sm"
                            >
                              Delete
                            </button>
                          </div>
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

            {(hasMore || salesTotal > sales.length) && !query && (
              <div className="shrink-0 border-t border-slate-100 p-3 text-center">
                <p className="mb-2 text-xs text-slate-500">
                  Showing {sales.length} of {salesTotal} invoices
                </p>
                {hasMore && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => load(page + 1, true)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </div>
            )}

          </div>

        )}

      </div>



      {preview && (
        <InvoiceReceipt
          invoice={preview}
          title="Invoice preview"
          onClose={() => setPreview(null)}
        />
      )}

      {editTarget && (
        <EditSaleDialog
          saleId={editTarget._id}
          invoiceNumber={editTarget.invoiceNumber}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setEditTarget(null)
            setPreview(updated)
            load()
          }}
        />
      )}

      <PasswordDeleteDialog
        open={!!deleteTarget}
        title="Delete invoice"
        message={
          deleteTarget
            ? `Remove invoice ${deleteTarget.invoiceNumber || ''}? Product quantities will be restored and any linked debt record removed.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteInvoice}
      />
    </PageShell>

  )

}


