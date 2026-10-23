import type { BadgeTone } from './primitives'
import type { Severity } from '../types'

export const SEVERITY_TONE: Record<Severity, BadgeTone> = { high: 'danger', medium: 'orange', low: 'warning', info: 'muted', good: 'success' }
export const SEVERITY_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low', info: 'Info', good: 'Good sign' }

export const TONE_HEX: Record<string, string> = { success: '#4ade80', warning: '#facc15', orange: '#fb923c', danger: '#f87171' }

export function resultTone(result: string): BadgeTone {
  if (result === 'pass') return 'success'
  if (['fail', 'permerror'].includes(result)) return 'danger'
  if (['softfail', 'temperror', 'neutral'].includes(result)) return 'warning'
  return 'muted'
}
