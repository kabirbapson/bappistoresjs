import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ProductPickerPanel from './ProductPickerPanel'
import SaleCartRow from './SaleCartRow'
import SalePaymentSection from './SalePaymentSection'
import CustomerPicker, { WALK_IN } from './CustomerPicker'
import api from '../api'
import { formatNaira } from '../utils/format'

export default function EditSaleDialog({ saleId, invoiceNumber, onClose, onSaved }) {
  const [products, setProducts] = useState([])
  const [originalQty, setOriginalQty] = useState({})
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState([])
  const [form, setForm] = useState({
    customerPick: WALK_IN,
    walkInName: '',
    note: '',
  })
  const [payments, setPayments] = useState([{ method: 'cash', amount: '' }])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, saleRes] = await Promise.all([
        api.get('/products?limit=500'),
        api.get(`/sales/${saleId}`),
      ])
      const sale = saleRes.data
      setProducts(p.data.items)

      const qtyMap = {}
      const lines = (sale.items || []).map((item) => {
        const pid = String(item.productId)
        qtyMap[pid] = item.quantity
        return {
          productId: pid,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }
      })
      setOriginalQty(qtyMap)
      setCart(lines)

      const payRows =
        sale.payments?.length > 0
          ? sale.payments.map((row) => ({
              method: row.method || 'cash',
              amount: String(row.amount ?? ''),
            }))
          : [{ method: 'cash', amount: String(sale.amountPaid || sale.totalAmount || '') }]

      setPayments(payRows)
      setForm({
        customerPick: sale.customerId
          ? String(sale.customerId?._id ?? sale.customerId)
          : WALK_IN,
        walkInName: sale.customerId ? '' : sale.customerName || '',
        note: sale.note || '',
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load invoice')
      onClose()
    } finally {
      setLoading(false)
    }
  }, [saleId, onClose])

  useEffect(() => {
    load()
  }, [load])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name?.toLowerCase().includes(q))
  }, [products, productSearch])

  const lineUnitPrice = (line, product) =>
    line.unitPrice != null ? line.unitPrice : product?.sellingPrice ?? 0

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, line) => {
      const p = products.find((x) => x._id === line.productId)
      return sum + (p ? lineUnitPrice(line, p) * line.quantity : 0)
    }, 0)
  }, [cart, products])

  const customerOk = useMemo(() => {
    if (form.customerPick === WALK_IN) return !!form.walkInName.trim()
    return !!form.customerPick
  }, [form.customerPick, form.walkInName])

  const paidNow = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments],
  )

  const creditBalance = Math.max(0, cartTotal - paidNow)
  const needsRegisteredCustomer =
    creditBalance > 0 && (form.customerPick === WALK_IN || !form.customerPick)

  const maxQtyForProduct = (productId) => {
    const p = products.find((x) => x._id === productId)
    if (!p) return 0
    return p.quantity + (originalQty[productId] || 0)
  }

  const addProduct = (productId) => {
    const p = products.find((x) => x._id === productId)
    if (!p) return
    const max = maxQtyForProduct(productId)
    if (max <= 0) return

    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        if (existing.quantity >= max) {
          toast.error(`Only ${max} of ${p.name} available for this invoice`)
          return prev
        }
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [...prev, { productId, quantity: 1, unitPrice: p.sellingPrice }]
    })
  }

  const updateCartPrice = (productId, nextPrice) => {
    const p = products.find((x) => x._id === productId)
    if (!p) return
    if (nextPrice === '' || nextPrice === null) {
      setCart((prev) =>
        prev.map((l) =>
          l.productId === productId ? { ...l, unitPrice: p.sellingPrice } : l,
        ),
      )
      return
    }
    const price = Number(nextPrice)
    if (!Number.isFinite(price) || price < 0) return
    if (price > p.sellingPrice) {
      toast.error(`Cannot exceed list price ${formatNaira(p.sellingPrice)}`)
      return
    }
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, unitPrice: price } : l)),
    )
  }

  const updateCartQty = (productId, nextQty) => {
    const p = products.find((x) => x._id === productId)
    if (!p) return
    const max = maxQtyForProduct(productId)
    const qty = Math.floor(Number(nextQty))
    if (!Number.isFinite(qty) || nextQty === '' || nextQty === null) return
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId))
      return
    }
    if (qty > max) {
      toast.error(`Only ${max} available for this invoice`)
      return
    }
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)),
    )
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (form.customerPick === WALK_IN && !form.walkInName.trim()) {
      toast.error('Enter walk-in customer name')
      return
    }
    if (form.customerPick !== WALK_IN && !form.customerPick) {
      toast.error('Search and select a registered customer')
      return
    }
    if (cart.length === 0) {
      toast.error('Add at least one product')
      return
    }
    if (paidNow > cartTotal) {
      toast.error('Amount paid cannot exceed sale total')
      return
    }
    if (needsRegisteredCustomer) {
      toast.error('Select a registered customer to record credit')
      return
    }

    const paymentRows = payments
      .map((p) => ({ method: p.method, amount: Number(p.amount) || 0 }))
      .filter((p) => p.amount > 0)

    const payload = {
      products: cart.map((l) => {
        const p = products.find((x) => x._id === l.productId)
        const unitPrice = p ? lineUnitPrice(l, p) : l.unitPrice
        return {
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice,
        }
      }),
      payments: paymentRows,
      note: form.note,
    }
    if (form.customerPick === WALK_IN) {
      payload.customerName = form.walkInName.trim()
    } else {
      payload.customerId = form.customerPick
    }

    setSaving(true)
    try {
      const { data } = await api.put(`/sales/${saleId}`, payload)
      toast.success('Invoice updated')
      onSaved(data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-sale-title"
    >
      <div className="flex min-h-0 w-full max-w-6xl flex-col overflow-hidden glass-panel-strong shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="edit-sale-title" className="text-lg font-semibold text-slate-900">
            Edit invoice {invoiceNumber || ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading invoice…</p>
        ) : (
          <form
            onSubmit={submit}
            className="grid min-h-0 flex-1 grid-rows-2 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,380px)] lg:grid-rows-1"
          >
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200">
              <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
                <CustomerPicker
                  compact
                  value={form}
                  onChange={(next) => setForm({ ...form, ...next })}
                  note={form.note}
                  onNoteChange={(note) => setForm({ ...form, note })}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col p-3">
                <p className="mb-1 text-sm font-medium text-slate-700">Line items</p>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SaleCartRow
                    compact
                    lines={cart}
                    products={products}
                    onUpdateQty={updateCartQty}
                    onUpdatePrice={updateCartPrice}
                    onRemove={removeFromCart}
                    maxQtyForProduct={maxQtyForProduct}
                  />
                </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-slate-100 bg-slate-50/80 p-3">
                <SalePaymentSection
                  compact
                  cartTotal={cartTotal}
                  payments={payments}
                  onChangePayments={setPayments}
                  creditBalance={creditBalance}
                  needsRegisteredCustomer={needsRegisteredCustomer}
                />
                <button
                  type="submit"
                  disabled={saving || cart.length === 0 || !customerOk || needsRegisteredCustomer}
                  className="w-full rounded-lg bg-emerald-700 py-3 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : `Save changes (${formatNaira(cartTotal)})`}
                </button>
              </div>
            </div>

            <ProductPickerPanel
              fillHeight
              products={filteredProducts}
              search={productSearch}
              onSearchChange={setProductSearch}
              cartLines={cart}
              onAddProduct={addProduct}
              maxQtyForProduct={maxQtyForProduct}
            />
          </form>
        )}
      </div>
    </div>
  )
}
