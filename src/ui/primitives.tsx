import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { GLASS } from './glass'


export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${className}`} style={GLASS}>
      {children}
    </div>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[#EEEEEE]/60 text-xs font-semibold uppercase tracking-widest ${className}`}>{children}</p>
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs text-[#EEEEEE]/50 mb-1 uppercase tracking-wider">
      {children}
    </label>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-[#00ADB5] to-[#008f96] hover:from-[#00c2cb] hover:to-[#00ADB5] text-[#222831] font-semibold shadow-[0_4px_14px_rgba(0,173,181,0.3)]',
  secondary: 'bg-[#393E46]/80 hover:bg-[#44494f] text-[#EEEEEE] border border-white/8',
  danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20',
  ghost: 'bg-transparent hover:bg-white/5 text-[#EEEEEE]/60 hover:text-[#EEEEEE]',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'secondary', className = '', type = 'button', ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 min-h-11 sm:min-h-0 text-sm rounded-xl ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

export type BadgeTone = 'accent' | 'success' | 'warning' | 'danger' | 'muted' | 'orange'
const TONES: Record<BadgeTone, string> = {
  accent: 'bg-[#00ADB5]/20 text-[#00ADB5]',
  success: 'bg-green-500/20 text-green-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  orange: 'bg-orange-500/20 text-orange-400',
  danger: 'bg-red-500/20 text-red-400',
  muted: 'bg-[#EEEEEE]/10 text-[#EEEEEE]/50',
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Result sections" className="flex gap-1 bg-[#222831] rounded-xl p-1 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          onClick={() => onChange(t.id)}
          className={`shrink-0 flex-1 px-3 py-2 min-h-11 sm:min-h-0 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            active === t.id ? 'bg-[#00ADB5] text-[#222831]' : 'text-[#EEEEEE]/50 hover:text-[#EEEEEE]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center select-none">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl mb-4" style={{ background: 'rgba(0,173,181,0.08)', border: '1px solid rgba(0,173,181,0.12)' }} aria-hidden="true">
        {icon}
      </div>
      <p className="text-[#EEEEEE]/70 font-semibold text-base mb-1">{title}</p>
      {children && <div className="text-[#EEEEEE]/30 text-sm max-w-xs">{children}</div>}
    </div>
  )
}

/** Accordion built on a button so it matches the design system and is keyboard accessible. */
export function Disclosure({ title, children, defaultOpen = false, id }: { title: string; children: ReactNode; defaultOpen?: boolean; id: string }) {
  return (
    <details className="group" open={defaultOpen} id={id}>
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none min-h-11 sm:min-h-0 [&::-webkit-details-marker]:hidden">
        <Eyebrow>{title}</Eyebrow>
        <span className="text-[#00ADB5] text-lg transition-transform group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  )
}
