import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import InvoiceReceipt from '../components/InvoiceReceipt'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import NumericInput from '../components/NumericInput'
import PasswordDeleteDialog from '../components/PasswordDeleteDialog'
import api from '../api'
import { deleteWithPassword } from '../utils/secureDelete'
import { formatDateOnly, formatNaira } from '../utils/format'

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'lastMonth', label: 'Last month' },
]

function statusMeta(status) {
  if (status === 'paid') {
    return { label: 'Settled', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200' }
  }
  if (status === 'partial') {
    return { label: 'Partial', badge: 'bg-amber-100 text-amber-900 ring-amber-200' }
  }
  return { label: 'Unpaid', badge: 'bg-rose-100 text-rose-800 ring-rose-200' }
}

function customerInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

/** Paid at checkout on the linked credit/partial sale (not recorded on the debt row). */
function paidAtCheckout(debt, period = 'all') {
  if (period !== 'all' && debt.checkoutPaidInPeriod != null) {
    return debt.checkoutPaidInPeriod
  }
  const sale = debt.saleId
  if (!sale || typeof sale !== 'object') return 0
  return sale.amountPaid || 0
}

function paidOnDebtsPage(debt, period = 'all') {
  if (period !== 'all' && debt.paymentsInPeriod != null) {
    return debt.paymentsInPeriod
  }
  return debt.amountPaid || 0
}

function totalPaidTowardCredit(debt, period = 'all') {
  return paidAtCheckout(debt, period) + paidOnDebtsPage(debt, period)
}

function StatCard({ label, value, sub, accent }) {
  const accents = {
    rose: 'border-l-rose-500 glass-stat-rose',
    emerald: 'border-l-emerald-500 glass-stat-emerald',
    amber: 'border-l-amber-500 glass-stat-amber',
    slate: 'border-l-slate-400 glass-stat-slate',
  }
  return (
    <div className={`rounded-xl border-l-4 px-4 py-3.5 shadow-sm ${accents[accent]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
    </div>
  )
}

function FilterPill({ active, label, count, tone, onClick }) {
  const tones = {
    slate: active ? 'bg-slate-800 text-white ring-slate-800' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
    rose: active ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-rose-800 ring-rose-200 hover:bg-rose-50',
    amber: active ? 'bg-amber-600 text-white ring-amber-600' : 'bg-white text-amber-900 ring-amber-200 hover:bg-amber-50',
    emerald: active ? 'bg-emerald-700 text-white ring-emerald-700' : 'bg-white text-emerald-800 ring-emerald-200 hover:bg-emerald-50',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium ring-1 transition-colors ${tones[tone]}`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
        {count}
      </span>
    </button>
  )
}

export default function DebtsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [payments, setPayments] = useState({})
  const [payingId, setPayingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = period === 'all' ? '' : `?period=${period}`
    api
      .get(`/debts${params}`)
      .then((r) => setRows(r.data.items))
      .catch(() => {
        toast.error('Could not load debts')
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const active = rows.filter((d) => d.balance > 0)
    return {
      all: rows.length,
      active: active.length,
      unpaid: rows.filter((d) => d.status === 'unpaid').length,
      partial: rows.filter((d) => d.status === 'partial').length,
      paid: rows.filter((d) => d.status === 'paid').length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((d) => {
      if (statusFilter === 'active' && d.balance <= 0) return false
      if (statusFilter !== 'all' && statusFilter !== 'active' && d.status !== statusFilter) {
        return false
      }
      if (!q) return true
      const name = (d.customerId?.name || '').toLowerCase()
      return name.includes(q)
    })
  }, [rows, query, statusFilter])

  const summary = useMemo(() => {
    const outstanding = filtered.reduce((s, d) => s + (d.balance || 0), 0)
    const totalCredit = filtered.reduce((s, d) => s + (d.totalAmount || 0), 0)
    const checkoutTotal = filtered.reduce((s, d) => s + paidAtCheckout(d, period), 0)
    const debtsPageTotal = filtered.reduce((s, d) => s + paidOnDebtsPage(d, period), 0)
    return {
      outstanding,
      totalCredit,
      paidAtCheckout: checkoutTotal,
      paidOnDebtsPage: debtsPageTotal,
      totalPaid: checkoutTotal + debtsPageTotal,
    }
  }, [filtered, period])

  const pay = async (debtId) => {
    const amount = Number(payments[debtId] || 0)
    if (!amount) {
      toast.error('Enter a payment amount')
      return
    }
    const debt = rows.find((d) => d._id === debtId)
    if (debt && amount > debt.balance) {
      toast.error(`Maximum payment is ${formatNaira(debt.balance)}`)
      return
    }
    setPayingId(debtId)
    try {
      await api.post('/payments', { debtId, amount, method: 'cash' })
      toast.success('Payment recorded')
      setPayments((prev) => ({ ...prev, [debtId]: '' }))
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed')
    } finally {
      setPayingId(null)
    }
  }

  const setQuickPay = (debtId, balance) => {
    setPayments((prev) => ({ ...prev, [debtId]: String(balance) }))
  }

  const openInvoice = async (saleId) => {
    if (!saleId) return
    setLoadingPreview(true)
    try {
      const { data } = await api.get(`/sales/${saleId}`)
      setPreview(data)
    } catch {
      toast.error('Could not load invoice')
    } finally {
      setLoadingPreview(false)
    }
  }

  const confirmDeleteDebt = async (password) => {
    if (!deleteTarget) return
    try {
      await deleteWithPassword(`/debts/${deleteTarget._id}`, password)
      toast.success('Debt record deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete debt')
      throw err
    }
  }

  return (
    <PageShell
      scroll={false}
      header={
        <PageHeader
          title="Debts"
          subtitle="Credit sales — paid at checkout plus payments recorded here"
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            accent="rose"
            label="Outstanding"
            value={formatNaira(summary.outstanding)}
            sub={`${counts.active} account${counts.active !== 1 ? 's' : ''} with balance`}
          />
          <StatCard
            accent="emerald"
            label={period === 'all' ? 'Total paid' : 'Paid in period'}
            value={formatNaira(summary.totalPaid)}
            sub={
              period === 'all'
                ? `${formatNaira(summary.paidAtCheckout)} at checkout · ${formatNaira(summary.paidOnDebtsPage)} on this page`
                : `${formatNaira(summary.paidAtCheckout)} checkout · ${formatNaira(summary.paidOnDebtsPage)} debt payments`
            }
          />
          <StatCard
            accent="amber"
            label="Partial"
            value={counts.partial}
            sub="Still owe after payment"
          />
          <StatCard
            accent="slate"
            label="Total credit"
            value={formatNaira(summary.totalCredit)}
            sub="All credit sale amounts"
          />
        </div>

        <div className="glass-panel shrink-0 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
              <label className="block min-w-[140px] text-sm">
                <span className="mb-1 block font-medium text-slate-700">Period</span>
                <select
                  className="glass-input w-full p-2.5 text-sm"
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
              <label className="block min-w-0 flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700">Search debtor</span>
                <input
                  className="glass-input w-full p-2.5 text-sm"
                  placeholder="Search by name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterPill
                active={statusFilter === 'active'}
                count={counts.active}
                label="Outstanding"
                tone="rose"
                onClick={() => setStatusFilter('active')}
              />
              <FilterPill
                active={statusFilter === 'all'}
                count={counts.all}
                label="All"
                tone="slate"
                onClick={() => setStatusFilter('all')}
              />
              <FilterPill
                active={statusFilter === 'unpaid'}
                count={counts.unpaid}
                label="Unpaid"
                tone="rose"
                onClick={() => setStatusFilter('unpaid')}
              />
              <FilterPill
                active={statusFilter === 'partial'}
                count={counts.partial}
                label="Partial"
                tone="amber"
                onClick={() => setStatusFilter('partial')}
              />
              <FilterPill
                active={statusFilter === 'paid'}
                count={counts.paid}
                label="Settled"
                tone="emerald"
                onClick={() => setStatusFilter('paid')}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="glass-panel flex flex-1 items-center justify-center py-16">
            <p className="text-slate-500">Loading debts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel flex flex-1 flex-col items-center justify-center border-dashed border-slate-300 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
              ✓
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-800">
              {query || statusFilter !== 'active' || period !== 'all'
                ? 'No debts match your filters'
                : 'All clear — no outstanding debt'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {statusFilter === 'active' && !query && period === 'all'
                ? 'Credit customers will appear here when they have a balance.'
                : 'Try another period, search, or filter.'}
            </p>
          </div>
        ) : (
          <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{filtered.length}</span> debt
                {filtered.length !== 1 ? 's' : ''} shown
                {period !== 'all' && (
                  <span className="text-slate-500">
                    {' '}
                    · credit opened or payment in{' '}
                    {PERIODS.find((p) => p.value === period)?.label?.toLowerCase()}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {period === 'all'
                  ? 'Use a period filter to match Reports totals for that window.'
                  : 'Paid amounts below are for this period only — matches Reports debt payments + checkout on credit sales.'}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="glass-table-head text-left text-xs uppercase tracking-wide text-white">
                    <th className="p-3 font-semibold">Customer</th>
                    <th className="p-3 text-center font-semibold">Status</th>
                    <th className="p-3 text-right font-semibold">Total</th>
                    <th className="p-3 text-right font-semibold">Paid</th>
                    <th className="p-3 text-right font-semibold">Balance</th>
                    <th className="p-3 text-center font-semibold">Record payment</th>
                    <th className="w-12 p-3 font-semibold" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, index) => {
                    const meta = statusMeta(d.status)
                    const name = d.customerId?.name || 'Customer'
                    const canPay = d.balance > 0
                    const isPaying = payingId === d._id
                    const saleId = d.saleId?._id || d.saleId
                    const invoiceNumber = d.saleId?.invoiceNumber

                    return (
                      <tr
                        key={d._id}
                        className={`border-b border-slate-100 transition-colors ${
                          index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <td className="p-3 align-middle">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white"
                              aria-hidden
                            >
                              {customerInitial(name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-900" title={name}>
                                {name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {d.createdAt && (
                                  <span className="text-xs text-slate-400">
                                    Since {formatDateOnly(d.createdAt)}
                                  </span>
                                )}
                                {saleId && (
                                  <button
                                    type="button"
                                    onClick={() => openInvoice(saleId)}
                                    disabled={loadingPreview}
                                    className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                                    title="View invoice"
                                  >
                                    {invoiceNumber || 'Invoice'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center align-middle">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="p-3 text-right align-middle tabular-nums text-slate-700">
                          {formatNaira(d.totalAmount)}
                        </td>
                        <td className="p-3 text-right align-middle tabular-nums text-emerald-800">
                          <p>{formatNaira(totalPaidTowardCredit(d, period))}</p>
                          {period === 'all' &&
                            paidAtCheckout(d, period) > 0 &&
                            paidOnDebtsPage(d, period) > 0 && (
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              incl. {formatNaira(paidAtCheckout(d, period))} at checkout
                            </p>
                          )}
                          {period !== 'all' && totalPaidTowardCredit(d, period) === 0 && (
                            <p className="mt-0.5 text-[10px] text-slate-400">No payment in period</p>
                          )}
                        </td>
                        <td
                          className={`whitespace-nowrap p-3 text-right align-middle font-bold tabular-nums ${
                            canPay ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatNaira(d.balance)}
                        </td>
                        <td className="p-3 align-middle">
                          {canPay ? (
                            <div className="mx-auto flex w-fit items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                              <button
                                type="button"
                                onClick={() => setQuickPay(d._id, d.balance)}
                                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                title={`Fill ${formatNaira(d.balance)}`}
                              >
                                Full
                              </button>
                              <NumericInput
                                placeholder="Amount"
                                className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-semibold tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                value={
                                  payments[d._id] === '' || payments[d._id] == null
                                    ? ''
                                    : Number(payments[d._id])
                                }
                                onChange={(v) =>
                                  setPayments({
                                    ...payments,
                                    [d._id]: v === '' ? '' : String(v),
                                  })
                                }
                              />
                              <button
                                type="button"
                                disabled={isPaying}
                                onClick={() => pay(d._id)}
                                className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                              >
                                {isPaying ? '…' : 'Record'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 text-emerald-700">
                              <span className="text-lg" aria-hidden>
                                ✓
                              </span>
                              <span className="text-sm font-medium">Settled</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(d)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete debt record"
                            aria-label={`Delete debt for ${name}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-5 w-5"
                              aria-hidden
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.045-.112a.75.75 0 0 1 .256-1.478 48.567 48.567 0 0 1 3.878-.512V4.478a3 3 0 0 1 3-2.983V3.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v.745a3 3 0 0 1 3 2.983ZM9.75 6.75v7.5a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-1.5 0Zm3 0v7.5a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-1.5 0Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <PasswordDeleteDialog
        open={!!deleteTarget}
        title="Delete debt record"
        message={
          deleteTarget
            ? `Remove the debt record for ${deleteTarget.customerId?.name || 'this customer'}? Payment history for this debt will be deleted. The sale invoice is kept unless you delete it on Invoices.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteDebt}
      />

      {preview && (
        <InvoiceReceipt
          invoice={preview}
          title="Invoice preview"
          onClose={() => setPreview(null)}
        />
      )}
    </PageShell>
  )
}
