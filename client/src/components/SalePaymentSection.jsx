import NumericInput from './NumericInput'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SALE_PAYMENT_MODES } from '../constants'
import { formatNaira } from '../utils/format'
const TONE_STYLES = {
  emerald: {
    base: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
    active: 'border-emerald-600 bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50',
    dot: 'bg-emerald-500',
  },
  sky: {
    base: 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100',
    active: 'border-sky-600 bg-sky-600 text-white shadow-md ring-2 ring-sky-400/50',
    dot: 'bg-sky-500',
  },
  violet: {
    base: 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100',
    active: 'border-violet-600 bg-violet-600 text-white shadow-md ring-2 ring-violet-400/50',
    dot: 'bg-violet-500',
  },
  amber: {
    base: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
    active: 'border-amber-500 bg-amber-500 text-white shadow-md ring-2 ring-amber-400/50',
    dot: 'bg-amber-500',
  },
}

export default function SalePaymentSection({
  cartTotal,
  paymentMode,
  onPaymentModeChange,
  paidAmount,
  onPaidAmountChange,
  payments,
  onChangePayments,
  creditBalance,
  needsRegisteredCustomer,
  compact = false,
  footerSlot = null,
}) {
  if (payments && onChangePayments) {
    return (
      <EditInvoicePayments
        cartTotal={cartTotal}
        payments={payments}
        onChangePayments={onChangePayments}
        creditBalance={creditBalance}
        needsRegisteredCustomer={needsRegisteredCustomer}
        compact={compact}
      />
    )
  }

  const paidTotal = Number(paidAmount) || 0
  const isCredit = paymentMode === 'credit'

  const summaryCols = (
    <div
      className={`grid w-full shrink-0 grid-cols-3 gap-1.5 rounded-xl border-2 border-slate-200 bg-white p-1.5 shadow-md sm:w-auto ${
        compact ? 'min-w-[19rem]' : 'min-w-[22rem] gap-2 p-2'
      }`}
    >
      <div className="rounded-lg bg-slate-800 px-2 py-2.5 text-center text-white sm:py-3">
        <p className="text-sm font-black uppercase tracking-wide text-white">Total</p>
        <p className={`mt-1 font-extrabold tabular-nums leading-tight ${compact ? 'text-xl' : 'text-2xl'}`}>
          {formatNaira(cartTotal)}
        </p>
      </div>
      <div className="rounded-lg bg-emerald-700 px-2 py-2.5 text-center text-white sm:py-3">
        <p className="text-sm font-black uppercase tracking-wide text-white">Paid</p>
        <p className={`mt-1 font-extrabold tabular-nums leading-tight ${compact ? 'text-xl' : 'text-2xl'}`}>
          {paymentMode ? formatNaira(paidTotal) : '—'}
        </p>
      </div>
      <div className="rounded-lg bg-amber-600 px-2 py-2.5 text-center text-white sm:py-3">
        <p className="text-sm font-black uppercase tracking-wide text-white">Credit</p>
        <p className={`mt-1 font-extrabold tabular-nums leading-tight ${compact ? 'text-xl' : 'text-2xl'}`}>
          {paymentMode ? formatNaira(creditBalance) : '—'}
        </p>
      </div>
    </div>
  )

  return (
    <div className={compact ? 'space-y-2' : 'glass-panel space-y-4 p-4'}>
      {!compact && (
        <p className="text-xs text-slate-500">Select one before recording the sale</p>
      )}

      <div>
        <p className={`mb-1.5 text-sm font-semibold text-slate-600 ${compact ? '' : 'text-base'}`}>
          Payment method
        </p>
        <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap sm:gap-3">
          <div className={`grid min-w-0 flex-1 grid-cols-4 ${compact ? 'gap-1.5' : 'gap-2'} basis-full sm:basis-auto`}>
            {SALE_PAYMENT_MODES.map((mode) => {
              const tone = TONE_STYLES[mode.tone]
              const active = paymentMode === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onPaymentModeChange(mode.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 text-center font-bold transition ${
                    compact ? 'py-2.5 text-sm' : 'py-3 text-base'
                  } ${active ? tone.active : tone.base}`}
                >
                  <span
                    className={`rounded-full ${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} ${active ? 'bg-white/90' : tone.dot}`}
                  />
                  {mode.label}
                </button>
              )
            })}
          </div>
          <div className="w-full sm:w-auto">{summaryCols}</div>
        </div>
      </div>

      {!paymentMode && !compact && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-sm font-medium text-rose-800 ring-1 ring-rose-100">
          Choose Cash, Transfer, POS, or Credit above
        </p>
      )}

      <div className="flex min-w-0 flex-nowrap items-center gap-2">
        <label className="shrink-0 text-sm font-semibold text-slate-600">
          {isCredit ? 'Paid now' : 'Amount received'}
        </label>
        <NumericInput
          placeholder={!paymentMode ? 'Select payment' : isCredit ? '0 for full credit' : undefined}
          disabled={!paymentMode}
          className={`glass-input min-w-0 flex-1 font-bold tabular-nums disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${
            compact ? 'px-3 py-2.5 text-xl' : 'px-3 py-3 text-xl'
          }`}
          value={paidAmount === '' || paidAmount == null ? '' : Number(paidAmount)}
          onChange={(v) => onPaidAmountChange(v === '' ? '' : String(v))}
        />
        {paymentMode && !isCredit && paidTotal !== cartTotal && (
          <button
            type="button"
            onClick={() => onPaidAmountChange(String(cartTotal))}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Full
          </button>
        )}
        {footerSlot ? <div className="shrink-0">{footerSlot}</div> : null}
      </div>

      {needsRegisteredCustomer && (
        <p
          className={`rounded-lg bg-amber-50 font-medium text-amber-900 ring-1 ring-amber-200 ${
            compact ? 'px-3 py-1.5 text-sm' : 'px-3 py-2 text-sm'
          }`}
        >
          Credit requires a registered customer for partial payment or credit sales.
        </p>
      )}
    </div>
  )
}

function EditInvoicePayments({
  cartTotal,
  payments,
  onChangePayments,
  creditBalance,
  needsRegisteredCustomer,
  compact,
}) {
  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  function updateRow(index, field, value) {
    onChangePayments(
      payments.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  return (
    <div className={compact ? 'space-y-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-200' : 'glass-panel space-y-3 p-4'}>
      <span className={`font-semibold text-slate-800 ${compact ? 'text-sm' : 'text-lg'}`}>Payment</span>
      {payments.map((row, index) => (
        <div key={index} className="flex gap-1.5">
          <select
            className={`glass-input shrink-0 font-medium ${compact ? 'w-[7rem] px-2 py-2 text-sm' : 'w-40 p-3 text-lg'}`}
            value={row.method}
            onChange={(e) => updateRow(index, 'method', e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <NumericInput
            placeholder="Amount ₦"
            className={`glass-input min-w-0 flex-1 font-semibold tabular-nums ${compact ? 'px-2 py-2 text-base' : 'p-3 text-xl'}`}
            value={row.amount === '' || row.amount == null ? '' : Number(row.amount)}
            onChange={(v) => updateRow(index, 'amount', v === '' ? '' : String(v))}
          />
        </div>
      ))}
      <div className="grid grid-cols-3 gap-1 border-t border-slate-200 pt-2 text-xs">
        <div className="text-center">
          <span className="block text-slate-500">Total</span>
          <span className="text-sm font-bold tabular-nums">{formatNaira(cartTotal)}</span>
        </div>
        <div className="text-center text-emerald-800">
          <span className="block">Paid</span>
          <span className="text-sm font-bold tabular-nums">{formatNaira(paidTotal)}</span>
        </div>
        <div className="text-center text-amber-800">
          <span className="block">Credit</span>
          <span className="text-sm font-bold tabular-nums">
            {creditBalance > 0 ? formatNaira(creditBalance) : '—'}
          </span>
        </div>
      </div>
      {needsRegisteredCustomer && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
          Pick a registered customer for {formatNaira(creditBalance)} credit.
        </p>
      )}
    </div>
  )
}
