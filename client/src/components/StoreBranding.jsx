import { useBusinessProfileStore } from '../store'
import StoreLogo from './StoreLogo'

/** Store name with addresses in small italics — use under logo across the app. */
export default function StoreBranding({
  showLogo = false,
  logoClassName = 'mx-auto h-auto w-full max-w-[240px] object-contain',
  nameClassName = 'font-bold tracking-wide text-slate-900',
  showPhones = true,
  compact = false,
  dark = false,
  receipt = false,
  align = 'center',
  showTagline = false,
}) {
  const profile = useBusinessProfileStore((s) => s.profile)
  const alignClass = align === 'left' ? 'text-left' : 'text-center'
  const logoIncludesFullHeader = showLogo && profile.logoIncludesReceiptHeader
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

  return (
    <div className={alignClass}>
      {showLogo && <StoreLogo className={logoClassName} />}
      {!logoIncludesFullHeader && <p className={nameClassName}>{profile.businessName}</p>}
      {!logoIncludesFullHeader && showTagline && profile.tagline && (
        <p className="mt-1 text-xs italic text-slate-500">{profile.tagline}</p>
      )}
      {!logoIncludesFullHeader && !compact && (
        <div className={`mt-1.5 space-y-0.5 ${addressClass} ${receipt ? 'receipt-addresses' : ''}`}>
          {profile.addresses.map((line) => (
            <p key={line} className={receipt ? 'receipt-address-line' : undefined}>
              {line}
            </p>
          ))}
        </div>
      )}
      {!logoIncludesFullHeader && showPhones && !compact && (
        <p className={`mt-2 ${phoneClass}`}>{profile.phones.join(' · ')}</p>
      )}
      {receipt && !compact && (
        <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-black">
          {profile.receiptTitle}
        </p>
      )}
    </div>
  )
}
