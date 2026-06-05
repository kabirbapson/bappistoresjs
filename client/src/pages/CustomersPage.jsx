import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import PasswordDeleteDialog from '../components/PasswordDeleteDialog'
import api from '../api'
import { deleteWithPassword } from '../utils/secureDelete'

const emptyCustomer = { name: '', phone: '', address: '' }

function tableRowClass(index, isEditing) {
  if (isEditing) return 'bg-emerald-100 ring-2 ring-inset ring-emerald-400'
  return index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'
}

function StatCard({ label, value, sub, className = '' }) {
  return (
    <div className={`glass-panel px-4 py-3 ${className}`}>
      <p className="text-sm font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-sm opacity-70">{sub}</p>}
    </div>
  )
}

export default function CustomersPage() {
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyCustomer)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const formRef = useRef(null)

  const load = useCallback(() => {
    api
      .get(`/customers?q=${encodeURIComponent(query)}`)
      .then((r) => setRows(r.data.items))
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load customers'))
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  const withAddress = useMemo(
    () => rows.filter((c) => (c.address || '').trim()).length,
    [rows],
  )

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/customers/${editing._id}`, form)
        toast.success('Customer updated')
        setEditing(null)
      } else {
        await api.post('/customers', form)
        toast.success('Customer added')
      }
      setForm(emptyCustomer)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer')
    }
  }

  const startEdit = (c) => {
    setEditing(c)
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(emptyCustomer)
  }

  const confirmDeleteCustomer = async (password) => {
    if (!deleteTarget) return
    try {
      await deleteWithPassword(`/customers/${deleteTarget._id}`, password)
      toast.success('Customer deleted')
      if (editing?._id === deleteTarget._id) cancelEdit()
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete customer')
      throw err
    }
  }

  return (
    <PageShell
      scroll={false}
      header={<PageHeader title="Customers" subtitle="Buyers and credit accounts — Kano area" />}
    >
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:grid-rows-1">
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            <StatCard
              label="Customers"
              value={rows.length}
              className="glass-stat-slate"
            />
            <StatCard
              label="With address"
              value={withAddress}
              sub="Area on file"
              className="glass-panel border-sky-200 bg-sky-50"
            />
          </div>

          <div className="glass-panel shrink-0 p-4">
            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Search</span>
              <input
                className="glass-input w-full p-2.5 text-base"
                placeholder="Name, phone, or area…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-sm sm:text-base">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[22%]" />
                <col className="w-[28%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="glass-table-head text-xs uppercase tracking-wide text-white sm:text-sm">
                  <th className="p-2.5 text-left font-semibold sm:p-3">Name</th>
                  <th className="px-1.5 py-2.5 text-left font-semibold sm:p-3">Phone</th>
                  <th className="px-1.5 py-2.5 text-left font-semibold sm:p-3">Address</th>
                  <th className="p-2.5 text-left font-semibold sm:p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, index) => {
                  const isEditingRow = editing?._id === c._id
                  return (
                    <tr
                      key={c._id}
                      className={`border-b border-slate-200/80 transition-colors ${tableRowClass(index, isEditingRow)}`}
                    >
                      <td className="overflow-hidden p-2.5 align-middle sm:p-3">
                        <span
                          className="block truncate font-medium text-slate-900 sm:text-base"
                          title={c.name}
                        >
                          {c.name}
                        </span>
                      </td>
                      <td className="overflow-hidden truncate px-1.5 py-2.5 align-middle tabular-nums text-slate-700 sm:py-3">
                        {c.phone}
                      </td>
                      <td className="overflow-hidden truncate px-1.5 py-2.5 align-middle text-slate-600 sm:py-3">
                        {c.address || '—'}
                      </td>
                      <td className="px-1.5 py-2 align-middle sm:px-2 sm:py-2.5">
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 sm:text-base"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 sm:text-base"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="border-t border-slate-100 px-6 py-12 text-center">
                <p className="text-base text-slate-500">
                  {query ? 'No customers match your search.' : 'No customers yet.'}
                </p>
              </div>
            )}
            </div>
          </div>

          <p className="shrink-0 text-sm text-slate-500">
            Credit balances and payments are on{' '}
            <Link to="/debts" className="font-medium text-emerald-700 hover:underline">
              Debts
            </Link>
            .
          </p>
        </section>

        <aside
          ref={formRef}
          className={`min-h-0 overflow-y-auto p-4 ${
            editing
              ? 'glass-panel border-emerald-200 bg-emerald-50 ring-2 ring-emerald-200'
              : 'glass-panel'
          }`}
        >
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editing ? 'Edit customer' : 'Add new customer'}
              </h3>
              {editing && (
                <p className="mt-0.5 text-base text-emerald-800">{editing.name}</p>
              )}
            </div>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="glass-inset shrink-0 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            )}
          </div>

          <form className="space-y-3" onSubmit={save}>
            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Full name *</span>
              <input
                placeholder="e.g. Musa Ibrahim"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Phone *</span>
              <input
                placeholder="e.g. 08031234567"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </label>

            <label className="block text-base">
              <span className="mb-1 block font-medium text-slate-700">Address / area</span>
              <input
                placeholder="e.g. Sabon Gari, Kano"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-700 py-3 text-base font-semibold text-white shadow-md hover:bg-emerald-800"
            >
              {editing ? 'Save changes' : '+ Add customer'}
            </button>
          </form>
        </aside>
      </div>
      <PasswordDeleteDialog
        open={!!deleteTarget}
        title="Delete customer"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.name}? Customers with outstanding debt cannot be deleted.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteCustomer}
      />
    </PageShell>
  )
}
