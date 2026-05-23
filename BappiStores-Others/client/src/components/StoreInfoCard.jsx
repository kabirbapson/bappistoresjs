import StoreBranding from './StoreBranding'

export default function StoreInfoCard({ compact = false }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white text-center shadow-sm ${
        compact ? 'p-4' : 'p-6 sm:p-8'
      }`}
    >
      <StoreBranding
        showLogo
        logoClassName={
          compact
            ? 'mx-auto h-16 max-w-[160px] object-contain'
            : 'mx-auto h-24 max-w-[220px] object-contain sm:h-28'
        }
        nameClassName={
          compact
            ? 'mt-4 text-base font-bold tracking-wide text-slate-900'
            : 'mt-4 text-xl font-bold tracking-wide text-slate-900 sm:text-2xl'
        }
      />
    </section>
  )
}
