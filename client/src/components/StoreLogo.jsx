import { useBusinessProfileStore } from '../store'

export default function StoreLogo({ className = 'h-12 w-auto max-w-full object-contain' }) {
  const profile = useBusinessProfileStore((s) => s.profile)
  return (
    <img
      src={profile.logoUrl}
      alt={profile.businessName}
      className={className}
      decoding="async"
    />
  )
}
