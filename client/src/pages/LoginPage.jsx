import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import StoreBranding from '../components/StoreBranding'
import { useAuthStore } from '../store'

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const token = useAuthStore((s) => s.token)
  const loading = useAuthStore((s) => s.loading)
  const [form, setForm] = useState({ email: 'admin@bappi.com', password: 'admin123' })

  if (token) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    try {
      await login(form)
      toast.success('Welcome back')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg"
      >
        <StoreBranding
          showLogo
          logoClassName="mx-auto h-20 w-auto max-w-[200px] object-contain"
          nameClassName="mt-3 text-lg font-semibold tracking-wide text-slate-900"
        />
        <p className="text-center text-sm text-slate-500">Admin login</p>
        <p className="text-center text-xs text-amber-800">
          After an update, sign in again even if the app looked logged in before.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Email</span>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-200 p-2.5"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Password</span>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-200 p-2.5"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 p-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
