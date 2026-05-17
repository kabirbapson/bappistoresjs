import { useEffect, useState } from 'react'

function digitsOnly(value) {
  return String(value).replace(/\D/g, '')
}

/**
 * Naira-style numeric field: clear the field, type fresh digits, no stuck leading zeros.
 * value/onChange use number or '' while editing.
 */
export default function NumericInput({
  value,
  onChange,
  allowEmpty = true,
  className = '',
  onBlur,
  onFocus,
  ...rest
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const toDisplay = (v) => {
    if (v === '' || v == null) return ''
    const n = Number(v)
    if (!Number.isFinite(n)) return ''
    if (allowEmpty && n === 0) return ''
    return String(n)
  }

  useEffect(() => {
    if (!focused) setDraft(toDisplay(value))
  }, [value, focused, allowEmpty])

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={focused ? draft : toDisplay(value)}
      onFocus={(e) => {
        setFocused(true)
        setDraft(toDisplay(value))
        requestAnimationFrame(() => e.target.select())
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        const raw = digitsOnly(draft)
        if (raw === '') {
          onChange(allowEmpty ? '' : 0)
        } else {
          onChange(Number(raw))
        }
        onBlur?.(e)
      }}
      onChange={(e) => {
        const raw = digitsOnly(e.target.value)
        setDraft(raw)
        if (raw === '') {
          if (allowEmpty) onChange('')
        } else {
          onChange(Number(raw))
        }
      }}
    />
  )
}
