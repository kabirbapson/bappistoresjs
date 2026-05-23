import NumericInput from './NumericInput'
import ProductAvatar from './ProductAvatar'
import { QUICK_QUANTITIES } from '../constants'
import { formatNaira } from '../utils/format'

export default function SaleCartRow({
  lines,
  products,
  maxQtyForProduct,
  onUpdateQty,
  onUpdatePrice,
  onRemove,
  compact = false,
}) {
  if (lines.length === 0) {
    return (
      <p
        className={`rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500 ${
          compact ? 'px-3 py-4 text-sm' : 'px-4 py-6 text-sm'
        }`}
      >
        Tap products on the right to add
      </p>
    )
  }

  const cardW = compact ? 'w-[180px]' : 'w-[200px]'
  const avatarH = compact ? 'h-12' : 'h-14'
  const btnSize = compact ? 'h-9 w-9 text-lg' : 'h-9 w-9 text-sm'
  const inputH = compact ? 'h-9 text-base font-bold' : 'h-9 text-sm'

  return (
    <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5">
      <div className={`flex min-w-min ${compact ? 'gap-2' : 'gap-3'}`}>
        {lines.map((line) => {
          const product = products.find((p) => p._id === line.productId)
          if (!product) return null
          const listPrice = product.sellingPrice
          const unitPrice = line.unitPrice != null ? line.unitPrice : listPrice
          const lineTotal = unitPrice * line.quantity
          const hasDiscount = unitPrice < listPrice
          const maxQty = maxQtyForProduct?.(line.productId) ?? product.quantity
          const quickQty = QUICK_QUANTITIES.filter((q) => q <= maxQty)

          return (
            <article
              key={line.productId}
              className={`flex ${cardW} shrink-0 flex-col rounded-lg border border-emerald-200 bg-white shadow-sm ${
                compact ? 'p-2' : 'p-2'
              }`}
            >
              <ProductAvatar product={product} className={`${avatarH} w-full rounded-md`} />
              <p
                className={`line-clamp-2 font-semibold leading-tight text-slate-900 ${
                  compact ? 'mt-1 text-sm' : 'mt-2 text-xs'
                }`}
              >
                {product.name}
              </p>
              <label className={`block ${compact ? 'mt-1' : 'mt-2'}`}>
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Sale price
                </span>
                <NumericInput
                  allowEmpty={false}
                  value={unitPrice}
                  onChange={(v) => onUpdatePrice?.(line.productId, v === '' ? listPrice : v)}
                  className={`mt-0.5 w-full rounded border bg-white px-1.5 text-center font-semibold tabular-nums text-slate-900 ${
                    compact ? 'h-8 text-sm' : 'h-9 text-sm'
                  }`}
                />
              </label>
              {hasDiscount ? (
                <p className="text-center text-[10px] text-slate-500">
                  List {formatNaira(listPrice)}
                  <span className="mx-1 text-amber-700">−{formatNaira(listPrice - unitPrice)}</span>
                </p>
              ) : (
                <p className="text-center text-[10px] text-slate-500">List {formatNaira(listPrice)}</p>
              )}

              <div className={`flex items-center gap-0.5 ${compact ? 'mt-1' : 'mt-2'}`}>
                <button
                  type="button"
                  onClick={() => onUpdateQty(line.productId, line.quantity - 1)}
                  className={`flex shrink-0 items-center justify-center rounded border bg-slate-50 font-bold ${btnSize}`}
                  aria-label="Decrease"
                >
                  −
                </button>
                <NumericInput
                  allowEmpty={false}
                  value={line.quantity}
                  onChange={(v) => onUpdateQty(line.productId, v === '' ? 1 : v)}
                  className={`w-full min-w-[2.5rem] rounded border bg-white px-0.5 text-center font-bold ${inputH}`}
                />
                <button
                  type="button"
                  onClick={() => onUpdateQty(line.productId, line.quantity + 1)}
                  disabled={line.quantity >= maxQty}
                  className={`flex shrink-0 items-center justify-center rounded border bg-slate-50 font-bold disabled:opacity-40 ${btnSize}`}
                  aria-label="Increase"
                >
                  +
                </button>
              </div>

              <div className={`flex flex-wrap justify-center gap-0.5 ${compact ? 'mt-1' : 'mt-1.5'}`}>
                {(compact ? quickQty.slice(0, 4) : quickQty).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onUpdateQty(line.productId, q)}
                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <p
                className={`text-center font-bold text-emerald-800 ${
                  compact ? 'mt-1.5 text-base' : 'mt-2 text-xs'
                }`}
              >
                {formatNaira(lineTotal)}
              </p>
              <button
                type="button"
                onClick={() => onRemove(line.productId)}
                className="text-center text-xs text-rose-600 hover:underline"
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
