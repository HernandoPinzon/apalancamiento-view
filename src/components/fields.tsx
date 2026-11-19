import { useState } from 'react'
import { parseNumberList, parseOptionalNumber } from '@/lib/risk'
import { cn } from '@/lib/utils'

export const fieldClass =
  'min-h-9 w-full border border-radar-border bg-radar-bg px-2 font-mono text-xs text-radar-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-radar-cyan'

const formatValue = (value: number | null) => (value == null ? '' : String(value))

export function NumberInput({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: number | null
  onChange: (value: number | null) => void
  ariaLabel: string
  className?: string
}) {
  const [text, setText] = useState(() => formatValue(value))
  const [focused, setFocused] = useState(false)
  const [syncedValue, setSyncedValue] = useState(value)

  // Ajuste durante el render (patrón recomendado) en lugar de un efecto.
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (!focused) setText(formatValue(value))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      className={cn(fieldClass, 'text-right tabular-nums', className)}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        setText(event.target.value)
        const parsed = parseOptionalNumber(event.target.value)
        if (parsed != null || event.target.value.trim() === '') onChange(parsed)
      }}
      onBlur={() => {
        setFocused(false)
        onChange(parseOptionalNumber(text))
      }}
    />
  )
}

export function TextInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={fieldClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function ListInput({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number[]
  onCommit: (value: number[]) => void
  ariaLabel: string
}) {
  const joined = value.join(', ')
  const [text, setText] = useState(joined)
  const [focused, setFocused] = useState(false)
  const [synced, setSynced] = useState(joined)

  if (joined !== synced) {
    setSynced(joined)
    if (!focused) setText(joined)
  }

  return (
    <input
      type="text"
      aria-label={ariaLabel}
      className={fieldClass}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        setFocused(false)
        onCommit(parseNumberList(text, value))
      }}
    />
  )
}
