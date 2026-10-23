import type { Header } from './parse'
import { getAll } from './parse/headers'

export type AuthMethod = 'spf' | 'dkim' | 'dmarc' | 'arc' | 'other'
export interface AuthResult {
  method: string
  result: string
  props: Record<string, string>
  authserv: string
  source: 'Authentication-Results' | 'Received-SPF'
}

function stripComments(s: string): string {
  let depth = 0
  let out = ''
  for (const c of s) {
    if (c === '(') depth++
    else if (c === ')') { if (depth > 0) depth-- }
    else if (depth === 0) out += c
  }
  return out
}

export function parseAuthResults(headers: Header[]): AuthResult[] {
  const results: AuthResult[] = []
  for (const h of getAll(headers, 'authentication-results')) {
    const segs = stripComments(h.raw).split(';').map((s) => s.trim()).filter(Boolean)
    const authserv = (segs.shift() ?? '').split(/\s+/)[0] ?? ''
    for (const seg of segs) {
      const toks = seg.split(/\s+/)
      const first = toks[0] ?? ''
      const eq = first.indexOf('=')
      if (eq <= 0) continue
      const method = first.slice(0, eq).toLowerCase()
      const result = first.slice(eq + 1).toLowerCase()
      if (!/^[a-z0-9-]+$/.test(method) || !/^[a-z0-9-]*$/.test(result)) continue
      const props: Record<string, string> = {}
      for (const t of toks.slice(1)) {
        const e = t.indexOf('=')
        if (e > 0) props[t.slice(0, e).toLowerCase()] = t.slice(e + 1).replace(/^"|"$/g, '').toLowerCase()
      }
      results.push({ method, result, props, authserv, source: 'Authentication-Results' })
    }
  }
  // Fallback: Received-SPF
  if (!results.some((r) => r.method === 'spf')) {
    const rs = getAll(headers, 'received-spf')[0]
    if (rs) {
      const word = stripComments(rs.raw).trim().split(/\s+/)[0]?.toLowerCase() ?? ''
      if (/^(pass|fail|softfail|neutral|none|temperror|permerror)$/.test(word)) {
        const mf = /envelope-from=([^\s;]+)/i.exec(rs.raw)
        results.push({ method: 'spf', result: word, props: mf ? { 'smtp.mailfrom': mf[1].toLowerCase() } : {}, authserv: '', source: 'Received-SPF' })
      }
    }
  }
  return results
}

export function resultFor(results: AuthResult[], method: string): AuthResult | undefined {
  // Prefer the first (topmost = most recent, trusted server) result.
  return results.find((r) => r.method === method)
}
