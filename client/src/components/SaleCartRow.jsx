import NumericInput from './NumericInput'
import ProductAvatar from './ProductAvatar'
import { QUICK_QTY_PRESETS } from '../constants'
import { formatNaira } from '../utils/format'

function PriceField({ value, listPrice, onChange, large = false, compact = false }) {
  const size = compact ? 'h-7' : large ? 'h-11' : 'h-9'
  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-200 bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20 ${size}`}
    >
      <span className={`pl-2 font-medium text-slate-400 ${compact ? 'text-[10px]' : large ? 'text-sm' : 'text-xs'}`}>₦</span>
      <NumericInput
        allowEmpty={false}
        value={value}
        onChange={(v) => onChange(v === '' ? listPrice : v)}
        className={`border-0 bg-transparent pr-2 text-right font-semibold tabular-nums focus:outline-none focus:ring-0 ${
          compact ? 'w-[4.25rem] text-xs' : large ? 'w-[5.5rem] text-lg' : 'w-[5.5rem] text-sm'
        }`}
      />
    </div>
  )
}

export default function SaleCartRow({
  lines,
  products,
  onUpdateQty,
  onUpdatePrice,
  onRemove,
  compact = false,
  maxQtyForProduct,
}) {
  if (lines.length === 0) {
    return (
      <div className="flex min-h-[3rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-3 text-center">
        <p className="text-sm font-semibold text-slate-700">Cart is empty</p>
        <p className="mt-0.5 text-xs text-slate-500">Tap products to add</p>
      </div>
    )
  }

  const stockMax = (line) => {
    if (maxQtyForProduct) return maxQtyForProduct(line.productId)
    const product = products.find((p) => p._id === line.productId)
    return product?.quantity ?? 0
  }

  const setQuickQty = (line, qty) => {
    const max = stockMax(line)
    onUpdateQty(line.productId, Math.min(max, qty))
  }

  if (compact) {
    return (
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-1">
        <div className="inline-flex gap-3">
          {lines.map((line) => {
            const product = products.find((p) => p._id === line.productId)
            const name = product?.name || line.productName || 'Product'
            const listPrice = product?.sellingPrice ?? line.unitPrice ?? 0
            const unitPrice = line.unitPrice != null ? line.unitPrice : listPrice
            const lineTotal = unitPrice * line.quantity
            const hasDiscount = unitPrice < listPrice
            const maxQty = stockMax(line)

            return (
              <article
                key={line.productId}
                className="flex w-44 shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="relative mx-auto shrink-0">
                  {product ? (
                    <ProductAvatar product={product} className="h-14 w-14 rounded-lg ring-1 ring-slate-100" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-slate-100" />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(line.productId)}
                    className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-sm text-slate-400 shadow ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </div>

                <h3
                  className="mt-2 line-clamp-2 min-h-[2.75rem] text-center text-base font-extrabold leading-snug text-slate-950"
                  title={name}
                >
                  {name}
                </h3>

                <div className="mt-2 flex justify-center">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.productId, line.quantity - 1)}
                      className="flex h-9 w-9 items-center justify-center text-lg font-bold text-slate-600 hover:bg-white"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <NumericInput
                      allowEmpty={false}
                      value={line.quantity}
                      onChange={(v) => onUpdateQty(line.productId, v === '' ? 1 : v)}
                      className="h-9 w-12 border-x border-slate-200 bg-white text-center text-base font-bold focus:outline-none focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.productId, line.quantity + 1)}
                      disabled={line.quantity >= maxQty}
                      className="flex h-9 w-9 items-center justify-center text-lg font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1">
                  {QUICK_QTY_PRESETS.map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setQuickQty(line, qty)}
                      disabled={maxQty <= 0}
                      className={`rounded-md border py-1.5 text-xs font-bold transition ${
                        line.quantity === qty
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                      } disabled:opacity-40`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>

                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase text-slate-500">Rate</span>
                    <PriceField
                      value={unitPrice}
                      listPrice={listPrice}
                      onChange={(v) => onUpdatePrice?.(line.productId, v)}
                    />
                  </div>
                  {hasDiscount && (
                    <button
                      type="button"
                      onClick={() => onUpdatePrice?.(line.productId, listPrice)}
                      className="block w-full text-center text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                  <div className="flex items-center justify-between gap-1 rounded-lg bg-emerald-50 px-2.5 py-2 ring-1 ring-emerald-100">
                    <span className="text-xs font-bold uppercase text-emerald-700">Total</span>
                    <p className="text-base font-bold tabular-nums text-emerald-800">{formatNaira(lineTotal)}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5">
      <div className="flex min-w-min gap-3">
        {lines.map((line) => {
          const product = products.find((p) => p._id === line.productId)
          if (!product) return null
          const listPrice = product.sellingPrice
          const unitPrice = line.unitPrice != null ? line.unitPrice : listPrice
          const lineTotal = unitPrice * line.quantity
          const maxQty = stockMax(line)

          return (
            <article
              key={line.productId}
              className="flex w-[200px] shrink-0 flex-col rounded-lg border border-emerald-100 bg-white p-2 shadow-sm"
            >
              <ProductAvatar product={product} className="h-14 w-full rounded-md" />
              <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-900">{product.name}</p>
              <PriceField
                value={unitPrice}
                listPrice={listPrice}
                onChange={(v) => onUpdatePrice?.(line.productId, v)}
              />
              <div className="mt-2 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onUpdateQty(line.productId, line.quantity - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded border bg-slate-50 font-bold"
                >
                  −
                </button>
                <NumericInput
                  allowEmpty={false}
                  value={line.quantity}
                  onChange={(v) => onUpdateQty(line.productId, v === '' ? 1 : v)}
                  className="h-9 w-full rounded border text-center text-sm font-bold"
                />
                <button
                  type="button"
                  onClick={() => onUpdateQty(line.productId, line.quantity + 1)}
                  disabled={line.quantity >= maxQty}
                  className="flex h-9 w-9 items-center justify-center rounded border bg-slate-50 font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <div className="mt-1.5 flex flex-nowrap gap-1">
                {QUICK_QTY_PRESETS.map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setQuickQty(line, qty)}
                    className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${
                      line.quantity === qty ? 'border-emerald-500 bg-emerald-50' : ''
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-xs font-bold text-emerald-800">{formatNaira(lineTotal)}</p>
              <button
                type="button"
                onClick={() => onRemove(line.productId)}
                className="text-xs text-rose-600 hover:underline"
              >
                Remove
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
