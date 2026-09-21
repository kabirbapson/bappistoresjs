import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import PaymentReceipt from '../components/PaymentReceipt'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import PasswordDeleteDialog from '../components/PasswordDeleteDialog'
import api from '../api'
import { deleteWithPassword } from '../utils/secureDelete'
import { formatDateOnly, formatNaira, formatDate } from '../utils/format'

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

const emptyForm = { customerName: '', description: '', totalAmount: '', amountPaid: '', paymentMethod: 'cash' }
const emptyTransaction = { amount: '', reason: '', method: 'cash' }

export default function NotesPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [receiptData, setReceiptData] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const [transactionModal, setTransactionModal] = useState(null) // { note, type: 'borrow' | 'payment' }
  const [transForm, setTransForm] = useState(emptyTransaction)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [historyModal, setHistoryModal] = useState(null) // { note, transactions: [] }
  const [loadingHistory, setLoadingHistory] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get(`/notes`)
      .then((r) => setRows(r.data))
      .catch(() => {
        toast.error('Could not load cash notes')
        setRows([])
      })
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((d) => {
      if (statusFilter === 'active' && d.balance <= 0) return false
      if (statusFilter !== 'all' && statusFilter !== 'active' && d.status !== statusFilter) {
        return false
      }
      if (!q) return true
      const name = (d.customerName || '').toLowerCase()
      const desc = (d.description || '').toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [rows, query, statusFilter])

  const summary = useMemo(() => {
    const outstanding = filtered.reduce((s, d) => s + (d.balance || 0), 0)
    const totalNotes = filtered.reduce((s, d) => s + (d.totalAmount || 0), 0)
    const totalPaid = filtered.reduce((s, d) => s + (d.amountPaid || 0), 0)
    return {
      outstanding,
      totalNotes,
      totalPaid,
    }
  }, [filtered])

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!form.customerName || !form.totalAmount) return toast.error('Name and amount are required')
      try {
        const res = await api.post('/notes', {
          ...form,
          totalAmount: Number(form.totalAmount),
          amountPaid: Number(form.amountPaid || 0)
        })
        const newNote = res.data
        toast.success('Note recorded successfully')
        
        setReceiptData({
          _id: newNote._id,
          name: newNote.customerName,
          customerName: newNote.customerName,
          isCustomer: true,
          previousBalance: 0,
          amount: newNote.totalAmount,
          balance: newNote.balance,
          method: 'CASH',
          date: new Date(),
          recordedBy: 'Admin',
          reason: newNote.description || 'Initial note amount',
          isBorrow: true
        })

        setForm(emptyForm)
        setShowAddModal(false)
        load()
      } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record note')
    }
  }

  const openTransactionModal = (note, type) => {
    setTransactionModal({ note, type })
    setTransForm(emptyTransaction)
  }

  const handleTransactionSubmit = async (e) => {
    e.preventDefault()
    const { note, type } = transactionModal
    const amount = Number(transForm.amount)
    
    if (!amount || amount <= 0) {
      return toast.error('Enter a valid amount')
    }
    if (type === 'payment' && amount > note.balance) {
      return toast.error(`Maximum payment is ${formatNaira(note.balance)}`)
    }
    if (!transForm.reason.trim()) {
      return toast.error('Please enter a reason/note')
    }

    setIsSubmitting(true)
    try {
      const endpoint = type === 'payment' ? `/notes/${note._id}/pay` : `/notes/${note._id}/borrow`
      await api.post(endpoint, {
        amount,
        reason: transForm.reason,
        method: transForm.method
      })
      toast.success(type === 'payment' ? 'Payment recorded' : 'Debt increased')
      
      setReceiptData({
        _id: note._id,
        name: note.customerName,
        customerName: note.customerName,
        isCustomer: true,
        previousBalance: note.balance,
        amount: amount,
        balance: type === 'payment' ? note.balance - amount : note.balance + amount,
        method: type === 'payment' ? transForm.method.toUpperCase() : 'CASH',
        date: new Date(),
        recordedBy: 'Admin',
        reason: transForm.reason,
        isBorrow: type === 'borrow'
      })

      setTransactionModal(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transaction failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const viewHistory = async (note) => {
    setHistoryModal({ note, transactions: [] })
    setLoadingHistory(true)
    try {
      const r = await api.get(`/notes/${note._id}/transactions`)
      
      // Calculate running balance by walking backwards from current balance
      let currentBal = note.balance;
      const annotatedTxs = r.data.map(tx => {
        const balAfterTx = currentBal;
        let balBeforeTx = 0;
        if (tx.type === 'payment') {
           balBeforeTx = currentBal + tx.amount;
        } else {
           balBeforeTx = currentBal - tx.amount;
        }
        currentBal = balBeforeTx;
        return { ...tx, balance: balAfterTx, previousBalance: balBeforeTx }
      });

      setHistoryModal({ note, transactions: annotatedTxs })
    } catch (err) {
      toast.error('Failed to load transaction history')
      setHistoryModal(null)
    } finally {
      setLoadingHistory(false)
    }
  }

  const reprintTransaction = (tx) => {
    const isBorrow = tx.type === 'borrow';
    setReceiptData({
      _id: tx._id,
      name: historyModal.note.customerName,
      customerName: historyModal.note.customerName,
      isCustomer: true,
      previousBalance: tx.previousBalance,
      amount: tx.amount,
      balance: tx.balance,
      method: tx.method ? tx.method.toUpperCase() : 'CASH',
      date: tx.date,
      recordedBy: tx.recordedBy || 'Admin',
      reason: tx.reason,
      isBorrow: isBorrow
    });
  }

  const printStatement = (note) => {
    setReceiptData({
      _id: note._id,
      name: note.customerName,
      customerName: note.customerName,
      isCustomer: true,
      previousBalance: note.totalAmount,
      amount: note.amountPaid,
      balance: note.balance,
      method: note.status.toUpperCase(),
      date: new Date(),
      recordedBy: 'Admin',
      reason: "Account Statement Summary",
      isStatement: true
    });
  }

  const confirmDeleteNote = async (password) => {
    if (!deleteTarget) return
    try {
      await deleteWithPassword(`/notes/${deleteTarget._id}`, password)
      toast.success('Note deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete note')
      throw err
    }
  }

  return (
    <PageShell
      scroll={false}
      header={
        <PageHeader
          title="Cash Notes Ledger"
          subtitle="Manually track cash loans, informal debt, or borrowed goods over time."
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
            label="Total Paid"
            value={formatNaira(summary.totalPaid)}
            sub="All payments recorded here"
          />
          <StatCard
            accent="amber"
            label="Partial"
            value={counts.partial}
            sub="Still owe after payment"
          />
          <StatCard
            accent="slate"
            label="Total Note Value"
            value={formatNaira(summary.totalNotes)}
            sub="All time total value"
          />
        </div>

        <div className="glass-panel shrink-0 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
              <label className="block min-w-[240px] flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700">Search ledger</span>
                <input
                  className="glass-input w-full p-2.5 text-sm"
                  placeholder="Search by name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 h-[42px]"
              >
                + New Ledger Account
              </button>
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
            <p className="text-slate-500">Loading ledger…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel flex flex-1 flex-col items-center justify-center border-dashed border-slate-300 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
              ✓
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-800">
              {query || statusFilter !== 'active'
                ? 'No ledger accounts match your filters'
                : 'All clear — no outstanding debts'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {statusFilter === 'active' && !query
                ? 'Accounts will appear here when they have a balance.'
                : 'Try another search or filter.'}
            </p>
          </div>
        ) : (
          <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{filtered.length}</span> account
                {filtered.length !== 1 ? 's' : ''} shown
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="glass-table-head text-left text-xs uppercase tracking-wide text-white">
                    <th className="p-3 font-semibold">Name & Initial Note</th>
                    <th className="p-3 text-center font-semibold">Status</th>
                    <th className="p-3 text-right font-semibold">Total Borrowed</th>
                    <th className="p-3 text-right font-semibold">Total Paid</th>
                    <th className="p-3 text-right font-semibold">Current Balance</th>
                    <th className="p-3 text-center font-semibold">Update Account</th>
                    <th className="w-20 p-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, index) => {
                    const meta = statusMeta(d.status)
                    const name = d.customerName || 'Customer'
                    const canPay = d.balance > 0

                    return (
                      <tr
                        key={d._id}
                        onClick={() => printStatement(d)}
                        className={`border-b border-slate-100 transition-colors cursor-pointer ${
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
                              {d.description && (
                                <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{d.description}</p>
                              )}
                              {d.date && (
                                <span className="text-[10px] text-slate-400">
                                  {formatDateOnly(d.date)}
                                </span>
                              )}
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
                          {formatNaira(d.amountPaid)}
                        </td>
                        <td
                          className={`whitespace-nowrap p-3 text-right align-middle font-bold tabular-nums ${
                            canPay ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatNaira(d.balance)}
                        </td>
                        <td className="p-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTransactionModal(d, 'borrow');
                              }}
                              className="rounded bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100"
                            >
                              + Borrow
                            </button>
                            <button
                              type="button"
                              disabled={!canPay}
                              onClick={(e) => {
                                e.stopPropagation();
                                openTransactionModal(d, 'payment');
                              }}
                              className="rounded bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              - Pay
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                printStatement(d);
                              }}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                              title="Print Account Statement"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v3.396c0 .662.53 1.204 1.2 1.204h8.1c.67 0 1.2-.542 1.2-1.204V9.75Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                viewHistory(d);
                              }}
                              className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"
                              title="View Ledger History"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(d);
                              }}
                              className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Delete Account"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.045-.112a.75.75 0 0 1 .256-1.478 48.567 48.567 0 0 1 3.878-.512V4.478a3 3 0 0 1 3-2.983V3.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v.745a3 3 0 0 1 3 2.983ZM9.75 6.75v7.5a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-1.5 0Zm3 0v7.5a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-1.5 0Z" clipRule="evenodd" /></svg>
                            </button>
                          </div>
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

      {/* Add New Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold">New Ledger Account</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  className="w-full rounded-md border p-2"
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Initial Reason/Note</label>
                <input
                  className="w-full rounded-md border p-2"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Borrowed 5k cash"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Initial Amount ₦</label>
                <input
                  type="number"
                  className="w-full rounded-md border p-2"
                  value={form.totalAmount}
                  onChange={e => setForm({ ...form, totalAmount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Initial Payment ₦ (Optional)</label>
                <input
                  type="number"
                  className="w-full rounded-md border p-2"
                  value={form.amountPaid}
                  onChange={e => setForm({ ...form, amountPaid: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-md px-4 py-2 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 font-medium">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal (Borrow/Pay) */}
      {transactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold">
              {transactionModal.type === 'payment' ? 'Record Payment' : 'Add Debt (Borrow)'} for {transactionModal.note.customerName}
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              Current Balance: <strong className="text-slate-800">{formatNaira(transactionModal.note.balance)}</strong>
            </p>
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Amount ₦</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="w-full rounded-md border p-2"
                    value={transForm.amount}
                    onChange={e => setTransForm({ ...transForm, amount: e.target.value })}
                    required
                  />
                  {transactionModal.type === 'payment' && (
                    <button
                      type="button"
                      className="shrink-0 rounded bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200"
                      onClick={() => setTransForm({ ...transForm, amount: String(transactionModal.note.balance) })}
                    >
                      Full
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reason / Note</label>
                <input
                  className="w-full rounded-md border p-2"
                  value={transForm.reason}
                  onChange={e => setTransForm({ ...transForm, reason: e.target.value })}
                  placeholder={transactionModal.type === 'payment' ? "e.g. Paid via transfer" : "e.g. Took 2 crates of drinks"}
                  required
                />
              </div>
              {transactionModal.type === 'payment' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Payment Method</label>
                  <select
                    className="w-full rounded-md border p-2"
                    value={transForm.method}
                    onChange={e => setTransForm({ ...transForm, method: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                    <option value="pos">POS</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setTransactionModal(null)}
                  className="rounded-md px-4 py-2 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`rounded-md px-4 py-2 text-white font-medium ${
                    transactionModal.type === 'payment' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : (transactionModal.type === 'payment' ? 'Record Payment' : 'Add Debt')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-xl font-bold">Ledger History: {historyModal.note.customerName}</h3>
              <button onClick={() => setHistoryModal(null)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 border rounded-lg">
              {loadingHistory ? (
                <div className="p-8 text-center text-slate-500">Loading ledger...</div>
              ) : historyModal.transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No transactions found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 border-b">
                    <tr>
                      <th className="p-3 text-left font-semibold">Date</th>
                      <th className="p-3 text-left font-semibold">Type</th>
                      <th className="p-3 text-left font-semibold">Reason</th>
                      <th className="p-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyModal.transactions.map((tx) => (
                      <tr 
                        key={tx._id} 
                        className="hover:bg-indigo-50 cursor-pointer transition-colors"
                        onClick={() => reprintTransaction(tx)}
                        title="Click to print this transaction receipt"
                      >
                        <td className="p-3 text-slate-600">{formatDate(tx.date)}</td>
                        <td className="p-3">
                          {tx.type === 'borrow' ? (
                            <span className="text-rose-700 font-medium">Borrow</span>
                          ) : (
                            <span className="text-emerald-700 font-medium">Payment</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-800">{tx.reason || '-'}</td>
                        <td className="p-3 text-right font-bold tabular-nums">
                          {formatNaira(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between shrink-0 font-medium">
              <span className="text-slate-600">Current Balance</span>
              <span className="text-rose-700 text-lg">{formatNaira(historyModal.note.balance)}</span>
            </div>
          </div>
        </div>
      )}

      <PasswordDeleteDialog
        open={!!deleteTarget}
        title="Delete Account"
        message={
          deleteTarget
            ? `Remove the ledger account for ${deleteTarget.customerName}? Payment history will be permanently deleted.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteNote}
      />

      {receiptData && (
        <PaymentReceipt
          payment={receiptData}
          title={receiptData.isStatement ? "ACCOUNT STATEMENT" : receiptData.isBorrow ? "CASH NOTE / LEDGER RECORD" : "CUSTOMER PAYMENT RECEIPT"}
          type={receiptData.isStatement ? "Ledger Summary" : receiptData.isBorrow ? "Cash Borrowed / Goods Taken" : "Note Payment"}
          labels={receiptData.isStatement ? {
            amount: "Total Paid ₦:",
            type: "Document Type:",
            date: "Statement Date:",
            method: "Account Status:"
          } : receiptData.isBorrow ? {
            amount: "Amount Borrowed ₦:",
            type: "Transaction Type:",
            date: "Date:",
            method: "Method:"
          } : undefined}
          onClose={() => setReceiptData(null)}
        />
      )}
    </PageShell>
  )
}
