import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../constants'
import { formatNaira } from '../utils/format'

export default function SalePaymentSection({
  cartTotal,
  payments,
  onChangePayments,
  creditBalance,
  needsRegisteredCustomer,
  compact = false,
}) {
  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  function updateRow(index, field, value) {
    const next = payments.map((row, i) =>
      i === index ? { ...row, [field]: value } : row,
    )
    onChangePayments(next)
  }

  function addRow() {
    onChangePayments([...payments, { method: 'cash', amount: '' }])
  }

  function removeRow(index) {
    if (payments.length <= 1) return
    onChangePayments(payments.filter((_, i) => i !== index))
  }

  function payFull(method) {
    onChangePayments([{ method, amount: String(cartTotal) }])
  }

  if (cartTotal <= 0) return null

  const amountClass = compact ? 'text-lg font-bold tabular-nums' : 'text-xl font-bold tabular-nums'
  const labelClass = compact ? 'text-sm font-medium' : 'text-base'

  const totalsBlock = compact ? (
    <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
      <div className="text-center">
        <span className={`block text-slate-600 ${labelClass}`}>Total</span>
        <span className={`${amountClass} text-slate-900`}>{formatNaira(cartTotal)}</span>
      </div>
      <div className="text-center text-emerald-800">
        <span className={`block text-emerald-700 ${labelClass}`}>Paid</span>
        <span className={amountClass}>{formatNaira(paidTotal)}</span>
      </div>
      <div className={`text-center ${creditBalance > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
        <span className={`block ${labelClass}`}>Credit</span>
        <span className={amountClass}>
          {creditBalance > 0 ? formatNaira(creditBalance) : '—'}
        </span>
      </div>
    </div>
  ) : (
    <div className="space-y-2 border-t border-slate-200 pt-2">
      <div className="flex justify-between">
        <span className={`text-slate-600 ${labelClass}`}>Sale total</span>
        <span className={amountClass}>{formatNaira(cartTotal)}</span>
      </div>
      <div className="flex justify-between text-emerald-800">
        <span className={labelClass}>Paid now</span>
        <span className={amountClass}>{formatNaira(paidTotal)}</span>
      </div>
      {creditBalance > 0 && (
        <div className="flex justify-between text-amber-800">
          <span className={labelClass}>Credit (pay later)</span>
          <span className={amountClass}>{formatNaira(creditBalance)}</span>
        </div>
      )}
    </div>
  )

  return (
    <div
      className={
        compact
          ? 'space-y-2.5 rounded-lg border border-slate-200 bg-white p-3'
          : 'space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`font-semibold text-slate-800 ${compact ? 'text-base' : 'text-lg'}`}>
          Payment
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => payFull('cash')}
            className={`rounded border bg-white font-medium text-slate-700 hover:bg-emerald-50 ${compact ? 'px-3 py-1.5 text-sm' : 'px-3 py-2 text-base'}`}
          >
            Full · Cash
          </button>
          <button
            type="button"
            onClick={() => payFull('pos')}
            className={`rounded border bg-white font-medium text-slate-700 hover:bg-emerald-50 ${compact ? 'px-3 py-1.5 text-sm' : 'px-3 py-2 text-base'}`}
          >
            Full · POS
          </button>
        </div>
      </div>

      {payments.map((row, index) => (
        <div key={index} className="flex gap-2">
          <select
            className={`rounded-lg border bg-white font-medium ${compact ? 'w-36 p-2.5 text-base' : 'w-40 p-3 text-lg'}`}
            value={row.method}
            onChange={(e) => updateRow(index, 'method', e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            placeholder="Amount ₦"
            className={`min-w-0 flex-1 rounded-lg border bg-white font-semibold tabular-nums ${compact ? 'p-2.5 text-lg' : 'p-3 text-xl'}`}
            value={row.amount}
            onChange={(e) => updateRow(index, 'amount', e.target.value)}
          />
          {payments.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="rounded border px-2 text-lg text-rose-600"
              aria-label="Remove payment"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {!compact && (
        <button
          type="button"
          onClick={addRow}
          className={`font-medium text-emerald-700 hover:underline ${compact ? 'text-base' : 'text-lg'}`}
        >
          + Split payment (cash + POS / transfer)
        </button>
      )}
      {compact && payments.length === 1 && (
        <button
          type="button"
          onClick={addRow}
          className={`font-medium text-emerald-700 hover:underline ${compact ? 'text-base' : 'text-lg'}`}
        >
          + Split payment
        </button>
      )}

      {totalsBlock}

      {needsRegisteredCustomer && (
        <p
          className={`rounded bg-amber-50 text-amber-900 ${compact ? 'px-2 py-1.5 text-base' : 'rounded-lg px-2 py-2 text-base'}`}
        >
          Pick a registered customer for {formatNaira(creditBalance)} credit.
        </p>
      )}
    </div>
  )
}
