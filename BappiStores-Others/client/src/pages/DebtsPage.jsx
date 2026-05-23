import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import NumericInput from '../components/NumericInput'
import PasswordDeleteDialog from '../components/PasswordDeleteDialog'
import api from '../api'
import { deleteWithPassword } from '../utils/secureDelete'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../constants'
import { formatDateTable, formatNaira } from '../utils/format'

function statusMeta(status) {
  if (status === 'paid') {
    return { label: 'Settled', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200' }
  }
  if (status === 'partial') {
    return { label: 'Partial', badge: 'bg-amber-100 text-amber-900 ring-amber-200' }
  }
  return { label: 'Unpaid', badge: 'bg-rose-100 text-rose-800 ring-rose-200' }
}

function StatCard({ label, value, sub, className = '' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${className}`}>
      <p className="text-sm font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm opacity-70">{sub}</p>}
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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [payments, setPayments] = useState({})
  const [methods, setMethods] = useState({})
  const [payingId, setPayingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get('/debts')
      .then((r) => setRows(r.data.items))
      .finally(() => setLoading(false))
  }, [])

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

  const summary = useMemo(() => {
    const outstanding = rows.reduce((s, d) => s + (d.balance || 0), 0)
    const totalCredit = rows.reduce((s, d) => s + (d.totalAmount || 0), 0)
    const collected = rows.reduce((s, d) => s + (d.amountPaid || 0), 0)
    return { outstanding, totalCredit, collected }
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
      const phone = (d.customerId?.phone || '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
  }, [rows, query, statusFilter])

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
    const method = methods[debtId] || 'cash'
    setPayingId(debtId)
    try {
      await api.post('/payments', { debtId, amount, method })
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
          subtitle="Credit sales & outstanding balances — record cash or POS payments"
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Outstanding"
            value={formatNaira(summary.outstanding)}
            sub={`${counts.active} account${counts.active !== 1 ? 's' : ''} with balance`}
            className="border-rose-200 bg-gradient-to-br from-rose-50 to-white"
          />
          <StatCard
            label="Collected"
            value={formatNaira(summary.collected)}
            sub="Paid toward credit sales"
            className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
          />
          <StatCard
            label="Partial"
            value={counts.partial}
            sub="Still owe after payment"
            className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-white"
          />
          <StatCard
            label="Total credit"
            value={formatNaira(summary.totalCredit)}
            sub="All credit sale amounts"
            className="border-slate-200 bg-white"
          />
        </div>

        <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="block min-w-0 flex-1 text-base">
              <span className="mb-1 block font-medium text-slate-700">Search debtor</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-base focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Name or phone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
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
          <p className="text-slate-500">Loading debts…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-4xl">✓</p>
            <p className="mt-3 text-lg font-semibold text-slate-800">
              {query || statusFilter !== 'active'
                ? 'No debts match your filters'
                : 'All clear — no outstanding debt'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {statusFilter === 'active' && !query
                ? 'Credit customers will appear here when they have a balance.'
                : 'Try another search or filter.'}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-base">
                <colgroup>
                  <col className="w-[16.8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[35.2%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-center text-sm uppercase tracking-wide text-white">
                    <th className="whitespace-nowrap p-3 font-semibold">Customer</th>
                    <th className="whitespace-nowrap p-3 font-semibold">Status</th>
                    <th className="whitespace-nowrap p-3 font-semibold">Total</th>
                    <th className="whitespace-nowrap p-3 font-semibold">Paid</th>
                    <th className="whitespace-nowrap p-3 font-semibold">Balance</th>
                    <th className="whitespace-nowrap p-3 font-semibold">Record payment</th>
                    <th className="whitespace-nowrap p-3 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, index) => {
                    const meta = statusMeta(d.status)
                    const name = d.customerId?.name || 'Customer'
                    const phone = d.customerId?.phone
                    const canPay = d.balance > 0
                    const isPaying = payingId === d._id

                    return (
                      <tr
                        key={d._id}
                        className={`border-b border-slate-200/80 transition-colors ${
                          index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/80 hover:bg-slate-100'
                        }`}
                      >
                        <td className="p-3 text-left align-middle">
                          <div className="mx-auto max-w-full">
                            <p className="truncate font-semibold text-slate-900" title={name}>
                              {name}
                            </p>
                            {phone && (
                              <p className="mt-0.5 truncate text-sm tabular-nums text-slate-500">{phone}</p>
                            )}
                            {d.createdAt && (
                              <p className="mt-1 whitespace-nowrap text-sm text-slate-400">
                                Since {formatDateTable(d.createdAt)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap p-3 text-center align-middle">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap p-3 text-center align-middle tabular-nums text-slate-700">
                          {formatNaira(d.totalAmount)}
                        </td>
                        <td className="whitespace-nowrap p-3 text-center align-middle tabular-nums text-emerald-800">
                          {formatNaira(d.amountPaid)}
                        </td>
                        <td className="whitespace-nowrap p-3 text-center align-middle font-bold tabular-nums text-rose-700">
                          {formatNaira(d.balance)}
                        </td>
                        <td className="p-3 text-center align-middle">
                          {canPay ? (
                            <div className="mx-auto flex w-full max-w-full flex-nowrap items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setQuickPay(d._id, d.balance)}
                                className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Full balance
                              </button>
                              <select
                                className="inline-flex h-10 w-[5.5rem] shrink-0 items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                value={methods[d._id] || 'cash'}
                                onChange={(e) =>
                                  setMethods({ ...methods, [d._id]: e.target.value })
                                }
                              >
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m} value={m}>
                                    {m === 'pos' ? 'POS' : 'Cash'}
                                  </option>
                                ))}
                              </select>
                              <NumericInput
                                placeholder="Amount"
                                className="h-10 min-w-[5rem] max-w-[8rem] flex-1 rounded-lg border border-slate-200 px-2 py-0 text-center text-base font-semibold tabular-nums leading-10 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                                className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-base font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                              >
                                {isPaying ? '…' : 'Record'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-base font-medium text-emerald-700">Settled</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap p-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(d)}
                            className="inline-flex h-10 items-center whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 text-base font-medium text-rose-700 hover:bg-rose-100"
                          >
                            Delete
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
    </PageShell>
  )
}
