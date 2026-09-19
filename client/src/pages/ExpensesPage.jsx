import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import PasswordDeleteDialog from '../components/PasswordDeleteDialog'
import { formatDateOnly, formatNaira } from '../utils/format'

const CATEGORIES = [
  'Operations',
  'Maintenance',
  'Fuel & Generator',
  'Transport & Logistics',
  'Offloading & Loaders',
  'Staff Wages',
  'Borrowed / IOU',
  'Utilities & Levies',
  'Other',
]

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState({ totalExpenses: 0, totalBorrowed: 0, totalPayable: 0 })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')
  const [typeFilter, setTypeFilter] = useState('all') // 'all', 'expense', 'borrowed', 'payable'
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Modal & Actions
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [formType, setFormType] = useState('expense') // 'expense', 'borrowed', 'payable'
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Operations')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [personName, setPersonName] = useState('')
  const [paid, setPaid] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (period !== 'all') params.append('period', period)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const res = await api.get(`/expenses?${params.toString()}`)
      setExpenses(res.data.items || [])
      setSummary(res.data.summary || { totalExpenses: 0, totalBorrowed: 0, totalPayable: 0 })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [period, typeFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!title.trim()) return toast.error('Please enter description')
    if (!amount || Number(amount) <= 0) return toast.error('Please enter a valid amount')

    setSaving(true)
    try {
      await api.post('/expenses', {
        title: title.trim(),
        category,
        type: formType,
        amount: Number(amount),
        paymentMethod,
        personName: personName.trim(),
        paid: formType === 'expense' ? paid : !paid,
        dueDate: dueDate || null,
        date: expenseDate,
        notes,
      })
      toast.success(
        formType === 'expense'
          ? 'Expense logged successfully'
          : formType === 'borrowed'
            ? 'Borrowed record saved'
            : 'Payable bill saved'
      )
      setModalOpen(false)
      // Reset form
      setTitle('')
      setAmount('')
      setPersonName('')
      setNotes('')
      setDueDate('')
      load()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to save record')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSettle = async (id) => {
    try {
      await api.patch(`/expenses/${id}/settle`)
      toast.success('Status updated')
      load()
    } catch (err) {
      console.error(err)
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (password) => {
    if (!deleteTarget) return
    try {
      await api.delete(`/expenses/${deleteTarget._id}`, { data: { password } })
      toast.success('Record deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to delete record')
    }
  }

  const filteredExpenses = expenses.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.title?.toLowerCase().includes(q) ||
      item.personName?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    )
  })

  return (
    <PageShell
      scroll={false}
      header={
        <PageHeader
          title="Daily Expenses & Payables"
          subtitle="Track daily shop expenses, staff & customer borrowed money (IOUs), and upcoming service payables"
        >
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800"
          >
            <span>+</span> Record Outlay / IOU
          </button>
        </PageHeader>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {/* Stat Cards */}
        <div className="grid shrink-0 gap-3 sm:grid-cols-3">
          <div className="glass-panel border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
              Shop Expenses ({PERIODS.find((p) => p.value === period)?.label || 'Period'})
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{formatNaira(summary.totalExpenses)}</p>
            <p className="mt-0.5 text-xs text-emerald-700">Fuel, light bulb, repairs, loaders, etc.</p>
          </div>
          <div className="glass-panel border-amber-200 bg-amber-50/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-800">Pending Payables (Bills)</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{formatNaira(summary.totalPayable)}</p>
            <p className="mt-0.5 text-xs text-amber-700">e.g. Electrician, pending service fees</p>
          </div>
          <div className="glass-panel border-rose-200 bg-rose-50/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-rose-800">Borrowed Money (IOUs)</p>
            <p className="mt-1 text-2xl font-bold text-rose-900">{formatNaira(summary.totalBorrowed)}</p>
            <p className="mt-0.5 text-xs text-rose-700">Pending return from staff or partners</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="glass-panel shrink-0 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>Period:</span>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium focus:border-emerald-500 focus:outline-none"
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </label>

              <div className="flex gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`rounded-md px-2.5 py-1 transition-all ${typeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('expense')}
                  className={`rounded-md px-2.5 py-1 transition-all ${typeFilter === 'expense' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Expenses
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('payable')}
                  className={`rounded-md px-2.5 py-1 transition-all ${typeFilter === 'payable' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Payables
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('borrowed')}
                  className={`rounded-md px-2.5 py-1 transition-all ${typeFilter === 'borrowed' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Borrowed (IOUs)
                </button>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search description or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-16 text-slate-500">
              Loading expenses…
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-700">No expenses or payables recorded</p>
              <p className="mt-1 text-sm text-slate-400">Click &quot;+ Record Outlay / IOU&quot; to log daily expenses or pending bills.</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 glass-table-head text-xs uppercase text-white">
                  <tr>
                    <th className="p-3 font-semibold">Description</th>
                    <th className="p-3 font-semibold">Category / Type</th>
                    <th className="p-3 font-semibold">Person / Vendor</th>
                    <th className="p-3 text-right font-semibold">Amount</th>
                    <th className="p-3 text-center font-semibold">Method</th>
                    <th className="p-3 text-center font-semibold">Status</th>
                    <th className="p-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((it, idx) => {
                    const isPending = it.status === 'pending'
                    return (
                      <tr key={it._id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'}>
                        <td className="p-3 align-top">
                          <p className="font-bold text-slate-900">{it.title}</p>
                          <p className="text-xs text-slate-400">{formatDateOnly(it.date)}</p>
                          {it.notes && <p className="mt-1 text-xs text-slate-500 italic">&ldquo;{it.notes}&rdquo;</p>}
                        </td>
                        <td className="p-3 align-top">
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {it.category}
                          </span>
                          <span className="ml-1.5 text-[11px] font-medium text-slate-500 capitalize">
                            ({it.type})
                          </span>
                        </td>
                        <td className="p-3 align-top">
                          {it.personName ? (
                            <p className="font-semibold text-slate-800">{it.personName}</p>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                          {it.dueDate && (
                            <p className="text-[11px] text-amber-700 font-medium">Due: {formatDateOnly(it.dueDate)}</p>
                          )}
                        </td>
                        <td className="p-3 text-right align-top font-bold tabular-nums text-slate-900">
                          {formatNaira(it.amount)}
                        </td>
                        <td className="p-3 text-center align-top text-xs uppercase font-semibold text-slate-600">
                          {it.paymentMethod}
                        </td>
                        <td className="p-3 text-center align-top">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isPending ? 'Pending' : 'Settled'}
                          </span>
                        </td>
                        <td className="p-3 text-center align-top">
                          <div className="flex items-center justify-center gap-1.5">
                            {(it.type === 'payable' || it.type === 'borrowed') && (
                              <button
                                type="button"
                                onClick={() => handleToggleSettle(it._id)}
                                className={`rounded px-2 py-1 text-xs font-bold ${
                                  isPending
                                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                {isPending ? '✓ Mark Settled' : 'Reopen'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(it)}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Delete record"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Record Outlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="glass-panel flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Expense, IOU or Payable</h3>
                <p className="text-xs text-slate-500">Log cash paid out, money borrowed, or pending vendor fees.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-xs font-bold ${formType === 'expense' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <input
                      type="radio"
                      name="formType"
                      className="sr-only"
                      checked={formType === 'expense'}
                      onChange={() => {
                        setFormType('expense')
                        setCategory('Operations')
                      }}
                    />
                    <span>Shop Expense</span>
                    <span className="text-[10px] font-normal text-slate-500">Paid out now</span>
                  </label>
                  <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-xs font-bold ${formType === 'payable' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <input
                      type="radio"
                      name="formType"
                      className="sr-only"
                      checked={formType === 'payable'}
                      onChange={() => {
                        setFormType('payable')
                        setCategory('Maintenance')
                      }}
                    />
                    <span>Payable (Bill)</span>
                    <span className="text-[10px] font-normal text-slate-500">To pay later</span>
                  </label>
                  <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-xs font-bold ${formType === 'borrowed' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <input
                      type="radio"
                      name="formType"
                      className="sr-only"
                      checked={formType === 'borrowed'}
                      onChange={() => {
                        setFormType('borrowed')
                        setCategory('Borrowed / IOU')
                      }}
                    />
                    <span>Borrowed (IOU)</span>
                    <span className="text-[10px] font-normal text-slate-500">Collected money</span>
                  </label>
                </div>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Description / Title *</span>
                <input
                  type="text"
                  required
                  placeholder={
                    formType === 'expense'
                      ? 'e.g. Fixed light bulb, 20L generator diesel'
                      : formType === 'payable'
                        ? 'e.g. Electrician to rewire cooler fan'
                        : 'e.g. Transport money taken by driver'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Amount (₦) *</span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>

              {(formType === 'borrowed' || formType === 'payable') && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">Person / Vendor Name</span>
                    <input
                      type="text"
                      placeholder={formType === 'borrowed' ? 'Who borrowed?' : 'Who to pay? (e.g. Electrician)'}
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">Due Date (Optional)</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Payment Method</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="cash">Cash (from drawer)</option>
                    <option value="pos">POS</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="unpaid">Unpaid / Pending</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Date</span>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Notes (Optional)</span>
                <input
                  type="text"
                  placeholder="Extra details or instructions"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : '✓ Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <PasswordDeleteDialog
        open={!!deleteTarget}
        title="Delete Expense / IOU Record"
        message={
          deleteTarget
            ? `Are you sure you want to remove "${deleteTarget.title}" (${formatNaira(deleteTarget.amount)})?`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </PageShell>
  )
}
