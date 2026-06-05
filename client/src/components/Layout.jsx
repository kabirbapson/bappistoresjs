import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '../constants'
import { useAuthStore } from '../store'
import StoreBranding from './StoreBranding'

export default function Layout({ children }) {
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  return (
    <div className="app-shell-bg h-dvh overflow-hidden">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-screen-2xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)] lg:px-6">
        <aside className="glass-sidebar flex min-h-0 flex-col overflow-y-auto p-4 text-white">
          <div className="border-b border-slate-600 pb-4">
            <StoreBranding
              showLogo
              dark
              showPhones={false}
              logoClassName="mx-auto h-auto w-full max-w-[240px] object-contain"
              nameClassName="mt-2 text-xs font-bold leading-tight tracking-wide text-slate-100"
            />
          </div>
          <nav className="mt-4 flex-1 space-y-1">
            {NAV_ITEMS.map(([label, path]) => (
              <Link
                key={path}
                to={path}
                className={`block rounded-lg px-3 py-2 text-xl font-bold transition-all ${
                  location.pathname === path
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-center text-xs text-slate-400">Inventory & sales</p>
          <p className="mt-1 text-center text-xs text-slate-400">
            Designed & Developed by <b className="text-sm text-sky-300">Bappi</b>
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-700"
          >
            Logout
          </button>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
