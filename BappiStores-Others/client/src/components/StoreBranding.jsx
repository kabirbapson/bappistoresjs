import { useShopSettingsStore } from '../shopSettingsStore'
import StoreLogo from './StoreLogo'

/** Shop branding from settings — logo, name, addresses, phones. */
export default function StoreBranding({
  settings: settingsOverride,
  showLogo = false,
  logoClassName = 'mx-auto h-auto w-full max-w-[240px] object-contain',
  nameClassName = 'font-bold tracking-wide text-slate-900',
  showPhones = true,
  compact = false,
  dark = false,
  receipt = false,
  align = 'center',
}) {
  const stored = useShopSettingsStore((s) => s.settings)
  const settings = settingsOverride || stored
  const configuredName = settings?.shopName?.trim()
  const addresses = settings?.addresses || []
  const phones = settings?.phones || []
  const receiptTitle = settings?.receiptTitle || 'SALES INVOICE'
  const logoIncludesReceiptHeader = Boolean(settings?.logoIncludesReceiptHeader)

  const alignClass = align === 'left' ? 'text-left' : 'text-center'
  const compositeReceiptHeader = receipt && logoIncludesReceiptHeader && showLogo
  const addressClass = receipt
    ? 'text-[10px] italic leading-tight text-black'
    : dark
      ? 'text-[10px] italic leading-snug text-slate-400'
      : 'text-xs italic leading-snug text-slate-500'
  const phoneClass = receipt
    ? 'text-[10px] text-black'
    : dark
      ? 'text-xs text-slate-300'
      : 'text-sm font-medium text-slate-700'

  const showTextBlock = !compositeReceiptHeader

  return (
    <div className={alignClass}>
      {showLogo && <StoreLogo settings={settings} className={logoClassName} />}
      {showTextBlock && configuredName && (
        <p className={nameClassName}>{configuredName}</p>
      )}
      {showTextBlock && !compact && addresses.length > 0 && (
        <div className={`mt-1.5 space-y-0.5 ${addressClass} ${receipt ? 'receipt-addresses' : ''}`}>
          {addresses.map((line) => (
            <p key={line} className={receipt ? 'receipt-address-line' : undefined}>
              {line}
            </p>
          ))}
        </div>
      )}
      {showTextBlock && showPhones && !compact && phones.length > 0 && (
        <p className={`mt-2 ${phoneClass}`}>{phones.join(' · ')}</p>
      )}
      {receipt && !compact && receiptTitle && (
        <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-black">
          {receiptTitle}
        </p>
      )}
    </div>
  )
}
