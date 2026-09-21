import { useState } from 'react'
import { STORE_LOGO_SRC, RECEIPT_PAPER_OPTIONS } from '../constants'
import { formatNaira, formatDateTable } from '../utils/format'
import { getReceiptPaperMm, printThermalReceipt, setReceiptPaperMm } from '../utils/print'

export default function PaymentReceipt({
  payment,
  onClose,
  title = "CUSTOMER PAYMENT RECEIPT",
  type = "Purchase Payment"
}) {
  const [paperMm, setPaperMm] = useState(() => getReceiptPaperMm())

  if (!payment) return null

  const onPaperChange = (mm) => {
    setPaperMm(mm)
    setReceiptPaperMm(mm)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-max max-w-[calc(100%-0.5rem)] max-h-[92vh] flex flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-slate-900">Invoice preview</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>

        <div className="flex flex-1 justify-center overflow-y-auto p-3 sm:p-4">
          <div className="thermal-receipt-preview bg-white shadow-sm ring-1 ring-slate-200 p-3">
            <ReceiptBody payment={payment} title={title} type={type} />
          </div>
        </div>

        <div className="no-print shrink-0 space-y-3 border-t p-4">
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
              className="rounded-lg border px-4 py-3 text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>

        <p className="no-print shrink-0 px-4 pb-4 text-center text-xs text-slate-500">
          Default <strong>XP-80T</strong> (80mm): choose <strong>{paperMm}mm</strong> paper (or custom width) and
          scale <strong>100%</strong> in the print dialog. Use 58mm only for MP-58MINI. Turn off browser
          headers/footers if a URL appears on the slip.
        </p>
      </div>

      <div id="thermal-receipt-print" className="thermal-receipt-print" aria-hidden="true">
        <ReceiptBody payment={payment} title={title} type={type} />
      </div>
    </div>
  )
}

function ReceiptBody({ payment, title, type }) {
  const dateStr = formatDateTable(payment.date || Date.now());
  const ref = payment.reference || payment._id?.slice(-8).toUpperCase() || 'TX';
  const customerName = payment.name || payment.customerName || 'Customer';
  const customerPhone = payment.phone || payment.customerPhone;
  
  return (
    <article className="thermal-receipt font-mono text-[13px] leading-[1.3] text-black w-full" style={{ width: '100%' }}>
      {/* Logo */}
      <div className="mb-3">
        <img src={STORE_LOGO_SRC} alt="Bappi Stores Logo" className="receipt-logo w-full h-auto object-contain grayscale" />
      </div>

      {/* Title */}
      <div className="text-center font-bold mb-2 uppercase tracking-wide">
        {title}
      </div>

      <div className="border-b border-dashed border-black mb-1"></div>

      {/* Header Info */}
      <div className="flex justify-between">
        <span>Invoice</span>
        <span className="font-bold">BSK-{ref}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span>Date</span>
        <span>{dateStr}</span>
      </div>

      <div className="border-b border-dotted border-black mb-1"></div>

      {/* Customer Info */}
      <div className="mb-1">
        <span>Customer: <span className="font-bold">{customerName}</span></span>
      </div>
      {customerPhone && (
        <div className="mb-1 flex justify-between">
          <span>Phone:</span>
          <span>{customerPhone}</span>
        </div>
      )}

      <div className="border-b border-dotted border-black mb-1.5"></div>

      {/* Items Table */}
      <table className="w-full text-left mb-1.5 table-fixed">
        <thead>
          <tr className="border-b border-black">
            <th className="font-normal pb-1 w-[55%]"># Item</th>
            <th className="font-normal text-right pb-1 w-[15%]">Qty</th>
            <th className="font-normal text-right pb-1 w-[30%]">Amt</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pt-1.5 pr-1 align-top break-words">
              <span className="text-gray-500 mr-1">1</span> 
              {payment.reason || type}
            </td>
            <td className="pt-1.5 text-right align-top">-</td>
            <td className="pt-1.5 text-right align-top">{formatNaira(payment.amount || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div className="border-b border-black mb-1.5"></div>

      {/* Total */}
      <div className="flex justify-between font-bold text-[14px] mb-1.5">
        <span>TOTAL</span>
        <span>{formatNaira(payment.amount || 0)}</span>
      </div>

      <div className="border-b border-dotted border-black mb-1.5"></div>

      {/* Ledger Balance Info */}
      <div className="flex justify-between mb-0.5">
        <span>Prev Balance</span>
        <span>{formatNaira(payment.previousBalance || 0)}</span>
      </div>
      <div className="flex justify-between mb-0.5 gap-4">
        <span className="truncate">{payment.reason || 'Transaction'}</span>
        <span className="shrink-0">{formatNaira(payment.amount || 0)}</span>
      </div>
      <div className="flex justify-between font-bold mb-1.5">
        <span>Current Bal</span>
        <span>{formatNaira(payment.balance || 0)}</span>
      </div>

      <div className="border-b border-dashed border-black mb-3"></div>

      {/* Footer */}
      <div className="text-center">
        <p className="mb-2">Thank you for shopping with us!</p>
        <p className="font-bold text-[16px] leading-relaxed" dir="rtl">بالتوفيق والسلامة</p>
      </div>
    </article>
  )
}
