import ProductAvatar from './ProductAvatar'
import { QUICK_QUANTITIES } from '../constants'
import { formatNaira } from '../utils/format'

export default function SaleCartRow({ lines, products, onUpdateQty, onRemove, compact = false }) {
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

  const cardW = compact ? 'w-[168px]' : 'w-[188px]'
  const avatarH = compact ? 'h-12' : 'h-14'
  const btnSize = compact ? 'h-9 w-9 text-lg' : 'h-9 w-9 text-sm'
  const inputH = compact ? 'h-9 text-base font-bold' : 'h-9 text-sm'

  return (
    <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5">
      <div className={`flex min-w-min ${compact ? 'gap-2' : 'gap-3'}`}>
        {lines.map((line) => {
          const product = products.find((p) => p._id === line.productId)
          if (!product) return null
          const lineTotal = product.sellingPrice * line.quantity
          const quickQty = QUICK_QUANTITIES.filter((q) => q <= product.quantity)

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
              <p className={compact ? 'text-sm font-medium text-slate-700' : 'text-[11px] text-slate-600'}>
                {formatNaira(product.sellingPrice)} each
              </p>

              <div className={`flex items-center gap-0.5 ${compact ? 'mt-1' : 'mt-2'}`}>
                <button
                  type="button"
                  onClick={() => onUpdateQty(line.productId, line.quantity - 1)}
                  className={`flex shrink-0 items-center justify-center rounded border bg-slate-50 font-bold ${btnSize}`}
                  aria-label="Decrease"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={product.quantity}
                  value={line.quantity}
                  onChange={(e) => onUpdateQty(line.productId, e.target.value)}
                  className={`w-full min-w-[2.5rem] rounded border bg-white px-0.5 text-center font-bold ${inputH}`}
                />
                <button
                  type="button"
                  onClick={() => onUpdateQty(line.productId, line.quantity + 1)}
                  disabled={line.quantity >= product.quantity}
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
