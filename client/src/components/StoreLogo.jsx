import { useShopSettingsStore, displayShopName } from '../shopSettingsStore'

export default function StoreLogo({ settings: settingsOverride, className = 'h-12 w-auto max-w-full object-contain' }) {
  const stored = useShopSettingsStore((s) => s.settings)
  const settings = settingsOverride || stored
  const logoUrl = settings?.logoUrl || '/logo.png'
  const alt = displayShopName(settings)

  return (
    <img
      src={logoUrl}
      alt={alt}
      className={className}
      decoding="async"
    />
  )
}
