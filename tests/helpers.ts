import { parseEmail } from '../src/parse'
import { buildContext } from '../src/context'
import { runAllChecks } from '../src/checks'

export const NOW = Date.parse('2026-10-24T12:00:00Z')

export function mail(headers: Record<string, string> | string[], body = ''): string {
  const lines = Array.isArray(headers) ? headers : Object.entries(headers).map(([k, v]) => `${k}: ${v}`)
  return lines.join('\n') + '\n\n' + body
}

export const BASE_HEADERS = {
  From: 'Alice <alice@example.com>',
  To: 'bob@example.net',
  Subject: 'Hello',
  Date: 'Sat, 24 Oct 2026 10:00:00 +0000',
  'Message-ID': '<1@example.com>',
}

export function ctxOf(raw: string) {
  const p = parseEmail(raw)
  if (!p.ok) throw new Error('parse failed: ' + p.message)
  return buildContext(p.email, NOW)
}

export function findingsOf(raw: string) {
  return runAllChecks(ctxOf(raw))
}

export function codes(raw: string): string[] {
  return findingsOf(raw).map((f) => f.code)
}
