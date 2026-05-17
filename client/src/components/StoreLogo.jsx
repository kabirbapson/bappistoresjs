import { STORE_LOGO_SRC, STORE_NAME } from '../constants'

export default function StoreLogo({ className = 'h-12 w-auto max-w-full object-contain' }) {
  return (
    <img
      src={STORE_LOGO_SRC}
      alt={STORE_NAME}
      className={className}
      decoding="async"
    />
  )
}
