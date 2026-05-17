import {
  RECEIPT_PAPER_MM_DEFAULT,
  RECEIPT_PAPER_STORAGE_KEY,
} from '../constants'

function runPrint(mode) {
  document.body.classList.add(mode)
  window.print()
  const cleanup = () => {
    document.body.classList.remove(mode)
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  setTimeout(cleanup, 1000)
}

export function getReceiptPaperMm() {
  const stored = localStorage.getItem(RECEIPT_PAPER_STORAGE_KEY)
  if (stored === '58' || stored === '80') return Number(stored)
  return RECEIPT_PAPER_MM_DEFAULT
}

export function setReceiptPaperMm(mm) {
  const value = mm === 80 ? 80 : 58
  localStorage.setItem(RECEIPT_PAPER_STORAGE_KEY, String(value))
  applyReceiptPaperMm(value)
}

export function applyReceiptPaperMm(mm = getReceiptPaperMm()) {
  document.documentElement.dataset.receiptMm = String(mm === 80 ? 80 : 58)
}

if (typeof document !== 'undefined') {
  applyReceiptPaperMm()
}

/** Thermal receipt — 58mm (MP-58MINI) or 80mm via Settings on print dialog. */
export function printThermalReceipt() {
  applyReceiptPaperMm()
  runPrint('printing-receipt')
}

/** Classic A4 invoice (Invoices page). */
export function printClassicInvoice() {
  runPrint('printing-classic-invoice')
}
