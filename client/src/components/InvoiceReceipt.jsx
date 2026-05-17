import { useState } from 'react'
import StoreBranding from './StoreBranding'
import {
  paymentMethodLabel,
  RECEIPT_PAPER_OPTIONS,
  STORE_RECEIPT_FOOTER_ARABIC,
} from '../constants'
import { formatDate, formatNaira } from '../utils/format'
import { getReceiptPaperMm, printThermalReceipt, setReceiptPaperMm } from '../utils/print'

export default function InvoiceReceipt({
  invoice,
  onClose,
  showActions = true,
  title = 'Receipt preview',
}) {
  const [paperMm, setPaperMm] = useState(() => getReceiptPaperMm())

  if (!invoice) return null

  const onPaperChange = (mm) => {
    setPaperMm(mm)
    setReceiptPaperMm(mm)
  }

  return (
    <div className={showActions ? 'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center' : ''}>
      <div className={`w-max max-w-[calc(100%-0.5rem)] ${showActions ? 'rounded-t-2xl bg-white shadow-xl sm:rounded-2xl' : ''}`}>
        {showActions && (
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
              Close
            </button>
          </div>
        )}

        <div className="flex justify-center p-3 sm:p-4">
          <div className="thermal-receipt-preview">
            <ReceiptBody invoice={invoice} />
          </div>
        </div>

        {showActions && (
          <div className="no-print space-y-3 border-t p-4">
            <label className="block text-xs font-medium text-slate-600">
              Paper width
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                value={paperMm}
                onChange={(e) => onPaperChange(Number(e.target.value))}
              >
                {RECEIPT_PAPER_OPTIONS.map((o) => (
                  <option key={o.mm} value={o.mm}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={printThermalReceipt}
                className="flex-1 rounded-lg bg-emerald-700 py-3 font-medium text-white hover:bg-emerald-800"
              >
                Print receipt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-3 text-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        )}

        <p className="no-print px-4 pb-4 text-center text-xs text-slate-500">
          Default <strong>XP-80T</strong> (80mm): choose <strong>{paperMm}mm</strong> paper (or custom width) and
          scale <strong>100%</strong> in the print dialog. Use 58mm only for MP-58MINI. Turn off browser
          headers/footers if a URL appears on the slip.
        </p>
      </div>

      <div id="thermal-receipt-print" className="thermal-receipt-print" aria-hidden="true">
        <ReceiptBody invoice={invoice} />
      </div>
    </div>
  )
}

function ReceiptBody({ invoice }) {
  const hasCredit = (invoice.creditBalance || 0) > 0

  return (
    <article className="thermal-receipt mx-auto font-mono leading-snug text-black">
      <header className="border-b border-dashed border-black pb-2 text-center">
        <StoreBranding
          showLogo
          receipt
          logoClassName="receipt-logo mx-auto mb-2"
          nameClassName="receipt-store-name font-bold"
        />
      </header>

      <section className="border-b border-dashed border-black py-2 text-xs">
        <Row label="Invoice" value={invoice.invoiceNumber || '—'} valueClassName="font-semibold tabular-nums" />
        <Row label="Date" value={formatDate(invoice.date)} />
        <div className="mt-2 space-y-1 border-t border-dotted border-black/40 pt-1.5 text-left leading-snug">
          <LeftField label="Customer" value={invoice.customerName} valueClassName="font-bold" />
          {invoice.customerPhone && <LeftField label="Phone" value={invoice.customerPhone} />}
        </div>
      </section>

      <table className="w-full border-collapse py-2 text-xs">
          <thead>
            <tr className="border-b border-black">
              <th className="w-5 py-1 text-center font-semibold">#</th>
              <th className="py-1 text-left font-semibold">Item</th>
              <th className="w-8 py-1 text-center font-semibold">Qty</th>
              <th className="w-14 py-1 text-right font-semibold">Amt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((line, i) => (
              <tr key={i} className="border-b border-dotted border-slate-400">
                <td className="py-1 text-center tabular-nums text-slate-600">{i + 1}</td>
                <td className="py-1 pr-1">{line.productName}</td>
                <td className="py-1 text-center tabular-nums">{line.quantity}</td>
                <td className="py-1 text-right tabular-nums">{formatNaira(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
      </table>

      <section className="border-t border-double border-black pt-2 text-sm">
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{formatNaira(invoice.totalAmount)}</span>
        </div>
        {(invoice.payments?.length > 0 || invoice.amountPaid > 0) && (
          <div className="mt-2 space-y-0.5 border-t border-dotted border-black pt-2 text-xs">
            {invoice.payments?.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span>{paymentMethodLabel(p.method)}</span>
                <span>{formatNaira(p.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold">
              <span>Paid now</span>
              <span>{formatNaira(invoice.amountPaid)}</span>
            </div>
          </div>
        )}
        {hasCredit && (
          <div className="mt-1 flex justify-between text-xs font-semibold">
            <span>Balance owed</span>
            <span>{formatNaira(invoice.creditBalance)}</span>
          </div>
        )}
      </section>

      {invoice.note && (
        <p className="mt-2 text-center text-xs">Note: {invoice.note}</p>
      )}

      <footer className="mt-3 border-t border-dashed border-black pt-2 text-center text-xs leading-snug">
        <p>Thank you for shopping with us!</p>
        <p className="mt-1.5 font-medium" dir="rtl" lang="ar">
          {STORE_RECEIPT_FOOTER_ARABIC}
        </p>
      </footer>
    </article>
  )
}

function Row({ label, value, valueClassName = '' }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0">{label}</span>
      <span className={`min-w-0 text-right font-medium ${valueClassName}`}>{value}</span>
    </div>
  )
}

function LeftField({ label, value, valueClassName = '' }) {
  return (
    <p>
      <span className="font-medium">{label}:</span>{' '}
      <span className={valueClassName}>{value}</span>
    </p>
  )
}

