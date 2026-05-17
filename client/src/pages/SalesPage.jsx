import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import InvoiceReceipt from '../components/InvoiceReceipt'
import ProductPickerPanel from '../components/ProductPickerPanel'
import SaleCartRow from '../components/SaleCartRow'
import PageShell from '../components/PageShell'
import SalePaymentSection from '../components/SalePaymentSection'
import api from '../api'
import { formatNaira } from '../utils/format'

const WALK_IN = '__walkin__'

export default function SalesPage() {
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [lastInvoice, setLastInvoice] = useState(null)
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState([])
  const [form, setForm] = useState({
    customerPick: WALK_IN,
    walkInName: '',
    note: '',
  })
  const [payments, setPayments] = useState([{ method: 'cash', amount: '' }])

  const load = async () => {
    const [p, c] = await Promise.all([
      api.get('/products?limit=200'),
      api.get('/customers'),
    ])
    setProducts(p.data.items)
    setCustomers(c.data.items)
  }

  useEffect(() => {
    load()
  }, [])

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

  const customerLabel = useMemo(() => {
    if (form.customerPick === WALK_IN) return form.walkInName.trim() || null
    const c = customers.find((x) => x._id === form.customerPick)
    return c?.name || null
  }, [form.customerPick, form.walkInName, customers])

  const paidNow = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments],
  )

  const creditBalance = Math.max(0, cartTotal - paidNow)

  const needsRegisteredCustomer =
    creditBalance > 0 && form.customerPick === WALK_IN

  const addProduct = (productId) => {
    const p = products.find((x) => x._id === productId)
    if (!p || p.quantity <= 0) return

    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        if (existing.quantity >= p.quantity) {
          toast.error(`Only ${p.quantity} of ${p.name} in stock`)
          return prev
        }
        toast.success(`Added another ${p.name}`)
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      toast.success(`Added ${p.name}`)
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

    const qty = Math.floor(Number(nextQty))
    if (!Number.isFinite(qty) || nextQty === '' || nextQty === null) return

    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId))
      return
    }
    if (qty > p.quantity) {
      toast.error(`Only ${p.quantity} available`)
      return
    }
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)),
    )
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const clearCart = () => setCart([])

  const submit = async (e) => {
    e.preventDefault()
    if (!customerLabel) {
      toast.error('Enter customer name or select a customer')
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
    if (creditBalance > 0 && form.customerPick === WALK_IN) {
      toast.error('Walk-in customers cannot buy on credit')
      return
    }
    try {
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

      const { data: invoice } = await api.post('/sales', payload)
      toast.success('Sale recorded')
      setLastInvoice(invoice)
      setCart([])
      setPayments([{ method: 'cash', amount: '' }])
      setForm({
        customerPick: WALK_IN,
        walkInName: '',
        note: '',
      })
      setProductSearch('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record sale')
    }
  }

  return (
    <PageShell
      scroll={false}
      className="gap-2"
      header={
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Make sales</h2>
          {cart.length > 0 && (
            <p className="text-lg font-bold tabular-nums text-emerald-800">
              Total {formatNaira(cartTotal)}
            </p>
          )}
        </div>
      }
    >
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:grid-rows-1">
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm"
        >
          <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">Customer</span>
                <select
                  className="w-full rounded-lg border p-2.5 text-base"
                  value={form.customerPick}
                  onChange={(e) => setForm({ ...form, customerPick: e.target.value })}
                >
                  <option value={WALK_IN}>Walk-in</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {form.customerPick === WALK_IN && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Name *</span>
                  <input
                    className="w-full rounded-lg border p-2.5 text-base"
                    value={form.walkInName}
                    onChange={(e) => setForm({ ...form, walkInName: e.target.value })}
                    placeholder="Customer name"
                    required
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Note</span>
                <input
                  className="w-full rounded-lg border p-2.5 text-base"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-3 pt-2">
            <div className="mb-1 flex shrink-0 items-center justify-between">
              <span className="text-sm font-medium text-slate-700">This sale</span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-sm text-rose-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SaleCartRow
                compact
                lines={cart}
                products={products}
                onUpdateQty={updateCartQty}
                onUpdatePrice={updateCartPrice}
                onRemove={removeFromCart}
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
              className="w-full rounded-lg bg-slate-900 py-3 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={
                cart.length === 0 || !customerLabel || needsRegisteredCustomer
              }
            >
              Record sale &amp; print ({cart.length})
            </button>
          </div>
        </form>

        <ProductPickerPanel
          fillHeight
          products={filteredProducts}
          search={productSearch}
          onSearchChange={setProductSearch}
          cartLines={cart}
          onAddProduct={addProduct}
        />
      </div>

      {lastInvoice && (
        <InvoiceReceipt invoice={lastInvoice} onClose={() => setLastInvoice(null)} />
      )}
    </PageShell>
  )
}
