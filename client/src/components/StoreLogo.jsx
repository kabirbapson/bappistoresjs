import { STORE_NAME } from '../constants'

export default function StoreLogo({ className = 'h-12 w-auto object-contain' }) {
  return (
    <img
      src="/logo.png"
      alt={STORE_NAME}
      className={className}
      width={120}
      height={120}
    />
  )
}
