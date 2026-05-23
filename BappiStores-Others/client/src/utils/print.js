import {
  RECEIPT_PAPER_MM_DEFAULT,
  RECEIPT_PAPER_STORAGE_KEY,
} from '../constants'

const PRINT_ROOT_BY_MODE = {
  'printing-receipt': 'thermal-receipt-print',
  'printing-classic-invoice': 'classic-invoice-print',
}

/** Move print root to <body> so layout overflow:hidden does not clip the page. */
function hoistPrintRoot(id) {
  const el = document.getElementById(id)
  if (!el || el.parentElement === document.body) return null
  const marker = document.createComment(`print-anchor-${id}`)
  el.parentElement.insertBefore(marker, el)
  document.body.appendChild(el)
  return marker
}

function restorePrintRoot(el, marker) {
  if (!el || !marker?.parentNode) return
  marker.parentNode.insertBefore(el, marker)
  marker.remove()
}

function runPrint(mode) {
  const rootId = PRINT_ROOT_BY_MODE[mode]
  const root = rootId ? document.getElementById(rootId) : null
  const marker = rootId ? hoistPrintRoot(rootId) : null

  document.documentElement.classList.add(mode)
  document.body.classList.add(mode)
  window.print()

  const cleanup = () => {
    document.documentElement.classList.remove(mode)
    document.body.classList.remove(mode)
    restorePrintRoot(root, marker)
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
