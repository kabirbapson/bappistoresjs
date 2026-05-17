import StoreBranding from './StoreBranding'
import { paymentMethodLabel } from '../constants'
import { formatDate, formatNaira } from '../utils/format'

export default function ClassicInvoice({ invoice, className = '' }) {
  if (!invoice) return null

  const hasCredit = (invoice.creditBalance || 0) > 0

  return (
    <article
      className={`classic-invoice mx-auto bg-white p-6 text-slate-900 shadow-inner sm:p-8 ${className}`}
    >
      <header className="flex flex-col gap-4 border-b-2 border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <StoreBranding
          align="left"
          showLogo
          logoClassName="h-16 w-auto max-w-[200px] object-contain"
          nameClassName="text-lg font-bold tracking-wide text-slate-900"
        />
        <div className="text-left sm:text-right">
          <h1 className="font-serif text-3xl font-bold tracking-[0.2em] text-slate-800 sm:text-4xl">
            INVOICE
          </h1>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-700">
            {invoice.invoiceNumber || '—'}
          </p>
        </div>
      </header>

      <section className="mt-5 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill to</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{invoice.customerName}</p>
          {invoice.customerPhone && (
            <p className="mt-0.5 text-slate-600">Tel: {invoice.customerPhone}</p>
          )}
          {invoice.customerAddress && (
            <p className="mt-0.5 text-slate-600">{invoice.customerAddress}</p>
          )}
        </div>
        <div className="sm:text-right">
          <MetaRow label="Invoice date" value={formatDate(invoice.date)} />
          {hasCredit && (
            <MetaRow
              label="Balance due"
              value={formatNaira(invoice.creditBalance)}
              valueClassName="font-semibold text-amber-800"
            />
          )}
        </div>
      </section>

      <div className="mt-6 overflow-hidden rounded border border-slate-300">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-700">
              <th className="w-10 px-3 py-2.5 font-semibold">#</th>
              <th className="px-3 py-2.5 font-semibold">Description</th>
              <th className="w-16 px-3 py-2.5 text-center font-semibold">Qty</th>
              <th className="w-28 px-3 py-2.5 text-right font-semibold">Unit price</th>
              <th className="w-28 px-3 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((line, i) => (
              <tr key={i} className="border-b border-slate-200 last:border-b-0">
                <td className="px-3 py-2.5 tabular-nums text-slate-500">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-slate-900">{line.productName}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNaira(line.unitPrice)}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                  {formatNaira(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <TotalRow label="Subtotal" value={formatNaira(invoice.totalAmount)} bold />
          {(invoice.payments?.length > 0 || invoice.amountPaid > 0) && (
            <>
              {invoice.payments?.map((p, i) => (
                <TotalRow
                  key={i}
                  label={paymentMethodLabel(p.method)}
                  value={formatNaira(p.amount)}
                />
              ))}
              <TotalRow label="Paid now" value={formatNaira(invoice.amountPaid)} />
            </>
          )}
          {hasCredit && (
            <TotalRow
              label="Balance owed"
              value={formatNaira(invoice.creditBalance)}
              bold
              valueClassName="text-amber-800"
            />
          )}
          <div className="border-t-2 border-slate-800 pt-2">
            <TotalRow
              label="Total"
              value={formatNaira(invoice.totalAmount)}
              bold
              large
            />
          </div>
        </div>
      </div>

      {invoice.note && (
        <p className="mt-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Note:</span> {invoice.note}
        </p>
      )}

      <footer className="mt-8 border-t border-slate-300 pt-4 text-center text-xs text-slate-500">
        <p className="font-medium text-slate-700">Thank you for your business.</p>
        {/* <p className="mt-1">Goods sold are not refundable unless agreed in writing.</p> */}
      </footer>
    </article>
  )
}

function MetaRow({ label, value, valueClassName = 'font-medium text-slate-900' }) {
  return (
    <p className="mt-1 flex justify-between gap-4 sm:justify-end">
      <span className="text-slate-500">{label}</span>
      <span className={valueClassName}>{value}</span>
    </p>
  )
}

function TotalRow({ label, value, bold = false, large = false, valueClassName = '' }) {
  return (
    <div
      className={`flex justify-between gap-4 ${bold ? 'font-semibold text-slate-900' : 'text-slate-600'} ${large ? 'text-base' : ''}`}
    >
      <span>{label}</span>
      <span className={`tabular-nums ${valueClassName}`}>{value}</span>
    </div>
  )
}
