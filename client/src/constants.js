/** Default thermal roll — Xprinter XP-80T (80mm). */
export const RECEIPT_PAPER_MM_DEFAULT = 80

export const RECEIPT_PAPER_STORAGE_KEY = 'bappistores.receiptPaperMm'

export const RECEIPT_PAPER_OPTIONS = [
  { mm: 80, label: '80mm (XP-80T, etc.)' },
  { mm: 58, label: '58mm (MP-58MINI, etc.)' },
]

export const NAV_ITEMS = [
  ['Dashboard', '/'],
  ['Make Sales', '/sales'],
  ['Products', '/products'],
  ['Customers', '/customers'],
  ['Invoices', '/invoices'],
  ['Debts', '/debts'],
  ['Reports', '/reports'],
  ['Shop setup', '/settings'],
]

export const LOW_STOCK_THRESHOLD = 50

export const PRODUCT_CATEGORY = 'Beverages'

/** Quick quantity buttons for bulk sales (units). */
export const QUICK_QUANTITIES = [10, 50, 100, 200, 500, 1000]

export const PAYMENT_METHODS = ['cash', 'pos']

export const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  pos: 'POS / Transfer',
  transfer: 'POS / Transfer', // legacy records
}

export function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || method || '—'
}

export const SALE_TYPE_LABELS = {
  paid: 'Paid in full',
  partial: 'Partial + credit',
  credit: 'On credit',
  cash: 'Paid in full',
}
