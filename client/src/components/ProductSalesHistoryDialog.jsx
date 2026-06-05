import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { PRODUCT_HISTORY_SCOPES } from '../constants'
import { formatDate, formatDateOnly, formatNaira } from '../utils/format'

function scopeLabel(scope) {
  if (scope === 'all') return 'All time'
  return PRODUCT_HISTORY_SCOPES.find((p) => p.value === scope)?.label || scope
}

function tableRowClass(index) {
  return index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
}

export default function ProductSalesHistoryDialog({
  productId,
  productName,
  onClose,
}) {
  const [scope, setScope] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const params =
        scope === 'all'
          ? {}
          : { scope: 'period', period: scope }
      const { data: res } = await api.get(`/reports/products/${productId}/history`, { params })
      setData(res)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load product history')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [productId, scope])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = () => {
    if (!data?.lines?.length) return
    const name = data.product?.name || productName || 'product'
    const lines = [
      `Bappi Stores — Product sales: ${name}`,
      `Added,${data.product?.addedAt || ''}`,
      `Scope,${scopeLabel(scope)}`,
      `Total added to stock,${data.product?.totalAdded ?? ''}`,
      `Total sold (all time),${data.product?.allTimeQuantitySold ?? data.summary?.quantitySold ?? 0}`,
      `Sold (${scopeLabel(scope)}),${data.summary?.quantitySold ?? 0}`,
      `Left in stock,${data.product?.currentStock ?? ''}`,
      `Revenue,${data.summary?.revenue ?? 0}`,
      '',
      'Date,Invoice,Customer,Qty,Unit price,Line total',
    ]
    for (const row of data.lines) {
      lines.push(
        [
          row.date,
          `"${row.invoiceNumber || ''}"`,
          `"${row.customerName}"`,
          row.quantity,
          row.unitPrice,
          row.lineTotal,
        ].join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product-sales-${name.replace(/[^\w-]+/g, '-').slice(0, 40)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const title = data?.product?.name || productName || 'Product'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-history-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 id="product-history-title" className="text-lg font-bold text-slate-900">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">Customer purchases — like invoice lines</p>
            {data?.product?.addedAt && (
              <p className="mt-1 text-xs text-slate-500">
                In catalog since {formatDate(data.product.addedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
          <span className="text-xs font-semibold uppercase text-slate-500">Show</span>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              scope === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            All time
          </button>
          {PRODUCT_HISTORY_SCOPES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setScope(p.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                scope === p.value
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data?.lines?.length}
            className="ml-auto rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            Download CSV
          </button>
        </div>

        {data?.summary && !loading && (
          <div className="shrink-0 space-y-2 border-b border-slate-100 px-4 py-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-violet-50 px-3 py-2 text-center ring-1 ring-violet-100">
                <p className="text-[10px] font-bold uppercase text-violet-800">Total added</p>
                <p className="text-lg font-bold tabular-nums text-violet-950">
                  {(data.product?.totalAdded ?? 0).toLocaleString('en-NG')}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center ring-1 ring-emerald-100">
                <p className="text-[10px] font-bold uppercase text-emerald-700">
                  {scope === 'all' ? 'Total sold' : `Sold — ${scopeLabel(scope)}`}
                </p>
                <p className="text-lg font-bold tabular-nums text-emerald-900">
                  {data.summary.quantitySold.toLocaleString('en-NG')}
                </p>
                {scope !== 'all' && data.product?.allTimeQuantitySold != null && (
                  <p className="mt-0.5 text-[10px] font-medium text-emerald-700">
                    {data.product.allTimeQuantitySold.toLocaleString('en-NG')} all time
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-sky-50 px-3 py-2 text-center ring-1 ring-sky-100">
                <p className="text-[10px] font-bold uppercase text-sky-800">Left in stock</p>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    data.product?.currentStock == null
                      ? 'text-slate-400'
                      : data.product.currentStock <= 0
                        ? 'text-rose-700'
                        : data.product.currentStock <= 50
                          ? 'text-amber-800'
                          : 'text-sky-900'
                  }`}
                >
                  {data.product?.currentStock == null
                    ? '—'
                    : data.product.currentStock.toLocaleString('en-NG')}
                </p>
              </div>
            </div>
            <p className="text-center text-[10px] font-medium text-slate-400">
              Total added = sold + left
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-800 px-3 py-2 text-center text-white">
                <p className="text-[10px] font-bold uppercase text-slate-300">Revenue</p>
                <p className="text-lg font-bold tabular-nums">{formatNaira(data.summary.revenue)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-center ring-1 ring-amber-100">
                <p className="text-[10px] font-bold uppercase text-amber-800">Last sale</p>
                <p className="text-sm font-bold text-amber-900">
                  {data.summary.lastSale ? formatDateOnly(data.summary.lastSale) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="px-4 py-10 text-center text-slate-500">Loading…</p>
          ) : !data?.lines?.length ? (
            <p className="px-4 py-10 text-center text-slate-500">
              No sales recorded for this product
              {scope === 'all' ? ' yet' : ` for ${scopeLabel(scope).toLowerCase()}`}.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                <tr className="text-left text-xs uppercase text-slate-600">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line, i) => (
                  <tr key={`${line.saleId}-${i}`} className={`border-b border-slate-100 ${tableRowClass(i)}`}>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                      {formatDate(line.date)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{line.invoiceNumber || '—'}</td>
                    <td className="px-4 py-2 font-medium">{line.customerName}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{line.quantity}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNaira(line.unitPrice)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-800">
                      {formatNaira(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
