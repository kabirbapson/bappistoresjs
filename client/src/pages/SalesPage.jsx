import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import InvoiceReceipt from '../components/InvoiceReceipt'
import ProductPickerPanel from '../components/ProductPickerPanel'
import SaleCartRow from '../components/SaleCartRow'
import PageShell from '../components/PageShell'
import SalePaymentSection from '../components/SalePaymentSection'
import CustomerPicker, { WALK_IN } from '../components/CustomerPicker'
import api from '../api'
import { SALE_PAYMENT_MODES } from '../constants'
import { formatNaira } from '../utils/format'

const PRODUCT_LIMIT = 500

export default function SalesPage() {
  const [products, setProducts] = useState([])
  const [productTotal, setProductTotal] = useState(0)
  const [lastInvoice, setLastInvoice] = useState(null)
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState([])
  const [form, setForm] = useState({
    customerPick: '',
    walkInName: '',
    note: '',
  })
  const [paymentMode, setPaymentMode] = useState(null)
  const [paidAmount, setPaidAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const p = await api.get(`/products?limit=${PRODUCT_LIMIT}`)
      setProducts(p.data.items)
      setProductTotal(p.data.total ?? p.data.items.length)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load products')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const filteredProducts = useMemo(() => {
    const inStock = products.filter((p) => (p.quantity ?? 0) > 0)
    const q = productSearch.trim().toLowerCase()
    if (!q) return inStock
    return inStock.filter((p) => p.name?.toLowerCase().includes(q))
  }, [products, productSearch])

  const lineUnitPrice = (line, product) =>
    line.unitPrice != null ? line.unitPrice : product?.sellingPrice ?? 0

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, line) => {
      const p = products.find((x) => x._id === line.productId)
      return sum + (p ? lineUnitPrice(line, p) * line.quantity : 0)
    }, 0)
  }, [cart, products])

  const paidNow = Number(paidAmount) || 0
  const creditBalance = Math.max(0, cartTotal - paidNow)
  const needsRegisteredCustomer =
    creditBalance > 0 &&
    (form.customerPick === WALK_IN || !form.customerPick)

  const prevCartTotalRef = useRef(cartTotal)

  const handlePaymentModeChange = (mode) => {
    setPaymentMode(mode)
    if (mode === 'credit') {
      setPaidAmount('')
    } else {
      setPaidAmount(String(cartTotal))
    }
  }

  useEffect(() => {
    if (!paymentMode || paymentMode === 'credit') {
      prevCartTotalRef.current = cartTotal
      return
    }
    setPaidAmount((prev) => {
      const prevPaid = Number(prev) || 0
      const wasFullPay =
        prev === '' || prevPaid === prevCartTotalRef.current
      prevCartTotalRef.current = cartTotal
      return wasFullPay ? String(cartTotal) : prev
    })
  }, [cartTotal, paymentMode])

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

  const buildPaymentRows = () => {
    const amount = Number(paidAmount) || 0
    if (paymentMode === 'credit') {
      if (amount <= 0) return []
      return [{ method: 'cash', amount }]
    }
    const mode = SALE_PAYMENT_MODES.find((m) => m.id === paymentMode)
    if (!mode?.apiMethod || amount <= 0) return []
    return [{ method: mode.apiMethod, amount }]
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!paymentMode) {
      toast.error('Select a payment method (Cash, Transfer, POS, or Credit)')
      return
    }
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
      toast.error('Select a registered customer for partial payment or credit')
      return
    }
    if (paymentMode !== 'credit' && paidNow <= 0) {
      toast.error('Enter amount received')
      return
    }
    const paymentRows = buildPaymentRows()
    setIsSubmitting(true)
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
      setPaymentMode(null)
      setPaidAmount('')
      setForm({
        customerPick: '',
        walkInName: '',
        note: '',
      })
      setProductSearch('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record sale')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageShell
      scroll={false}
      className="gap-1"
      header={
        <div className="flex items-center justify-between rounded-lg bg-emerald-700 px-3 py-1.5 text-white shadow-sm">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-100">Sale total</p>
            <p className="text-lg font-bold tabular-nums">{formatNaira(cartTotal)}</p>
          </div>
          {cart.length > 0 ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs font-medium text-emerald-100">No items yet</span>
          )}
        </div>
      }
    >
      <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] max-lg:grid-rows-[minmax(0,1fr)_minmax(0,26vh)]">
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-2 py-1.5">
            <CustomerPicker
              compact
              value={form}
              onChange={(next) => setForm({ ...form, ...next })}
              note={form.note}
              onNoteChange={(note) => setForm({ ...form, note })}
            />
          </div>

          <div className="shrink-0 bg-slate-50/40 px-2 py-1">
            <div className="mb-1 flex shrink-0 items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Cart</span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[10px] font-medium text-rose-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="min-w-0 w-full">
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

          <div className="mt-auto shrink-0 border-t border-slate-200 bg-white p-2">
            <SalePaymentSection
              compact
              cartTotal={cartTotal}
              paymentMode={paymentMode}
              onPaymentModeChange={handlePaymentModeChange}
              paidAmount={paidAmount}
              onPaidAmountChange={setPaidAmount}
              creditBalance={creditBalance}
              needsRegisteredCustomer={needsRegisteredCustomer}
              footerSlot={
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-40 disabled:shadow-none sm:px-5 sm:text-base"
                  disabled={
                    isSubmitting ||
                    !paymentMode ||
                    cart.length === 0 ||
                    (form.customerPick === WALK_IN
                      ? !form.walkInName.trim()
                      : !form.customerPick) ||
                    needsRegisteredCustomer
                  }
                >
                  {isSubmitting ? 'Completing…' : 'Complete sale & print'}
                </button>
              }
            />
          </div>
        </form>

        <ProductPickerPanel
          fillHeight
          narrow
          products={filteredProducts}
          search={productSearch}
          onSearchChange={setProductSearch}
          cartLines={cart}
          onAddProduct={addProduct}
          loadedCount={products.length}
          totalCount={productTotal}
          hasSearch={Boolean(productSearch.trim())}
        />
      </div>

      {lastInvoice && (
        <InvoiceReceipt
          invoice={lastInvoice}
          title="Reprint receipt"
          onClose={() => setLastInvoice(null)}
        />
      )}
    </PageShell>
  )
}
