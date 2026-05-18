import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import api from '../api'
import { paymentMethodLabel } from '../constants'
import { displayShopName, useShopSettingsStore } from '../shopSettingsStore'
import { formatDate, formatNaira } from '../utils/format'

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
]

function StatCard({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white text-slate-900',
    emerald: 'bg-emerald-50 text-emerald-900',
    amber: 'bg-amber-50 text-amber-900',
    rose: 'bg-rose-50 text-rose-900',
  }
  return (
    <div className={`rounded-xl p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  )
}

export default function ReportsPage() {
  const settings = useShopSettingsStore((s) => s.settings)
  const [period, setPeriod] = useState('today')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

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
    load()
  }, [load])

  const exportCsv = () => {
    if (!report) return
    setExporting(true)
    try {
      const lines = []
      lines.push(`${displayShopName(settings)} — Financial Report`)
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
      lines.push('Product,Qty sold,Revenue,Cost,Profit')
      for (const p of report.products || []) {
        lines.push(
          `"${p.productName}",${p.quantitySold},${p.revenue},${p.cost},${p.profit}`,
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

  return (
    <PageShell
      header={
        <>
          <PageHeader
            title="Reports"
            subtitle="Product sales, profit, and payment breakdown (₦)"
          />
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
        <label className="text-sm text-slate-600">
          Period
          <select
            className="mt-1 block min-w-[160px] rounded-lg border p-2.5"
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
          className="rounded-lg border px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-50"
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total sales"
              value={formatNaira(summary.totalSales)}
              sub={`${summary.salesCount} transaction${summary.salesCount !== 1 ? 's' : ''}`}
              tone="emerald"
            />
            <StatCard
              label="Profit"
              value={formatNaira(summary.totalProfit)}
              sub={`Cost ${formatNaira(summary.totalCost)}`}
              tone="emerald"
            />
            <StatCard
              label="Collected at sale"
              value={formatNaira(summary.collectedAtSale)}
              sub={`+ ${formatNaira(summary.debtPaymentsReceived)} debt payments`}
              tone="slate"
            />
            <StatCard
              label="Credit extended"
              value={formatNaira(summary.creditExtended)}
              sub={`Outstanding ${formatNaira(summary.outstandingDebt)}`}
              tone="amber"
            />
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900">Collections by method</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(summary.byMethod || {}).map(([method, amount]) => (
                <div
                  key={method}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs text-slate-500">{paymentMethodLabel(method)}</p>
                  <p className="text-lg font-bold text-slate-900">{formatNaira(amount)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Total collected (sales + debt payments):{' '}
              <strong>{formatNaira(summary.totalCollected)}</strong>
            </p>
          </div>

          <section className="rounded-xl bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold text-slate-900">Product sales</h3>
              <p className="text-xs text-slate-500">By product name — quantity, revenue, cost, profit</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.products || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No sales in this period
                      </td>
                    </tr>
                  ) : (
                    report.products.map((p) => (
                      <tr key={p.productName} className="border-b border-slate-100">
                        <td className="px-4 py-2 font-medium">{p.productName}</td>
                        <td className="px-4 py-2 text-right">{p.quantitySold}</td>
                        <td className="px-4 py-2 text-right">{formatNaira(p.revenue)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">
                          {formatNaira(p.cost)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-emerald-800">
                          {formatNaira(p.profit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl bg-white shadow-sm">
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
                    report.sales.map((sale) => (
                      <tr key={sale._id} className="border-b border-slate-100">
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
    </PageShell>
  )
}
