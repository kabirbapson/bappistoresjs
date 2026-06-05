export const STORE_NAME = 'BAPPI STORES - KANO'

export const STORE_LOGO_SRC = '/BAPP11.png'

/** BAPS1.png already includes name, addresses, and phones — hide those on receipts. */
export const STORE_LOGO_INCLUDES_RECEIPT_HEADER = true

export const STORE_ADDRESSES = [
  'No. 80 Hauwa Marshal behind Malam Kato',
  'No. 04 Bayan Glo Office - Nakowa Plaza',
]

export const STORE_PHONES = ['08084277233', '07065761433']

export const STORE_RECEIPT_TITLE = 'SALES INVOICE'

export const STORE_RECEIPT_FOOTER_ARABIC = 'بالتوفيق والسلامة'

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
]

export const LOW_STOCK_THRESHOLD = 50

export const PRODUCT_CATEGORY = 'Beverages'

/** Add-to-qty buttons on the sales cart (100, 200, 500). */
export const QUICK_QTY_INCREMENTS = [100, 200, 500]

/** Checkout payment mode — must pick one before recording a sale. */
export const SALE_PAYMENT_MODES = [
  { id: 'cash', label: 'Cash', apiMethod: 'cash', tone: 'emerald' },
  { id: 'transfer', label: 'Transfer', apiMethod: 'pos', tone: 'sky' },
  { id: 'pos', label: 'POS', apiMethod: 'pos', tone: 'violet' },
  { id: 'credit', label: 'Credit', apiMethod: null, tone: 'amber' },
]

export const PAYMENT_METHODS = ['cash', 'pos']

export const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  pos: 'POS / Transfer',
  transfer: 'POS / Transfer', // legacy records
}

export function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || method || '—'
}

/** Product sales history dialog — date filters (server period keys). */
export const PRODUCT_HISTORY_SCOPES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'lastMonth', label: 'Last month' },
]

export const SALE_TYPE_LABELS = {
  paid: 'Paid in full',
  partial: 'Partial + credit',
  credit: 'On credit',
  cash: 'Paid in full',
}
