import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import NumericInput from '../components/NumericInput'
import ProductAvatar from '../components/ProductAvatar'
import { PRODUCT_PLACEHOLDER_SRC } from '../utils/productImage'
import api from '../api'
import { LOW_STOCK_THRESHOLD, PRODUCT_CATEGORY } from '../constants'
import { formatNaira } from '../utils/format'

const emptyProduct = {
  name: '',
  imageUrl: '',
  quantity: 0,
  costPrice: 0,
  sellingPrice: 0,
}

function stockStatus(quantity) {
  if (quantity <= 0) return 'out'
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low'
  return 'ok'
}

function statusMeta(status) {
  if (status === 'out') {
    return { label: 'Out of stock', badge: 'bg-rose-100 text-rose-800 ring-rose-200' }
  }
  if (status === 'low') {
    return { label: 'Low stock', badge: 'bg-amber-100 text-amber-900 ring-amber-200' }
  }
  return { label: 'In stock', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200' }
}

function tableRowClass(status, index, isEditing) {
  if (isEditing) return 'bg-emerald-100 ring-2 ring-inset ring-emerald-400'
  const even = index % 2 === 0
  if (status === 'out') return even ? 'bg-rose-50 hover:bg-rose-100/80' : 'bg-rose-100/70 hover:bg-rose-100'
  if (status === 'low') return even ? 'bg-amber-50 hover:bg-amber-100/80' : 'bg-amber-100/60 hover:bg-amber-100'
  return even ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'
}

function FilterPill({ active, count, label, tone, onClick }) {
  const tones = {
    slate: active ? 'bg-slate-800 text-white ring-slate-800' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
    emerald: active ? 'bg-emerald-700 text-white ring-emerald-700' : 'bg-white text-emerald-800 ring-emerald-200 hover:bg-emerald-50',
    amber: active ? 'bg-amber-600 text-white ring-amber-600' : 'bg-white text-amber-900 ring-amber-200 hover:bg-amber-50',
    rose: active ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-rose-800 ring-rose-200 hover:bg-rose-50',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-base font-medium ring-1 transition-colors ${tones[tone]}`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-sm ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
        {count}
      </span>
    </button>
  )
}

function StatCard({ label, value, sub, className = '' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${className}`}>
      <p className="text-sm font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-sm opacity-70">{sub}</p>}
    </div>
  )
}

const STOCK_FILTERS = new Set(['all', 'ok', 'low', 'out'])

export default function ProductsPage() {
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [stockFilter, setStockFilter] = useState(() => {
    const stock = searchParams.get('stock')
    return stock && STOCK_FILTERS.has(stock) ? stock : 'all'
  })
  const [form, setForm] = useState(emptyProduct)
  const [editing, setEditing] = useState(null)
  const [restockId, setRestockId] = useState(null)
  const [restockProduct, setRestockProduct] = useState(null)
  const [restockQty, setRestockQty] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const formRef = useRef(null)
  const imageInputRef = useRef(null)

  const load = useCallback(() => {
    api.get(`/products?q=${encodeURIComponent(query)}`).then((r) => setProducts(r.data.items))
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c = { all: products.length, ok: 0, low: 0, out: 0 }
    for (const p of products) {
      c[stockStatus(p.quantity)] += 1
    }
    return c
  }, [products])

  const filteredProducts = useMemo(() => {
    if (stockFilter === 'all') return products
    return products.filter((p) => stockStatus(p.quantity) === stockFilter)
  }, [products, stockFilter])

  const totalStockValue = useMemo(
    () => products.reduce((sum, p) => sum + p.quantity * p.costPrice, 0),
    [products],
  )

  const save = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      category: PRODUCT_CATEGORY,
      quantity: Number(form.quantity) || 0,
      costPrice: Number(form.costPrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
    }
    try {
      if (editing) {
        await api.put(`/products/${editing._id}`, payload)
        toast.success('Product updated')
        setEditing(null)
      } else {
        await api.post('/products', payload)
        toast.success('Product added')
      }
      setForm(emptyProduct)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    }
  }

  const startEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name,
      imageUrl: p.imageUrl || '',
      quantity: p.quantity,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(emptyProduct)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const onImageSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const okType = /^image\/(jpeg|png|jpg)$/i.test(file.type)
    const okName = /\.(jpe?g|png)$/i.test(file.name)
    if (!okType && !okName) {
      toast.error('Only PNG or JPG images are allowed')
      e.target.value = ''
      return
    }
    setUploadingImage(true)
    try {
      const body = new FormData()
      body.append('image', file)
      const { data } = await api.post('/products/image', body)
      setForm((f) => ({ ...f, imageUrl: data.imageUrl }))
      toast.success('Photo uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload photo')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  const clearImage = () => {
    setForm((f) => ({ ...f, imageUrl: '' }))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const openRestock = (p) => {
    setRestockId(p._id)
    setRestockProduct(p)
    setRestockQty('')
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this product?')) return
    await api.delete(`/products/${id}`)
    toast.success('Product deleted')
    if (editing?._id === id) cancelEdit()
    load()
  }

  const submitRestock = async (e) => {
    e.preventDefault()
    const qty = Number(restockQty)
    if (!qty || qty <= 0) return
    try {
      await api.post(`/products/${restockId}/restock`, { quantity: qty })
      toast.success(`Restocked ${qty} units`)
      setRestockId(null)
      setRestockProduct(null)
      setRestockQty('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restock failed')
    }
  }

  return (
    <PageShell
      scroll={false}
      header={
        <PageHeader
          title="Products"
          subtitle="Beverage inventory — prices in Naira (₦)"
        />
      }
    >
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:grid-rows-1">
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Products" value={counts.all} className="border-slate-200 bg-white" />
            <StatCard
              label="In stock"
              value={counts.ok}
              className="border-emerald-200 bg-emerald-50/50"
            />
            <StatCard
              label="Low stock"
              value={counts.low}
              sub={`≤ ${LOW_STOCK_THRESHOLD} units`}
              className="border-amber-200 bg-amber-50/50"
            />
            <StatCard
              label="Stock value"
              value={formatNaira(totalStockValue)}
              sub="At cost"
              className="border-sky-200 bg-sky-50/50"
            />
          </div>

          <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <label className="block min-w-0 flex-1 text-base">
                <span className="mb-1 block font-medium text-slate-700">Search</span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-base focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Type product name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <FilterPill
                  active={stockFilter === 'all'}
                  count={counts.all}
                  label="All"
                  tone="slate"
                  onClick={() => setStockFilter('all')}
                />
                <FilterPill
                  active={stockFilter === 'ok'}
                  count={counts.ok}
                  label="In stock"
                  tone="emerald"
                  onClick={() => setStockFilter('ok')}
                />
                <FilterPill
                  active={stockFilter === 'low'}
                  count={counts.low}
                  label="Low"
                  tone="amber"
                  onClick={() => setStockFilter('low')}
                />
                <FilterPill
                  active={stockFilter === 'out'}
                  count={counts.out}
                  label="Out"
                  tone="rose"
                  onClick={() => setStockFilter('out')}
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-sm sm:text-base">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[13%]" />
                <col className="w-[6%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-xs uppercase tracking-wide text-white sm:text-sm">
                  <th className="p-2.5 text-left font-semibold sm:p-3">Product</th>
                  <th className="px-1.5 py-2.5 text-left font-semibold sm:p-3">Status</th>
                  <th className="px-1.5 py-2.5 text-right font-semibold sm:p-3">Stock</th>
                  <th className="px-1.5 py-2.5 text-right font-semibold sm:p-3">Cost</th>
                  <th className="px-1.5 py-2.5 text-right font-semibold sm:p-3">Sell</th>
                  <th className="px-1.5 py-2.5 text-right font-semibold sm:p-3">Margin</th>
                  <th className="p-2.5 text-left font-semibold sm:p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, index) => {
                  const status = stockStatus(p.quantity)
                  const meta = statusMeta(status)
                  const isEditingRow = editing?._id === p._id
                  const margin = p.sellingPrice - p.costPrice

                  return (
                    <tr
                      key={p._id}
                      className={`border-b border-slate-200/80 transition-colors ${tableRowClass(status, index, isEditingRow)}`}
                    >
                      <td className="overflow-hidden p-2.5 align-middle sm:p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <ProductAvatar
                            product={p}
                            className="hidden h-9 w-9 shrink-0 rounded-md ring-1 ring-slate-200 sm:block sm:h-10 sm:w-10"
                          />
                          <span
                            className="truncate text-sm font-medium text-slate-900 sm:text-base"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-1.5 py-2.5 align-middle sm:px-2 sm:py-3">
                        <span
                          className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold ring-1 sm:text-sm ${meta.badge}`}
                          title={meta.label}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-1.5 py-2.5 text-right align-middle sm:py-3">
                        <span
                          className={`text-sm font-bold tabular-nums sm:text-base ${
                            status === 'out'
                              ? 'text-rose-700'
                              : status === 'low'
                                ? 'text-amber-800'
                                : 'text-slate-900'
                          }`}
                        >
                          {p.quantity}
                        </span>
                      </td>
                      <td className="overflow-hidden truncate px-1.5 py-2.5 text-right align-middle tabular-nums text-slate-700 sm:py-3">
                        {formatNaira(p.costPrice)}
                      </td>
                      <td className="overflow-hidden truncate px-1.5 py-2.5 text-right align-middle font-semibold tabular-nums text-emerald-800 sm:py-3">
                        {formatNaira(p.sellingPrice)}
                      </td>
                      <td className="overflow-hidden truncate px-1.5 py-2.5 text-right align-middle font-semibold tabular-nums text-sky-800 sm:py-3">
                        {formatNaira(margin)}
                      </td>
                      <td className="px-1.5 py-2 align-middle sm:px-2 sm:py-2.5">
                        <div className="flex flex-nowrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 sm:text-base"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openRestock(p)}
                            className="shrink-0 rounded-lg bg-sky-600 px-2.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 sm:text-base"
                          >
                            Restock
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(p._id)}
                            className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 sm:text-base"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="border-t border-slate-100 px-6 py-12 text-center">
                <p className="text-base text-slate-500">No products match your search or filter.</p>
                {stockFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setStockFilter('all')}
                    className="mt-2 text-base font-medium text-emerald-700 hover:underline"
                  >
                    Show all products
                  </button>
                )}
              </div>
            )}
            </div>
          </div>
        </section>

        <aside
          ref={formRef}
          className={`min-h-0 overflow-y-auto rounded-xl border p-4 shadow-sm ${
            editing
              ? 'border-emerald-300 bg-gradient-to-b from-emerald-50 to-white ring-2 ring-emerald-200'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editing ? 'Edit product' : 'Add new product'}
              </h3>
              {editing && (
                <p className="mt-0.5 text-base text-emerald-800">{editing.name}</p>
              )}
            </div>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>

          <form className="space-y-3" onSubmit={save}>
            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Product name *</span>
              <input
                placeholder="e.g. Coca-Cola 50cl crate"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <div className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Product photo (optional)</span>
              <div className="flex items-start gap-3">
                <div className="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <img
                    src={form.imageUrl || PRODUCT_PLACEHOLDER_SRC}
                    alt=""
                    className="h-20 w-20 bg-slate-50 object-contain object-center"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,.jpg,.jpeg,.png"
                    disabled={uploadingImage}
                    onChange={onImageSelected}
                    className="w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800 disabled:opacity-50"
                  />
                  <p className="text-sm text-slate-500">PNG or JPG, up to 5 MB</p>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="text-sm font-medium text-rose-700 hover:underline"
                    >
                      Remove photo
                    </button>
                  )}
                  {uploadingImage && (
                    <p className="text-sm text-emerald-700">Uploading…</p>
                  )}
                </div>
              </div>
            </div>

            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Stock quantity *</span>
              <NumericInput
                placeholder="0"
                allowEmpty={false}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base font-semibold tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.quantity}
                onChange={(quantity) => setForm({ ...form, quantity })}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-base">
                <span className="mb-1 block font-medium text-slate-700">Cost (₦) *</span>
                <NumericInput
                  placeholder="Cost"
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-base font-semibold tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={form.costPrice}
                  onChange={(costPrice) => setForm({ ...form, costPrice })}
                  required
                />
              </label>
              <label className="block text-base">
                <span className="mb-1 block font-medium text-slate-700">Sell (₦) *</span>
                <NumericInput
                  placeholder="Sell"
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-base font-semibold tabular-nums text-emerald-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={form.sellingPrice}
                  onChange={(sellingPrice) => setForm({ ...form, sellingPrice })}
                  required
                />
              </label>
            </div>

            {(Number(form.sellingPrice) || 0) > 0 && (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-base text-sky-900">
                Margin per unit:{' '}
                <strong className="tabular-nums">
                  {formatNaira(
                    Math.max(0, (Number(form.sellingPrice) || 0) - (Number(form.costPrice) || 0)),
                  )}
                </strong>
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-700 py-3 text-base font-semibold text-white shadow-md hover:bg-emerald-800"
            >
              {editing ? 'Save changes' : '+ Add product'}
            </button>
          </form>
        </aside>
      </div>

      {restockId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitRestock}
            className="w-full max-w-md space-y-4 rounded-2xl border border-sky-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <ProductAvatar
                product={restockProduct}
                className="h-14 w-14 rounded-lg ring-2 ring-sky-200"
              />
              <div>
                <h3 className="font-semibold text-slate-900">Restock</h3>
                <p className="text-sm text-slate-600">{restockProduct?.name}</p>
                <p className="text-xs text-slate-500">
                  Current stock: <strong>{restockProduct?.quantity ?? 0}</strong>
                </p>
              </div>
            </div>
            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Units to add *</span>
              <NumericInput
                placeholder="e.g. 24"
                className="w-full rounded-lg border border-slate-200 p-3 text-lg font-semibold tabular-nums focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                value={restockQty === '' ? '' : Number(restockQty)}
                onChange={(v) => setRestockQty(v === '' ? '' : String(v))}
                required
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-sky-600 py-2.5 font-medium text-white hover:bg-sky-700"
              >
                Confirm restock
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setRestockId(null)
                  setRestockProduct(null)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
