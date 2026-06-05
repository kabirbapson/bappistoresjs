import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import ProductSalesHistoryDialog from '../components/ProductSalesHistoryDialog'
import api from '../api'
import { paymentMethodLabel } from '../constants'
import { formatDate, formatDateOnly, formatNaira } from '../utils/format'

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'lastMonth', label: 'Last month' },
]

function tableRowClass(index) {
  return index % 2 === 0
    ? 'bg-white hover:bg-slate-50'
    : 'bg-slate-50 hover:bg-slate-100'
}

function StatCard({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'glass-stat-slate',
    emerald: 'glass-stat-emerald',
    amber: 'glass-stat-amber',
    rose: 'glass-stat-rose',
  }
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  )
}

function CollectionMethodTile({ method, amount }) {
  const isCash = method === 'cash'
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 ${
        isCash
          ? 'border-emerald-100 bg-emerald-50'
          : 'border-sky-100 bg-sky-50'
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-20 ${
          isCash ? 'bg-emerald-500' : 'bg-sky-500'
        }`}
      />
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isCash ? 'text-emerald-700' : 'text-sky-700'
        }`}
      >
        {paymentMethodLabel(method)}
      </p>
      <p
        className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${
          isCash ? 'text-emerald-900' : 'text-slate-900'
        }`}
      >
        {formatNaira(amount)}
      </p>
    </div>
  )
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('today')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [productFilter, setProductFilter] = useState('')
  const [historyProduct, setHistoryProduct] = useState(null)

  const openProductHistory = (productId, productName) => {
    if (!productId) {
      toast.error('No product id for this row — open from the product list above')
      return
    }
    setHistoryProduct({ productId, productName })
  }

  const filteredProductLines = (report?.productLines || []).filter((line) => {
    if (!productFilter.trim()) return true
    const q = productFilter.trim().toLowerCase()
    return (
      line.productName?.toLowerCase().includes(q) ||
      line.customerName?.toLowerCase().includes(q) ||
      line.invoiceNumber?.toLowerCase().includes(q)
    )
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/reports/detailed?period=${period}`)
      setReport(data)
    } catch {
      toast.error('Could not load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    setProductFilter('')
    load()
  }, [load])

  const exportCsv = () => {
    if (!report) return
    setExporting(true)
    try {
      const lines = []
      lines.push('Bappi Stores Kano — Financial Report')
      lines.push(`Period,${PERIODS.find((p) => p.value === period)?.label || period}`)
      lines.push(`From,${report.from}`)
      lines.push(`To,${report.to}`)
      lines.push('')
      lines.push('Summary')
      const s = report.summary
      lines.push(`Sales count,${s.salesCount}`)
      lines.push(`Total sales,${s.totalSales}`)
      lines.push(`Cost,${s.totalCost}`)
      lines.push(`Profit,${s.totalProfit}`)
      lines.push(`Collected at sale,${s.collectedAtSale}`)
      lines.push(`Credit extended,${s.creditExtended}`)
      lines.push(`Debt payments,${s.debtPaymentsReceived}`)
      lines.push(`Total collected,${s.totalCollected}`)
      lines.push(`Outstanding debt,${s.outstandingDebt}`)
      lines.push('')
      lines.push('Product line detail')
      lines.push('Date,Invoice,Product,Customer,Qty,Unit price,Line total')
      for (const line of report.productLines || []) {
        lines.push(
          [
            line.date,
            `"${line.invoiceNumber || ''}"`,
            `"${line.productName}"`,
            `"${line.customerName}"`,
            line.quantity,
            line.unitPrice,
            line.lineTotal,
          ].join(','),
        )
      }
      lines.push('')
      lines.push(`Product quantities (${PERIODS.find((p) => p.value === period)?.label || period})`)
      lines.push('Product,Qty sold,Left in stock')
      for (const p of report.products || []) {
        lines.push(
          `"${p.productName}",${p.quantitySold},${p.quantityLeft ?? ''}`,
        )
      }
      lines.push('')
      lines.push('Invoice,Date,Customer,Total,Paid,Credit,Type')
      for (const sale of report.sales || []) {
        lines.push(
          `"${sale.invoiceNumber}",${sale.date},"${sale.customerName}",${sale.totalAmount},${sale.amountPaid},${sale.creditBalance},${sale.type}`,
        )
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bappi-stores-report-${period}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const summary = report?.summary
  const periodLabel = PERIODS.find((p) => p.value === period)?.label || period
  const collectionMethods = ['cash', 'pos'].map((method) => [
    method,
    summary?.byMethod?.[method] ?? 0,
  ])

  return (
    <PageShell
      header={
        <>
          <PageHeader
            title="Reports"
            subtitle="Click any product to see who bought it, qty, rate & date — like on receipts"
          />
          <div className="glass-panel flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm text-slate-600">
          Period
          <select
            className="glass-input mt-1 block min-w-[160px] p-2.5"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || !report}
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Download CSV'}
        </button>
          </div>
        </>
      }
    >
      <div className="space-y-4 pb-2">
      {loading && (
        <p className="text-center text-slate-500">Loading report…</p>
      )}

      {!loading && summary && (
        <>
          <div className="glass-banner-dark px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-100/90">
                  Total collected — {periodLabel}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
                  {formatNaira(summary.totalCollected)}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Checkout + debt payments for this period
                </p>
              </div>
              <div className="flex flex-wrap gap-6 sm:gap-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    At checkout
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-white sm:text-xl">
                    {formatNaira(summary.collectedAtSale)}
                  </p>
                  <p className="text-[11px] text-slate-400">Cash, POS & transfers</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Debt payments
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-white sm:text-xl">
                    {formatNaira(summary.debtPaymentsReceived)}
                  </p>
                  <p className="text-[11px] text-slate-400">Recorded on Debts page</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total sales"
              value={formatNaira(summary.totalSales)}
              sub={`${summary.salesCount} transaction${summary.salesCount !== 1 ? 's' : ''} · ${periodLabel}`}
              tone="emerald"
            />
            <StatCard
              label="Profit"
              value={formatNaira(summary.totalProfit)}
              sub={`Cost ${formatNaira(summary.totalCost)}`}
              tone="emerald"
            />
            <StatCard
              label="Collected at checkout"
              value={formatNaira(summary.collectedAtSale)}
              sub="All sales in period"
              tone="slate"
            />
            <StatCard
              label="Credit extended"
              value={formatNaira(summary.creditExtended)}
              sub={`Outstanding ${formatNaira(summary.outstandingDebt)}`}
              tone="amber"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <section className="glass-panel flex min-h-[280px] flex-col">
              <div className="shrink-0 border-b px-3 py-2.5">
                <h3 className="font-semibold text-slate-900">Product sales — {periodLabel}</h3>
                <p className="text-xs text-slate-500">Click a product for full sales history</p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <th className="px-2 py-1.5">Product</th>
                      <th className="px-2 py-1.5 text-right whitespace-nowrap">Sold</th>
                      <th className="px-2 py-1.5 text-right whitespace-nowrap">Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.products || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                          No product sales in this period
                        </td>
                      </tr>
                    ) : (
                      report.products.map((p, index) => (
                        <tr
                          key={p.productId || p.productName}
                          className={`border-b border-slate-100 transition-colors ${tableRowClass(index)} ${
                            p.productId ? 'cursor-pointer hover:bg-emerald-50/80' : ''
                          }`}
                          onClick={() => p.productId && openProductHistory(p.productId, p.productName)}
                          onKeyDown={(e) => {
                            if (p.productId && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault()
                              openProductHistory(p.productId, p.productName)
                            }
                          }}
                          tabIndex={p.productId ? 0 : undefined}
                          role={p.productId ? 'button' : undefined}
                        >
                          <td className="px-2 py-1.5 font-medium text-emerald-900 underline-offset-2 hover:underline">
                            {p.productName}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-800">
                            {p.quantitySold.toLocaleString('en-NG')}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right tabular-nums font-semibold ${
                              p.quantityLeft == null
                                ? 'text-slate-400'
                                : p.quantityLeft <= 0
                                  ? 'text-rose-700'
                                  : p.quantityLeft <= 50
                                    ? 'text-amber-800'
                                    : 'text-slate-800'
                            }`}
                          >
                            {p.quantityLeft == null ? '—' : p.quantityLeft.toLocaleString('en-NG')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="glass-panel flex min-h-[280px] flex-col overflow-hidden">
              <div className="glass-banner shrink-0 px-4 py-3">
                <h3 className="font-semibold text-slate-800">Collections by method</h3>
                <p className="text-xs text-slate-600">Cash, POS, totals &amp; outstanding debt</p>
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                  {collectionMethods.map(([method, amount]) => (
                    <CollectionMethodTile key={method} method={method} amount={amount} />
                  ))}
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
                    Total collected — {periodLabel}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900 sm:text-3xl">
                    {formatNaira(summary.totalCollected)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/80">
                    {formatNaira(summary.collectedAtSale)} checkout +{' '}
                    {formatNaira(summary.debtPaymentsReceived)} debt payments
                  </p>
                </div>

                <div className="glass-stat-amber flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                      Debts outstanding
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700/80">All unpaid customer balances</p>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-amber-900 sm:text-2xl">
                    {formatNaira(summary.outstandingDebt)}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="glass-panel">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3">
              <div>
                <h3 className="font-semibold text-slate-900">Product sales detail</h3>
                <p className="text-xs text-slate-500">
                  Each item sold — date, customer, quantity, and price (
                  {filteredProductLines.length}
                  {productFilter.trim() ? ` of ${report.productLines?.length || 0}` : ''} lines)
                </p>
              </div>
              <label className="text-sm text-slate-600">
                Filter
                <input
                  type="search"
                  placeholder="Product, customer, invoice…"
                  className="glass-input mt-1 block w-full min-w-[200px] p-2 text-sm sm:w-64"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                />
              </label>
            </div>
            <div className="max-h-[min(32rem,55vh)] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Invoice</th>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit price</th>
                    <th className="px-4 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        {productFilter.trim()
                          ? 'No lines match your filter'
                          : 'No product lines in this period'}
                      </td>
                    </tr>
                  ) : (
                    filteredProductLines.map((line, i) => (
                      <tr
                        key={`${line.invoiceNumber}-${line.productName}-${i}`}
                        className={`border-b border-slate-100 transition-colors ${tableRowClass(i)}`}
                      >
                        <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                          {formatDateOnly(line.date)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{line.invoiceNumber || '—'}</td>
                        <td className="px-4 py-2 font-medium">
                          {line.productId ? (
                            <button
                              type="button"
                              onClick={() => openProductHistory(line.productId, line.productName)}
                              className="text-left font-medium text-emerald-800 hover:underline"
                            >
                              {line.productName}
                            </button>
                          ) : (
                            line.productName
                          )}
                        </td>
                        <td className="px-4 py-2">{line.customerName}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{line.quantity}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatNaira(line.unitPrice)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {formatNaira(line.lineTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-panel">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold text-slate-900">Recent sales</h3>
              <p className="text-xs text-slate-500">Customer, totals, paid now vs credit</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">Invoice</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Paid</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.sales || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No sales in this period
                      </td>
                    </tr>
                  ) : (
                    report.sales.map((sale, index) => (
                      <tr
                        key={sale._id}
                        className={`border-b border-slate-100 transition-colors ${tableRowClass(index)}`}
                      >
                        <td className="px-4 py-2 font-mono text-xs">{sale.invoiceNumber}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                          {formatDate(sale.date)}
                        </td>
                        <td className="px-4 py-2">{sale.customerName}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatNaira(sale.totalAmount)}
                        </td>
                        <td className="px-4 py-2 text-right text-emerald-800">
                          {formatNaira(sale.amountPaid)}
                        </td>
                        <td className="px-4 py-2 text-right text-amber-800">
                          {sale.creditBalance > 0 ? formatNaira(sale.creditBalance) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      </div>

      {historyProduct && (
        <ProductSalesHistoryDialog
          productId={historyProduct.productId}
          productName={historyProduct.productName}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </PageShell>
  )
}
