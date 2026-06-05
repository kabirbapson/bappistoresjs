import ProductAvatar from './ProductAvatar'
import { formatNaira } from '../utils/format'

export default function ProductPickerPanel({
  products,
  search,
  onSearchChange,
  cartLines = [],
  onAddProduct,
  fillHeight = false,
  narrow = false,
  maxQtyForProduct,
  loadedCount,
  totalCount,
  hasSearch = false,
}) {
  const cartQty = (id) => cartLines.find((l) => l.productId === id)?.quantity ?? 0

  const availableQty = (p) => {
    const inCart = cartQty(p._id)
    const max = maxQtyForProduct ? maxQtyForProduct(p._id) : p.quantity
    return Math.max(0, max - inCart)
  }

  const inStock = products.filter((p) => (maxQtyForProduct ? maxQtyForProduct(p._id) : p.quantity) > 0)
  const outOfStock = products.filter((p) => (maxQtyForProduct ? maxQtyForProduct(p._id) : p.quantity) <= 0)

  return (
    <aside
      className={`flex flex-col overflow-hidden glass-panel ${
        fillHeight ? 'h-full min-h-0' : 'h-full min-h-[420px] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]'
      }`}
    >
      <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-800">Products</h3>
          <span className="text-[10px] text-slate-500">
            {inStock.length} in stock
            {totalCount != null && loadedCount != null && totalCount > loadedCount && !hasSearch
              ? ` · ${loadedCount}/${totalCount}`
              : ''}
          </span>
        </div>
        <input
          type="search"
          className="glass-input mt-1.5 w-full px-2 py-1.5 text-sm"
          placeholder="Search products…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${fillHeight ? 'p-2' : 'p-3'}`}>
        {inStock.length === 0 && outOfStock.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No products found</p>
        ) : (
          <>
            <div
              className={`grid gap-2 ${
                narrow ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
              } max-lg:grid-cols-3 sm:max-lg:grid-cols-4`}
            >
              {inStock.map((p) => {
                const inCart = cartQty(p._id)
                const remaining = availableQty(p)
                const inSale = inCart > 0

                return (
                  <button
                    key={p._id}
                    type="button"
                    disabled={remaining <= 0}
                    onClick={() => onAddProduct(p._id)}
                    className={`group relative flex flex-col items-center rounded-xl border p-2 text-center transition-all active:scale-[0.98] ${
                      inSale
                        ? 'border-emerald-500 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-400/60'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    {inCart > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow">
                        {inCart}
                      </span>
                    )}
                    <ProductAvatar
                      product={p}
                      className={`w-full rounded-lg ${narrow ? 'h-14' : 'h-12'} transition group-hover:scale-[1.02]`}
                    />
                    <p className="mt-1.5 line-clamp-2 w-full text-sm font-bold leading-snug text-slate-900">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700">
                      {formatNaira(p.sellingPrice)}
                    </p>
                    <span
                      className={`mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        remaining > 0 ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {remaining > 0 ? `${remaining} left` : 'Max'}
                    </span>
                  </button>
                )
              })}
            </div>

            {outOfStock.length > 0 && (
              <>
                <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Out of stock
                </p>
                <div className={`grid gap-2 opacity-50 ${narrow ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {outOfStock.slice(0, fillHeight ? 6 : outOfStock.length).map((p) => (
                    <div
                      key={p._id}
                      className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-center"
                    >
                      <ProductAvatar product={p} className="h-10 w-full rounded-lg grayscale" />
                      <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-600">{p.name}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
