/**
 * Optional, opt-in DNS-over-HTTPS lookups. The ONLY outbound network code in the app.
 * Sends the sender's domain name (and "_dmarc." + that domain) to one fixed host. Never message content.
 */
import type { Finding } from './types'
import { mk } from './checks/util'

export const DOH_HOST = 'cloudflare-dns.com'
export const DOH_ENDPOINT = `https://${DOH_HOST}/dns-query`

export interface DnsSummary {
  domain: string
  exists: boolean | null
  spf: string | null
  dmarc: string | null
  errors: string[]
}

/** Strict hostname check so nothing but a plain domain name can ever be placed in the request. */
export function isQueryableDomain(d: string): boolean {
  if (d.length < 3 || d.length > 253) return false
  if (/^[\d.]+$/.test(d)) return false
  const labels = d.split('.')
  return labels.length >= 2 && labels.every((l) => /^(?:xn--)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(l))
}

interface DohAnswer { Status?: number; Answer?: { type: number; data: string }[] }

async function query(name: string, type: 'TXT' | 'A', f: typeof fetch, signal: AbortSignal): Promise<DohAnswer> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`
  const res = await f(url, {
    headers: { accept: 'application/dns-json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    signal,
  })
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`)
  return (await res.json()) as DohAnswer
}

const txt = (a: DohAnswer): string[] => (a.Answer ?? []).filter((x) => x.type === 16).map((x) => x.data.replace(/^"|"$/g, '').replace(/"\s*"/g, ''))

export async function lookupSenderDomain(domain: string, f: typeof fetch = globalThis.fetch.bind(globalThis), timeoutMs = 5000): Promise<DnsSummary> {
  const d = domain.trim().toLowerCase()
  const summary: DnsSummary = { domain: d, exists: null, spf: null, dmarc: null, errors: [] }
  if (!isQueryableDomain(d)) { summary.errors.push('Sender domain is not a plain hostname; skipped.'); return summary }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const [txtRes, dmarcRes, aRes] = await Promise.allSettled([query(d, 'TXT', f, ctl.signal), query('_dmarc.' + d, 'TXT', f, ctl.signal), query(d, 'A', f, ctl.signal)])
    if (txtRes.status === 'fulfilled') {
      summary.spf = txt(txtRes.value).find((t) => /^v=spf1\b/i.test(t)) ?? null
      if (txtRes.value.Status === 3) summary.exists = false
      else if (txtRes.value.Status === 0) summary.exists = true
    } else summary.errors.push('TXT lookup failed')
    if (dmarcRes.status === 'fulfilled') summary.dmarc = txt(dmarcRes.value).find((t) => /^v=DMARC1\b/i.test(t)) ?? null
    else summary.errors.push('DMARC lookup failed')
    if (aRes.status === 'fulfilled' && summary.exists === null) summary.exists = aRes.value.Status === 3 ? false : aRes.value.Status === 0
  } finally {
    clearTimeout(timer)
  }
  return summary
}

export function dnsFindings(s: DnsSummary): Finding[] {
  const out: Finding[] = []
  if (s.errors.length >= 2 && s.exists === null) return out
  if (s.exists === false) {
    out.push(mk({ check: 'DNS', code: 'DNS.nxdomain', severity: 'medium', title: 'Sender domain does not exist in DNS', evidence: s.domain,
      why: 'A real sender\'s domain resolves. A non-existent domain means the From address is forged or the domain has been taken down.', action: 'Do not reply.' }))
    return out
  }
  if (s.exists && !s.spf && s.errors.length === 0) {
    out.push(mk({ check: 'DNS', code: 'DNS.no_spf', severity: 'low', title: 'Sender domain publishes no SPF record', evidence: s.domain,
      why: 'Without SPF anyone can send mail claiming to be this domain.', action: 'Weigh with other findings.' }))
  }
  if (s.exists && !s.dmarc && s.errors.length === 0) {
    out.push(mk({ check: 'DNS', code: 'DNS.no_dmarc', severity: 'low', title: 'Sender domain publishes no DMARC record', evidence: s.domain,
      why: 'Without DMARC, receivers have no policy for spoofed mail from this domain.', action: 'Weigh with other findings.' }))
  }
  return out
}
