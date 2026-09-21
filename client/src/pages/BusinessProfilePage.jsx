import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import PageHeader from '../components/PageHeader'
import PageShell from '../components/PageShell'
import StoreBranding from '../components/StoreBranding'
import { useBusinessProfileStore } from '../store'

function toLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function fromLines(value) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean)
}

export default function BusinessProfilePage() {
  const profile = useBusinessProfileStore((s) => s.profile)
  const saveProfile = useBusinessProfileStore((s) => s.save)
  const setLogoUrl = useBusinessProfileStore((s) => s.setLogoUrl)
  const [form, setForm] = useState(profile)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({ ...profile, addressesText: toLines(profile.addresses), phonesText: toLines(profile.phones) })
  }, [profile])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast.error('Use a PNG or JPG logo')
    setUploading(true)
    try {
      const body = new FormData()
      body.append('logo', file)
      const { data } = await api.post('/business-profile/logo', body)
      update('logoUrl', data.logoUrl)
      setLogoUrl(data.logoUrl)
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Logo upload failed')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await saveProfile({
        ...form,
        addresses: fromLines(form.addressesText),
        phones: fromLines(form.phonesText),
      })
      toast.success('Business profile saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save business profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell header={<PageHeader title="Business Profile" subtitle="Your saved details appear across the app, invoices, vouchers, and Z-reports." />}>
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="glass-panel space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name"><input required value={form.businessName || ''} onChange={(e) => update('businessName', e.target.value)} className="glass-input w-full p-2.5" /></Field>
            <Field label="Tagline"><input value={form.tagline || ''} onChange={(e) => update('tagline', e.target.value)} className="glass-input w-full p-2.5" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Receipt title"><input value={form.receiptTitle || ''} onChange={(e) => update('receiptTitle', e.target.value)} className="glass-input w-full p-2.5" /></Field>
            <Field label="Receipt footer"><input value={form.receiptFooter || ''} onChange={(e) => update('receiptFooter', e.target.value)} className="glass-input w-full p-2.5" /></Field>
          </div>
          <Field label="Addresses (one per line)"><textarea rows="3" value={form.addressesText || ''} onChange={(e) => update('addressesText', e.target.value)} className="glass-input w-full p-2.5" placeholder="Shop No. 1, Main Street" /></Field>
          <Field label="Phone / WhatsApp numbers (one per line)"><textarea rows="3" value={form.phonesText || ''} onChange={(e) => update('phonesText', e.target.value)} className="glass-input w-full p-2.5" placeholder="08000000000" /></Field>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex cursor-pointer gap-3 text-sm text-slate-700"><input type="checkbox" checked={Boolean(form.logoIncludesReceiptHeader)} onChange={(e) => update('logoIncludesReceiptHeader', e.target.checked)} /><span><b>Logo already contains business details</b><br /><span className="text-xs text-slate-500">Turn this off if your uploaded logo is only an icon or wordmark; the app will then print your name, contacts, and tagline below it.</span></span></label>
          </div>
          <div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save business profile'}</button></div>
        </section>
        <aside className="space-y-4">
          <section className="glass-panel p-5"><p className="mb-3 text-sm font-bold text-slate-800">Logo</p><img src={form.logoUrl || profile.logoUrl} alt="Business logo preview" className="max-h-48 w-full object-contain" /><label className="mt-4 block cursor-pointer rounded-lg border border-dashed border-emerald-400 bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-800 hover:bg-emerald-100"><input type="file" accept="image/png,image/jpeg" onChange={uploadLogo} className="sr-only" />{uploading ? 'Uploading…' : 'Upload PNG or JPG logo'}</label></section>
          <section className="glass-panel p-5"><p className="mb-3 text-sm font-bold text-slate-800">Receipt preview</p><div className="thermal-receipt-preview"><div className="thermal-receipt p-2"><StoreBranding showLogo receipt showTagline logoClassName="receipt-logo mx-auto mb-2" /></div></div></section>
        </aside>
      </form>
    </PageShell>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-1 block">{label}</span>{children}</label>
}
