import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '../constants'
import { useAuthStore } from '../store'
import StoreBranding from './StoreBranding'

export default function Layout({ children }) {
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  return (
    <div className="h-dvh overflow-hidden bg-slate-100">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-screen-2xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)] lg:px-6">
        <aside className="flex min-h-0 flex-col overflow-y-auto rounded-xl bg-slate-900 p-4 text-white">
          <div className="border-b border-slate-700 pb-4">
            <StoreBranding
              showLogo
              dark
              showPhones={false}
              logoClassName="mx-auto h-12 w-auto max-w-[120px] object-contain"
              nameClassName="mt-2 text-xs font-bold leading-tight tracking-wide text-slate-100"
            />
          </div>
          <nav className="mt-4 flex-1 space-y-1">
            {NAV_ITEMS.map(([label, path]) => (
              <Link
                key={path}
                to={path}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  location.pathname === path
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-xs text-slate-500">Inventory & sales</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm hover:bg-rose-700"
          >
            Logout
          </button>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
