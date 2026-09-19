import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import PasswordDeleteDialog from '../components/PasswordDeleteDialog'
import StoreLogo from '../components/StoreLogo'
import { STORE_ADDRESSES, STORE_NAME, STORE_PHONES } from '../constants'
import { formatDateOnly, formatNaira } from '../utils/format'

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

export default function ReceiveStockPage() {
  const [purchases, setPurchases] = useState([])
  const [summary, setSummary] = useState({ totalPurchases: 0, totalPaid: 0, totalBalance: 0, count: 0 })
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Modals & Actions
  const [modalOpen, setModalOpen] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [voucherTarget, setVoucherTarget] = useState(null)

  // New Delivery Form state
  const [supplierName, setSupplierName] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentTerms, setPaymentTerms] = useState('credit') // 'paid', 'credit', 'partial'
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ productId: '', productName: '', quantity: '', costPrice: '', totalCost: 0 }])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (period !== 'all') params.append('period', period)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const [resPurchases, resProducts] = await Promise.all([
        api.get(`/stock-purchases?${params.toString()}`),
        api.get('/products?limit=500'),
      ])
      setPurchases(resPurchases.data?.items || [])
      setSummary(resPurchases.data?.summary || { totalPurchases: 0, totalPaid: 0, totalBalance: 0, count: 0 })
      const productList = resProducts.data?.items || (Array.isArray(resProducts.data) ? resProducts.data : [])
      setProducts(Array.isArray(productList) ? productList : [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load stock deliveries')
    } finally {
      setLoading(false)
    }
  }, [period, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  // Calculation helpers for new delivery form
  const handleItemProductChange = (index, prodId) => {
    const prod = products.find((p) => String(p._id) === String(prodId))
    const next = [...items]
    next[index].productId = prodId
    next[index].productName = prod ? prod.name : ''
    next[index].costPrice = prod ? prod.costPrice || '' : ''
    const qty = Number(next[index].quantity || 0)
    const cost = Number(next[index].costPrice || 0)
    next[index].totalCost = qty * cost
    setItems(next)
  }

  const handleItemQtyChange = (index, qty) => {
    const next = [...items]
    next[index].quantity = qty
    const cost = Number(next[index].costPrice || 0)
    next[index].totalCost = Number(qty || 0) * cost
    setItems(next)
  }

  const handleItemCostChange = (index, cost) => {
    const next = [...items]
    next[index].costPrice = cost
    const qty = Number(next[index].quantity || 0)
    next[index].totalCost = qty * Number(cost || 0)
    setItems(next)
  }

  const addItemRow = () => {
    setItems([...items, { productId: '', productName: '', quantity: '', costPrice: '', totalCost: 0 }])
  }

  const removeItemRow = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const formTotalAmount = items.reduce((s, it) => s + (Number(it.totalCost) || 0), 0)

  const calculatedAmountPaid =
    paymentTerms === 'paid'
      ? formTotalAmount
      : paymentTerms === 'credit'
        ? 0
        : Math.min(formTotalAmount, Number(amountPaid) || 0)

  const calculatedBalance = Math.max(0, formTotalAmount - calculatedAmountPaid)

  const handleSaveDelivery = async (e) => {
    e.preventDefault()
    if (!supplierName.trim()) {
      return toast.error('Please enter supplier or dealer name')
    }
    const validItems = items.filter((it) => it.productId && Number(it.quantity) > 0)
    if (validItems.length === 0) {
      return toast.error('Please add at least one product with quantity')
    }

    setSaving(true)
    try {
      await api.post('/stock-purchases', {
        supplierName: supplierName.trim(),
        date: deliveryDate,
        items: validItems,
        totalAmount: formTotalAmount,
        amountPaid: calculatedAmountPaid,
        paymentMethod,
        notes,
      })
      toast.success('Stock received and inventory updated!')
      setModalOpen(false)
      // Reset form
      setSupplierName('')
      setItems([{ productId: '', productName: '', quantity: '', costPrice: '', totalCost: 0 }])
      setAmountPaid('')
      setNotes('')
      load()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to record delivery')
    } finally {
      setSaving(false)
    }
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (!payTarget) return
    const amt = Number(payAmount)
    if (!amt || amt <= 0) return toast.error('Enter a valid amount')
    try {
      await api.post(`/stock-purchases/${payTarget._id}/pay`, { amount: amt })
      toast.success('Payment recorded successfully')
      setPayTarget(null)
      setPayAmount('')
      load()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to record payment')
    }
  }

  const handleDelete = async (password) => {
    if (!deleteTarget) return
    try {
      await api.delete(`/stock-purchases/${deleteTarget._id}`, { data: { password } })
      toast.success('Delivery record deleted and stock reversed')
      setDeleteTarget(null)
      load()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to delete record')
    }
  }

  const filteredPurchases = purchases.filter((p) => {
    if (!search.trim()) return true
    return p.supplierName?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <PageShell
      scroll={false}
      header={
        <PageHeader
          title="Receive Stock"
          subtitle="Record deliveries from dealers & distributors, update stock automatically, and manage supplier credit"
        >
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800"
          >
            <span>+</span> Receive Stock
          </button>
        </PageHeader>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {/* Stat Cards */}
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-panel p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Goods Received</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatNaira(summary.totalPurchases)}</p>
            <p className="mt-0.5 text-xs text-slate-500">{summary.count} delivery batch{summary.count !== 1 ? 'es' : ''}</p>
          </div>
          <div className="glass-panel border-rose-200 bg-rose-50/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-rose-700">Dealer Credit Owed</p>
            <p className="mt-1 text-2xl font-bold text-rose-800">{formatNaira(summary.totalBalance)}</p>
            <p className="mt-0.5 text-xs text-rose-600">Pending payment to suppliers</p>
          </div>
          <div className="glass-panel border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Total Amount Paid</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{formatNaira(summary.totalPaid)}</p>
            <p className="mt-0.5 text-xs text-emerald-600">Paid in advance or settled</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Catalog Products</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{products.length}</p>
            <p className="mt-0.5 text-xs text-slate-500">Available to restock</p>
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
                  onClick={() => setStatusFilter('all')}
                  className={`rounded-md px-2.5 py-1 transition-all ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('credit')}
                  className={`rounded-md px-2.5 py-1 transition-all ${statusFilter === 'credit' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Dealer Credit
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={`rounded-md px-2.5 py-1 transition-all ${statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Settled
                </button>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search dealer/supplier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Deliveries Table */}
        <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-16 text-slate-500">
              Loading delivery records…
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-700">No stock delivery records found</p>
              <p className="mt-1 text-sm text-slate-400">Click &quot;+ Receive Stock&quot; to log goods supplied by dealers.</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 glass-table-head text-xs uppercase text-white">
                  <tr>
                    <th className="p-3 font-semibold">Dealer / Supplier</th>
                    <th className="p-3 font-semibold">Goods Supplied</th>
                    <th className="p-3 text-right font-semibold">Total Cost</th>
                    <th className="p-3 text-right font-semibold">Paid</th>
                    <th className="p-3 text-right font-semibold">Balance</th>
                    <th className="p-3 text-center font-semibold">Status</th>
                    <th className="p-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchases.map((p, idx) => {
                    const owes = (p.balance || 0) > 0
                    return (
                      <tr key={p._id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'}>
                        <td className="p-3 align-top">
                          <p className="font-bold text-slate-900">{p.supplierName}</p>
                          <p className="text-xs text-slate-400">{formatDateOnly(p.date)}</p>
                          {p.notes && <p className="mt-1 text-xs text-slate-500 italic">&ldquo;{p.notes}&rdquo;</p>}
                        </td>
                        <td className="p-3 align-top">
                          <ul className="space-y-1 text-xs">
                            {p.items?.map((it, i) => (
                              <li key={i} className="text-slate-700">
                                <span className="font-semibold text-slate-900">{it.quantity}x</span> {it.productName}{' '}
                                <span className="text-slate-400">(@ {formatNaira(it.costPrice)})</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="p-3 text-right align-top font-semibold tabular-nums text-slate-900">
                          {formatNaira(p.totalAmount)}
                        </td>
                        <td className="p-3 text-right align-top font-semibold tabular-nums text-emerald-800">
                          {formatNaira(p.amountPaid)}
                        </td>
                        <td className={`p-3 text-right align-top font-bold tabular-nums ${owes ? 'text-rose-700' : 'text-slate-400'}`}>
                          {formatNaira(p.balance || 0)}
                        </td>
                        <td className="p-3 text-center align-top">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              owes ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {owes ? 'Owing Dealer' : 'Settled'}
                          </span>
                        </td>
                        <td className="p-3 text-center align-top">
                          <div className="flex items-center justify-center gap-1.5">
                            {owes && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayTarget(p)
                                  setPayAmount(String(p.balance))
                                }}
                                className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setVoucherTarget(p)}
                              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                              title="Print voucher"
                            >
                              📄
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Delete delivery"
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

      {/* Modal: New Stock Delivery */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="glass-panel flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Receive Stock from Dealer / Supplier</h3>
                <p className="text-xs text-slate-500">Record incoming goods, set dealer terms, and update inventory counts.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDelivery} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Dealer / Supplier Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nigerian Bottling Co, 7Up, Alhaji Bello"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-slate-700">Delivery Date</span>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">Goods Supplied *</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    + Add another product
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <select
                          required
                          value={it.productId}
                          onChange={(e) => handleItemProductChange(idx, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">Select product to restock…</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} (Current: {p.quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={it.quantity}
                          onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-center text-sm font-bold focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          required
                          placeholder="Cost (₦)"
                          value={it.costPrice}
                          onChange={(e) => handleItemCostChange(idx, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="w-28 text-right font-bold text-slate-800 tabular-nums">
                        {formatNaira(it.totalCost || 0)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Payment terms */}
              <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 space-y-3">
                <div className="flex items-center justify-between text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
                  <span>Grand Total:</span>
                  <span>{formatNaira(formTotalAmount)}</span>
                </div>

                <div>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Payment Terms</span>
                  <div className="grid grid-cols-3 gap-2">
                    <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-xs font-bold ${paymentTerms === 'credit' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                      <input
                        type="radio"
                        name="terms"
                        className="sr-only"
                        checked={paymentTerms === 'credit'}
                        onChange={() => setPaymentTerms('credit')}
                      />
                      <span>Dealer Credit</span>
                      <span className="text-[10px] font-normal text-slate-500">Pay dealer later</span>
                    </label>
                    <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-xs font-bold ${paymentTerms === 'paid' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                      <input
                        type="radio"
                        name="terms"
                        className="sr-only"
                        checked={paymentTerms === 'paid'}
                        onChange={() => setPaymentTerms('paid')}
                      />
                      <span>Paid in Full</span>
                      <span className="text-[10px] font-normal text-slate-500">Paid advance / cash</span>
                    </label>
                    <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 text-xs font-bold ${paymentTerms === 'partial' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                      <input
                        type="radio"
                        name="terms"
                        className="sr-only"
                        checked={paymentTerms === 'partial'}
                        onChange={() => setPaymentTerms('partial')}
                      />
                      <span>Partial Paid</span>
                      <span className="text-[10px] font-normal text-slate-500">Part paid, part credit</span>
                    </label>
                  </div>
                </div>

                {paymentTerms !== 'credit' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-semibold text-slate-700">Amount Paid Now (₦)</span>
                      <input
                        type="number"
                        min="0"
                        max={formTotalAmount}
                        value={paymentTerms === 'paid' ? formTotalAmount : amountPaid}
                        disabled={paymentTerms === 'paid'}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-semibold text-slate-700">Payment Method</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="cash">Cash</option>
                        <option value="pos">POS</option>
                        <option value="transfer">Bank Transfer</option>
                      </select>
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm font-bold pt-1">
                  <span className="text-slate-600">Remaining Balance Owed:</span>
                  <span className={calculatedBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    {formatNaira(calculatedBalance)}
                  </span>
                </div>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Notes / Waybill / Driver</span>
                <input
                  type="text"
                  placeholder="Optional driver name, waybill # or notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
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
                  {saving ? 'Recording…' : '✓ Save & Restock Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pay Dealer Balance */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Pay Dealer Balance</h3>
            <p className="mt-1 text-sm text-slate-600">
              Supplier: <span className="font-bold text-slate-800">{payTarget.supplierName}</span>
            </p>
            <p className="text-sm text-rose-700 font-semibold">
              Outstanding Balance: {formatNaira(payTarget.balance)}
            </p>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Payment Amount (₦)</span>
                <input
                  type="number"
                  min="1"
                  max={payTarget.balance}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delivery Voucher Preview */}
      {voucherTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="glass-panel flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <StoreLogo className="h-10 w-auto" />
                <h4 className="mt-2 text-lg font-bold text-slate-900">{STORE_NAME}</h4>
                <p className="text-xs text-slate-500">{STORE_ADDRESSES[0]}</p>
                <p className="text-xs text-slate-500">Tel: {STORE_PHONES.join(', ')}</p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 uppercase">
                  Delivery Voucher
                </span>
                <p className="mt-1 text-xs text-slate-500">{formatDateOnly(voucherTarget.date)}</p>
              </div>
            </div>

            <div className="mt-4 text-xs space-y-1">
              <p><span className="font-semibold text-slate-700">Supplier:</span> {voucherTarget.supplierName}</p>
              {voucherTarget.notes && <p><span className="font-semibold text-slate-700">Notes:</span> {voucherTarget.notes}</p>}
            </div>

            <table className="mt-4 w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 font-bold">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Cost</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {voucherTarget.items?.map((it, i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium">{it.productName}</td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-right">{formatNaira(it.costPrice)}</td>
                    <td className="py-2 text-right font-semibold">{formatNaira(it.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 border-t border-slate-200 pt-3 text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-sm">
                <span>Grand Total:</span>
                <span>{formatNaira(voucherTarget.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>Amount Paid:</span>
                <span>{formatNaira(voucherTarget.amountPaid)}</span>
              </div>
              <div className="flex justify-between font-bold text-rose-700">
                <span>Balance Owed:</span>
                <span>{formatNaira(voucherTarget.balance || 0)}</span>
              </div>
            </div>

            <div className="mt-8 flex justify-between border-t border-dashed border-slate-300 pt-4 text-center text-[10px] text-slate-500">
              <div>
                <div className="w-28 border-b border-slate-400 mb-1"></div>
                <p>Received By</p>
              </div>
              <div>
                <div className="w-28 border-b border-slate-400 mb-1"></div>
                <p>Dealer Signature</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoucherTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800"
              >
                🖨 Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <PasswordDeleteDialog
        open={!!deleteTarget}
        title="Delete Stock Delivery Record"
        message={
          deleteTarget
            ? `Remove delivery record from ${deleteTarget.supplierName}? This will automatically subtract the delivered quantities from product stock counts.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </PageShell>
  )
}
