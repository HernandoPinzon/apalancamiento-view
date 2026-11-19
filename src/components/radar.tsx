import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/types/risk'

export function RadarPanel({
  title,
  eyebrow,
  children,
  className,
  actions,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}) {
  return (
    <section className={cn('border border-radar-border bg-radar-panel/90', className)}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-radar-border px-4 py-3">
        <div>
          {eyebrow ? <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-radar-muted">{eyebrow}</p> : null}
          <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.08em] text-radar-text">{title}</h2>
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function TonePill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const classes: Record<Tone, string> = {
    safe: 'border-radar-safe/50 bg-radar-safe/10 text-radar-safe',
    warn: 'border-radar-warn/50 bg-radar-warn/10 text-radar-warn',
    danger: 'border-radar-danger/50 bg-radar-danger/10 text-radar-danger',
    neutral: 'border-radar-border bg-radar-panel2 text-radar-muted',
  }
  return (
    <span className={cn('inline-flex items-center gap-2 border px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em]', classes[tone])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  const color = tone === 'safe' ? 'bg-radar-safe' : tone === 'warn' ? 'bg-radar-warn' : tone === 'danger' ? 'bg-radar-danger' : 'bg-radar-muted'
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-radar-muted">
      <span className={cn('size-2 rounded-full', color)} aria-hidden="true" />
      {label}
    </span>
  )
}

export function MetricBlock({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: Tone }) {
  const color = tone === 'safe' ? 'text-radar-safe' : tone === 'warn' ? 'text-radar-warn' : tone === 'danger' ? 'text-radar-danger' : 'text-radar-cyan'
  return (
    <div className="min-w-0 border-b border-radar-border pb-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-radar-muted">{label}</p>
      <p className={cn('mt-1 break-words font-mono text-xl font-semibold tabular-nums', color)}>{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-radar-muted">{detail}</p> : null}
    </div>
  )
}

export function RadarButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-radar-cyan/60 bg-radar-cyan/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-radar-cyan transition-colors duration-150 hover:bg-radar-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radar-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-radar-bg active:bg-radar-cyan/30 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function RadarGhostButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-radar-border bg-transparent px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-radar-text transition-colors duration-150 hover:border-radar-cyan/60 hover:text-radar-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radar-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-radar-bg active:bg-radar-panel2 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface SegmentedTabItem {
  value: string
  label: string
}

export function SegmentedTabs({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: SegmentedTabItem[]
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'cursor-pointer border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radar-cyan',
              active
                ? 'border-radar-cyan/60 bg-radar-cyan/10 text-radar-cyan'
                : 'border-radar-border bg-transparent text-radar-muted hover:border-radar-cyan/40 hover:text-radar-text',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
