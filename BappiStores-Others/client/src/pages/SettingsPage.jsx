import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import StoreBranding from '../components/StoreBranding'
import {
  DEFAULT_SHOP_SETTINGS,
  displayShopName,
  useShopSettingsStore,
} from '../shopSettingsStore'

function lineList(values, onChange, placeholder) {
  return values.map((value, index) => (
    <div key={index} className="flex gap-2">
      <input
        className="flex-1 rounded-lg border border-slate-200 p-2.5 text-base"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const next = [...values]
          next[index] = e.target.value
          onChange(next)
        }}
      />
      <button
        type="button"
        onClick={() => onChange(values.filter((_, i) => i !== index))}
        className="shrink-0 rounded-lg border border-rose-200 px-3 text-sm text-rose-700 hover:bg-rose-50"
      >
        Remove
      </button>
    </div>
  ))
}

export default function SettingsPage() {
  const settings = useShopSettingsStore((s) => s.settings)
  const load = useShopSettingsStore((s) => s.load)
  const save = useShopSettingsStore((s) => s.save)
  const uploadLogo = useShopSettingsStore((s) => s.uploadLogo)

  const [form, setForm] = useState(DEFAULT_SHOP_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (settings) {
      setForm({
        shopName: settings.shopName || '',
        addresses: settings.addresses?.length ? [...settings.addresses] : [''],
        phones: settings.phones?.length ? [...settings.phones] : [''],
        logoUrl: settings.logoUrl || '/logo.png',
        receiptTitle: settings.receiptTitle || 'SALES INVOICE',
        receiptFooterArabic: settings.receiptFooterArabic || '',
        logoIncludesReceiptHeader: Boolean(settings.logoIncludesReceiptHeader),
      })
    }
  }, [settings])

  const previewSettings = {
    ...form,
    addresses: form.addresses.filter((l) => l.trim()),
    phones: form.phones.filter((l) => l.trim()),
    logoUrl: logoPreview || form.logoUrl,
  }

  const onLogoPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (logoFile) {
        await uploadLogo(logoFile)
      }
      await save({
        shopName: form.shopName.trim(),
        addresses: form.addresses,
        phones: form.phones,
        receiptTitle: form.receiptTitle.trim(),
        receiptFooterArabic: form.receiptFooterArabic.trim(),
        logoIncludesReceiptHeader: form.logoIncludesReceiptHeader,
      })
      setLogoFile(null)
      if (logoPreview) URL.revokeObjectURL(logoPreview)
      setLogoPreview(null)
      toast.success('Shop branding saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Shop setup"
          subtitle="Your logo, name, and contact details — shown on screen and receipts"
        />
      }
    >
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Logo</h3>
          <p className="mt-1 text-sm text-slate-600">
            Upload your shop logo (PNG or JPG). This appears in the sidebar, login screen, and
            invoices.
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex min-h-[120px] min-w-[160px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <img
                src={logoPreview || form.logoUrl}
                alt="Logo preview"
                className="max-h-24 max-w-full object-contain"
              />
            </div>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-slate-700">Choose image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={onLogoPick}
                className="block w-full text-sm"
              />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.logoIncludesReceiptHeader}
              onChange={(e) =>
                setForm({ ...form, logoIncludesReceiptHeader: e.target.checked })
              }
              className="mt-1"
            />
            <span>
              My logo image already includes shop name, address, and phone (hide those lines on
              printed receipts)
            </span>
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Shop details</h3>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Shop name *</span>
              <input
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base"
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                placeholder="e.g. Alhaji Provision Store"
                required
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Addresses</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, addresses: [...form.addresses, ''] })}
                  className="text-sm font-medium text-emerald-700 hover:underline"
                >
                  + Add line
                </button>
              </div>
              <div className="space-y-2">
                {lineList(form.addresses, (addresses) => setForm({ ...form, addresses }), 'Address line')}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Phone numbers</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, phones: [...form.phones, ''] })}
                  className="text-sm font-medium text-emerald-700 hover:underline"
                >
                  + Add phone
                </button>
              </div>
              <div className="space-y-2">
                {lineList(form.phones, (phones) => setForm({ ...form, phones }), '08012345678')}
              </div>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Receipt title</span>
              <input
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base"
                value={form.receiptTitle}
                onChange={(e) => setForm({ ...form, receiptTitle: e.target.value })}
                placeholder="SALES INVOICE"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Receipt footer (optional)</span>
              <input
                className="w-full rounded-lg border border-slate-200 p-2.5 text-base"
                value={form.receiptFooterArabic}
                onChange={(e) => setForm({ ...form, receiptFooterArabic: e.target.value })}
                placeholder="Thank you message or Arabic footer"
                dir="auto"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Preview</h3>
          <div className="mt-3 rounded-lg bg-white p-4">
            <StoreBranding settings={previewSettings} showLogo receipt />
            <p className="mt-2 text-center text-xs text-slate-500">
              {displayShopName(previewSettings)} — as on receipts
            </p>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving || !form.shopName.trim()}
          className="w-full rounded-lg bg-emerald-700 py-3 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save shop branding'}
        </button>
      </form>
    </PageShell>
  )
}
