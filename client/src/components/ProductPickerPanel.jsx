import ProductAvatar from './ProductAvatar'
import { formatNaira } from '../utils/format'
export default function ProductPickerPanel({
  products,
  search,
  onSearchChange,
  cartLines = [],
  onAddProduct,
  fillHeight = false,
}) {
  const cartQty = (id) => cartLines.find((l) => l.productId === id)?.quantity ?? 0

  const inStock = products.filter((p) => p.quantity > 0)
  const outOfStock = products.filter((p) => p.quantity <= 0)

  return (
    <aside
      className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${
        fillHeight
          ? 'h-full min-h-0 overflow-hidden'
          : 'h-full min-h-[420px] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]'
      }`}
    >
      <div className={`shrink-0 border-b border-slate-100 ${fillHeight ? 'p-2' : 'p-3'}`}>
        <h3 className="text-sm font-semibold text-slate-800">
          Products <span className="font-normal text-slate-500">· tap to add</span>
        </h3>
        <input
          type="search"
          className={`w-full rounded-lg border border-slate-200 text-base ${fillHeight ? 'mt-2 p-2.5' : 'mt-2 p-2.5'}`}
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${fillHeight ? 'p-2' : 'p-3'}`}>
        {inStock.length === 0 && outOfStock.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No products found</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {inStock.map((p) => {
                const inCart = cartQty(p._id)
                const remaining = p.quantity - inCart
                const inSale = inCart > 0

                return (
                  <button
                    key={p._id}
                    type="button"
                    disabled={remaining <= 0}
                    onClick={() => onAddProduct(p._id)}
                    className={`relative flex flex-col items-center rounded-lg border p-1.5 text-center transition-all ${
                      inSale
                        ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-400'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {inCart > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                        {inCart}
                      </span>
                    )}
                    <ProductAvatar product={p} className="h-14 w-full rounded-md" />
                    <p className="mt-1 line-clamp-2 w-full text-sm font-semibold leading-tight text-slate-900">
                      {p.name}
                    </p>
                    <p className="text-sm font-bold tabular-nums text-emerald-800">
                      {formatNaira(p.sellingPrice)}
                    </p>
                    <span className="mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {remaining > 0 ? `${remaining} left` : 'Max in cart'}
                    </span>
                  </button>
                )
              })}
            </div>

            {outOfStock.length > 0 && !fillHeight && (
              <>
                <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Out of stock
                </p>
                <div className="grid grid-cols-3 gap-1.5 opacity-60">
                  {outOfStock.map((p) => (
                    <div
                      key={p._id}
                      className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-center"
                    >
                      <ProductAvatar product={p} className="h-12 w-full rounded-md grayscale" />
                      <p className="mt-1 line-clamp-2 text-[10px] text-slate-600">{p.name}</p>
                      <span className="mt-1 text-[10px] text-rose-600">Unavailable</span>
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
