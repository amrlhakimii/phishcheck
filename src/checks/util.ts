import type { Finding, Severity } from '../types'
import { weight } from '../weights'
import { defangText } from '../ioc'

export interface Mk {
  check: string
  code: string
  severity: Severity
  title: string
  evidence: string
  why: string
  action: string
  suffix?: string
  points?: number
}

export function mk(m: Mk): Finding {
  return {
    id: `${m.code}${m.suffix ? ':' + m.suffix : ''}`,
    check: m.check,
    code: m.code,
    severity: m.severity,
    title: m.title,
    evidence: defangText(m.evidence, 400),
    why: m.why,
    action: m.action,
    points: m.points ?? weight(m.code),
  }
}

export const DO_NOT_ACT = 'Do not click links or reply. If you think it may be genuine, contact the sender using a phone number or website you already trust.'
