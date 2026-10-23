import type { Header } from './parse'
import { getAll } from './parse/headers'

export interface Hop {
  /** 1 = first server that handled the message (oldest). */
  index: number
  from: string
  by: string
  ips: string[]
  protocol: string
  timestamp: number | null
  dateText: string
  /** Seconds since the previous hop; null if either timestamp is unknown. */
  delaySec: number | null
  raw: string
}

function stripParens(s: string): string {
  let depth = 0
  let out = ''
  for (const c of s) {
    if (c === '(') depth++
    else if (c === ')') { if (depth > 0) depth-- }
    else if (depth === 0) out += c
  }
  return out
}

export function parseDate(s: string): number | null {
  const cleaned = stripParens(s).replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned.length > 100) return null
  const t = Date.parse(cleaned)
  return Number.isFinite(t) ? t : null
}

/** Parse Received headers and return hops oldest -> newest, each with the delay from the previous. */
export function parseReceivedChain(headers: Header[]): Hop[] {
  const recv = getAll(headers, 'received').slice(0, 60).reverse()
  const hops: Hop[] = recv.map((h, i) => {
    const semi = h.raw.lastIndexOf(';')
    const dateText = semi >= 0 ? h.raw.slice(semi + 1).trim() : ''
    const main = semi >= 0 ? h.raw.slice(0, semi) : h.raw
    const from = /(?:^|\s)from\s+(\S+)/i.exec(main)?.[1] ?? ''
    const by = /(?:^|\s)by\s+(\S+)/i.exec(main)?.[1] ?? ''
    const protocol = /\bwith\s+(\S+)/i.exec(main)?.[1] ?? ''
    const ips: string[] = []
    for (const m of main.matchAll(/\[(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{3,39})\]/gi)) {
      if (!ips.includes(m[1])) ips.push(m[1])
    }
    return { index: i + 1, from, by, ips, protocol, timestamp: parseDate(dateText), dateText, delaySec: null, raw: h.raw.slice(0, 500) }
  })
  for (let i = 1; i < hops.length; i++) {
    const a = hops[i - 1].timestamp
    const b = hops[i].timestamp
    hops[i].delaySec = a !== null && b !== null ? Math.round((b - a) / 1000) : null
  }
  return hops
}

export function formatDelay(sec: number | null): string {
  if (sec === null) return 'unknown'
  const sign = sec < 0 ? '-' : ''
  let s = Math.abs(sec)
  if (s < 1) return '0s'
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  return sign + [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ')
}
