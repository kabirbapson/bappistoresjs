const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatNaira(amount) {
  return naira.format(amount ?? 0)
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/** Date only — no time (reports tables). */
export function formatDateOnly(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

/** Date + time for thermal receipt header (right-aligned block). */
export function formatReceiptMetaDate(iso) {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  return {
    date: new Intl.DateTimeFormat('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d),
    time: new Intl.DateTimeFormat('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d),
  }
}

/** Single-line date + time for narrow table columns (e.g. 16 May 26, 2:30 pm). */
export function formatDateTable(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export const DASHBOARD_LABELS = {
  totalProducts: 'Products',
  totalStockValue: 'Stock value',
  lowStockAlerts: 'Low stock alerts',
  dailySales: "Today's sales",
  outstandingDebt: 'Outstanding debt',
  totalPaymentsReceived: 'Payments received',
}

const CURRENCY_KEYS = new Set([
  'totalStockValue',
  'dailySales',
  'outstandingDebt',
  'totalPaymentsReceived',
])

export function formatDashboardValue(key, value) {
  if (CURRENCY_KEYS.has(key)) return formatNaira(value)
  return Number(value).toLocaleString('en-NG')
}
