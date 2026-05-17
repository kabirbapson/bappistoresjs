import {
  STORE_ADDRESSES,
  STORE_LOGO_INCLUDES_RECEIPT_HEADER,
  STORE_NAME,
  STORE_PHONES,
  STORE_RECEIPT_TITLE,
} from '../constants'
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
}) {
  const alignClass = align === 'left' ? 'text-left' : 'text-center'
  const compositeReceiptHeader = receipt && STORE_LOGO_INCLUDES_RECEIPT_HEADER && showLogo
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
      {!compositeReceiptHeader && <p className={nameClassName}>{STORE_NAME}</p>}
      {!compositeReceiptHeader && !compact && (
        <div className={`mt-1.5 space-y-0.5 ${addressClass} ${receipt ? 'receipt-addresses' : ''}`}>
          {STORE_ADDRESSES.map((line) => (
            <p key={line} className={receipt ? 'receipt-address-line' : undefined}>
              {line}
            </p>
          ))}
        </div>
      )}
      {!compositeReceiptHeader && showPhones && !compact && (
        <p className={`mt-2 ${phoneClass}`}>{STORE_PHONES.join(' · ')}</p>
      )}
      {receipt && !compact && (
        <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-black">
          {STORE_RECEIPT_TITLE}
        </p>
      )}
    </div>
  )
}
