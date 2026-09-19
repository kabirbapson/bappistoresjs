import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import StoreLogo from '../components/StoreLogo'
import api from '../api'
import { STORE_NAME } from '../constants'
import { DASHBOARD_LABELS, formatDashboardValue, formatNaira } from '../utils/format'

const QUICK_LINKS = [
  { to: '/sales', label: 'Make sales', primary: true },
  { to: '/receive-stock', label: 'Receive stock' },
  { to: '/credit', label: 'Credit' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/reminders', label: 'Reminders' },
  { to: '/closeout', label: 'Shift closeout' },
]

const CARD_STYLES = {
  dailySales: 'glass-stat-emerald',
  outstandingDebt: 'glass-stat-rose',
  totalProducts: 'glass-stat-slate',
  lowStockAlerts: 'glass-stat-amber',
  totalStockValue: 'glass-panel border-sky-200 bg-sky-50',
  totalPaymentsReceived: 'glass-stat-emerald',
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
  outstandingDebt: '/credit',
  totalProducts: '/products',
  lowStockAlerts: '/products?stock=low',
  totalStockValue: '/products',
  totalPaymentsReceived: '/reports',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-panel-strong px-3 py-2 text-sm">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="font-semibold text-emerald-700">{formatNaira(payload[0].value)}</p>
    </div>
  )
}

function StatCard({ to, label, value, className = '' }) {
  return (
    <Link
      to={to}
      className={`block rounded-xl px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
    </Link>
  )
}

function StatCardSkeleton() {
  return (
    <div className="glass-panel animate-pulse px-4 py-3">
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-7 w-24 rounded bg-slate-200" />
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingReminders, setPendingReminders] = useState([])

  useEffect(() => {
    setLoading(true)
    api
      .get('/reports/dashboard')
      .then((res) => setStats(res.data))
      .catch((err) => {
        setStats(null)
        toast.error(err.response?.data?.message || 'Could not load dashboard')
      })
      .finally(() => setLoading(false))

    api
      .get('/reminders?status=pending')
      .then((res) => setPendingReminders(res.data.items || []))
      .catch(() => {})
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
          <div className="glass-banner-dark overflow-hidden p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-lg bg-white p-2 shadow-sm">
                  <StoreLogo className="h-auto w-full max-w-[280px] object-contain" />
                </div>
                <p className="text-base font-bold leading-tight tracking-wide text-white sm:text-lg">
                  {STORE_NAME}
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
                        : 'rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600'
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
            <div className="glass-panel flex min-h-0 flex-1 animate-pulse flex-col p-4">
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
                  className={CARD_STYLES[key] || 'glass-stat-slate'}
                />
              ))}
            </div>

            {/* Business Reminders Quick Strip */}
            {pendingReminders.length > 0 && (
              <div className="glass-panel shrink-0 border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>📌</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Active Business Reminders ({pendingReminders.length})
                    </span>
                  </div>
                  <Link to="/reminders" className="text-xs font-bold text-emerald-800 hover:underline">
                    View all / Add +
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pendingReminders.slice(0, 4).map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.patch(`/reminders/${r._id}/toggle`)
                            setPendingReminders((prev) => prev.filter((it) => it._id !== r._id))
                            toast.success('Task marked completed!')
                          } catch {
                            toast.error('Failed to update task')
                          }
                        }}
                        className="h-4 w-4 rounded border border-slate-400 hover:border-emerald-600 flex items-center justify-center text-[10px] text-emerald-700"
                        title="Mark complete"
                      />
                      <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={r.title}>
                        {r.title}
                      </span>
                      {r.priority === 'urgent' && (
                        <span className="rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-800">
                          🔥 Urgent
                        </span>
                      )}
                    </div>
                  ))}
                  {pendingReminders.length > 4 && (
                    <Link
                      to="/reminders"
                      className="flex items-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      +{pendingReminders.length - 4} more
                    </Link>
                  )}
                </div>
              </div>
            )}

            <section className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
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
                  <div className="glass-inset flex h-full flex-col items-center justify-center border-dashed text-center">
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
