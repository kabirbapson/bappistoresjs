import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import StoreLogo from '../components/StoreLogo'
import api from '../api'
import { displayShopName, useShopSettingsStore } from '../shopSettingsStore'
import { DASHBOARD_LABELS, formatDashboardValue, formatNaira } from '../utils/format'

const QUICK_LINKS = [
  { to: '/sales', label: 'Make sales', primary: true },
  { to: '/products', label: 'Products' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/debts', label: 'Debts' },
  { to: '/reports', label: 'Reports' },
]

const CARD_STYLES = {
  dailySales: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
  outstandingDebt: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white',
  totalProducts: 'border-slate-200 bg-white',
  lowStockAlerts: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
  totalStockValue: 'border-sky-200 bg-gradient-to-br from-sky-50/80 to-white',
  totalPaymentsReceived: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white',
}

const CARD_ORDER = [
  'dailySales',
  'outstandingDebt',
  'totalProducts',
  'lowStockAlerts',
  'totalStockValue',
  'totalPaymentsReceived',
]

const CARD_LINKS = {
  dailySales: '/sales',
  outstandingDebt: '/debts',
  totalProducts: '/products',
  lowStockAlerts: '/products?stock=low',
  totalStockValue: '/products',
  totalPaymentsReceived: '/reports',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="font-semibold text-emerald-700">{formatNaira(payload[0].value)}</p>
    </div>
  )
}

function StatCard({ to, label, value, className = '' }) {
  return (
    <Link
      to={to}
      className={`block rounded-xl border px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
    </Link>
  )
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-7 w-24 rounded bg-slate-200" />
    </div>
  )
}

export default function DashboardPage() {
  const settings = useShopSettingsStore((s) => s.settings)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get('/reports/dashboard')
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  const today = new Intl.DateTimeFormat('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <PageShell
      scroll={false}
      header={
        <div className="space-y-3">
          <PageHeader title="Dashboard" subtitle={today} />
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-lg bg-white p-2 shadow-sm">
                  <StoreLogo className="h-auto w-full max-w-[280px] object-contain" />
                </div>
                <p className="text-base font-bold leading-tight tracking-wide text-white sm:text-lg">
                  {displayShopName(settings)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_LINKS.map(({ to, label, primary }) => (
                  <Link
                    key={to}
                    to={to}
                    className={
                      primary
                        ? 'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-400'
                        : 'rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20'
                    }
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {loading ? (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
            <div className="flex min-h-0 flex-1 animate-pulse flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="mt-4 min-h-0 flex-1 rounded-lg bg-slate-100" />
            </div>
          </>
        ) : !stats ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
            <p className="font-medium">Could not load the dashboard.</p>
            <p className="mt-2 text-amber-800">
              After a software update, sign out and sign in again with your admin password.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {CARD_ORDER.map((key) => (
                <StatCard
                  key={key}
                  to={CARD_LINKS[key]}
                  label={DASHBOARD_LABELS[key] || key}
                  value={formatDashboardValue(key, stats.cards?.[key])}
                  className={CARD_STYLES[key] || 'border-slate-200 bg-white'}
                />
              ))}
            </div>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Sales trend</h2>
                  <p className="text-sm text-slate-500">Last 14 days — amounts in Naira (₦)</p>
                </div>
                {(stats.cards?.dailySales ?? 0) > 0 && (
                  <p className="text-sm text-slate-600">
                    Today:{' '}
                    <span className="font-bold text-emerald-700">
                      {formatNaira(stats.cards.dailySales)}
                    </span>
                  </p>
                )}
              </div>
              <div className="min-h-0 flex-1">
                {stats.dailySales?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dailySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="_id"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(5, 150, 105, 0.08)' }} />
                      <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center">
                    <p className="text-3xl">📊</p>
                    <p className="mt-2 font-medium text-slate-700">No sales in this period yet</p>
                    <p className="mt-1 text-sm text-slate-500">Record a sale to see the chart fill in</p>
                    <Link
                      to="/sales"
                      className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Make sales
                    </Link>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </PageShell>
  )
}
