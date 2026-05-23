/**
 * Fixed viewport-height page wrapper. Use with Layout (h-dvh).
 * scroll=false for split panels that manage their own overflow.
 */
export default function PageShell({ header, scroll = true, children, className = '' }) {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-3 overflow-hidden ${className}`}>
      {header ? <div className="shrink-0">{header}</div> : null}
      <div
        className={
          scroll
            ? 'min-h-0 flex-1 overflow-y-auto'
            : 'flex min-h-0 flex-1 flex-col overflow-hidden'
        }
      >
        {children}
      </div>
    </div>
  )
}
