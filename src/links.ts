import { LIMITS } from './parse/limits'
import { defangUrl } from './ioc'
import {
  URL_SHORTENERS, SUSPICIOUS_TLDS, findLookalike, hasPunycode, normalizeHost, orgDomain, sameOrg, subdomainDepth, tldOf,
} from './domain'
import { scanHtml } from './html'

export type HostKind = 'domain' | 'ip' | 'ip-decimal' | 'ip-hex' | 'ip-octal' | 'ipv6' | 'none'

export type LinkFlag =
  | 'text-mismatch' | 'ip-host' | 'ip-obfuscated' | 'shortener' | 'userinfo' | 'long-url' | 'encoded'
  | 'http' | 'data-url' | 'javascript-url' | 'punycode' | 'lookalike' | 'suspicious-tld' | 'many-subdomains'

export interface ParsedUrl {
  scheme: string
  userinfo: string
  host: string
  hostKind: HostKind
  /** Normalised dotted-quad for obfuscated IP forms. */
  ipNormalized?: string
  port: string
  rest: string
}

export interface LinkInfo {
  text: string
  href: string
  scheme: string
  host: string
  hostKind: HostKind
  ipNormalized?: string
  defanged: string
  flags: LinkFlag[]
  /** Domain claimed by the anchor text, when it looks like a URL/domain. */
  claimedHost?: string
  lookalikeDetail?: string
  source: 'html' | 'text'
}

export const FLAG_LABELS: Record<LinkFlag, string> = {
  'text-mismatch': 'Text shows a different site',
  'ip-host': 'IP address host',
  'ip-obfuscated': 'Obfuscated IP address',
  shortener: 'URL shortener',
  userinfo: 'Credentials-style "@" in URL',
  'long-url': 'Very long URL',
  encoded: 'Heavily encoded URL',
  http: 'Not HTTPS',
  'data-url': 'data: URL',
  'javascript-url': 'javascript: URL',
  punycode: 'Punycode (xn--) domain',
  lookalike: 'Look-alike of a known brand',
  'suspicious-tld': 'Suspicious TLD',
  'many-subdomains': 'Many subdomains',
}

/** inet_aton-style parse; returns null when not an IPv4 in any legacy notation. */
export function inetAton(host: string): number | null {
  const parts = host.split('.')
  if (parts.length < 1 || parts.length > 4 || parts.some((p) => p === '')) return null
  const nums: number[] = []
  for (const p of parts) {
    let v: number
    if (/^0x[0-9a-f]+$/i.test(p)) v = parseInt(p, 16)
    else if (/^0[0-7]+$/.test(p)) v = parseInt(p, 8)
    else if (/^\d+$/.test(p)) v = parseInt(p, 10)
    else return null
    if (!Number.isFinite(v)) return null
    nums.push(v)
  }
  const last = nums[nums.length - 1]
  const lead = nums.slice(0, -1)
  if (lead.some((x) => x > 255)) return null
  if (last >= 256 ** (5 - nums.length)) return null
  let total = last
  lead.forEach((x, i) => { total += x * 256 ** (3 - i) })
  return total
}

function quad(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

export function parseUrl(input: string): ParsedUrl | null {
  // Browsers strip tabs/newlines and leading/trailing control chars + spaces.
  if (input.length > 8192) return null
  const u = Array.from(input).filter((c) => c.charCodeAt(0) > 31).join('').trim().replace(/\\/g, '/')
  const m = /^([a-z][a-z0-9+.-]{0,20}):(.*)$/is.exec(u)
  if (!m) return null
  const scheme = m[1].toLowerCase()
  const after = m[2]
  if (scheme === 'data' || scheme === 'javascript' || scheme === 'mailto' || scheme === 'tel') {
    return { scheme, userinfo: '', host: '', hostKind: 'none', port: '', rest: after.slice(0, 200) }
  }
  if (!after.startsWith('//')) return { scheme, userinfo: '', host: '', hostKind: 'none', port: '', rest: after }
  const body = after.slice(2)
  let end = body.length
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '/' || c === '?' || c === '#') { end = i; break }
  }
  let authority = body.slice(0, end)
  const rest = body.slice(end)
  let userinfo = ''
  const at = authority.lastIndexOf('@')
  if (at >= 0) { userinfo = authority.slice(0, at); authority = authority.slice(at + 1) }
  let host = authority
  let port = ''
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']')
    host = close > 0 ? authority.slice(0, close + 1) : authority
    port = close > 0 ? authority.slice(close + 2) : ''
    return { scheme, userinfo, host: host.toLowerCase(), hostKind: 'ipv6', port, rest }
  }
  const colon = authority.lastIndexOf(':')
  if (colon >= 0) { host = authority.slice(0, colon); port = authority.slice(colon + 1) }
  host = normalizeHost(host)
  let hostKind: HostKind = 'domain'
  let ipNormalized: string | undefined
  if (host === '') hostKind = 'none'
  else {
    const n = inetAton(host)
    if (n !== null) {
      ipNormalized = quad(n)
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && !/(^|\.)0\d/.test(host)) hostKind = 'ip'
      else if (/^\d+$/.test(host)) hostKind = 'ip-decimal'
      else if (/0x/i.test(host)) hostKind = 'ip-hex'
      else hostKind = 'ip-octal'
    }
  }
  return { scheme, userinfo, host, hostKind, ipNormalized, port, rest }
}

/** If the anchor text itself looks like a URL or domain, return that host. Linear token scan. */
export function claimedHostFromText(text: string): string | undefined {
  for (const tok of text.trim().slice(0, 400).split(/\s+/)) {
    if (tok.length > 200 || tok.length < 4) continue
    const m = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?:[/?#].*)?$/i.exec(tok.replace(/^[("'<[]+|[)"'>\],.;!?]+$/g, ''))
    if (m && /[a-z]{2,}$/i.test(m[1])) {
      const host = m[1].toLowerCase()
      // ignore things like "e.g" or file names such as report.pdf
      if (/\.(pdf|docx?|xlsx?|png|jpe?g|gif|txt|zip|html?)$/i.test(host)) continue
      return tok.toLowerCase().includes('www.') ? 'www.' + host : host
    }
  }
  return undefined
}

export function analyseLink(href: string, text: string, source: 'html' | 'text'): LinkInfo {
  const pu = parseUrl(href)
  const flags: LinkFlag[] = []
  const info: LinkInfo = {
    text, href, scheme: pu?.scheme ?? '', host: pu?.host ?? '', hostKind: pu?.hostKind ?? 'none',
    ipNormalized: pu?.ipNormalized, defanged: defangUrl(href.slice(0, 600)), flags, source,
  }
  if (!pu) return info
  if (pu.scheme === 'javascript') flags.push('javascript-url')
  if (pu.scheme === 'data') flags.push('data-url')
  if (pu.scheme === 'http') flags.push('http')
  if (pu.userinfo) flags.push('userinfo')
  if (pu.hostKind === 'ip' || pu.hostKind === 'ipv6') flags.push('ip-host')
  if (pu.hostKind === 'ip-decimal' || pu.hostKind === 'ip-hex' || pu.hostKind === 'ip-octal') flags.push('ip-obfuscated')
  if (href.length > 200) flags.push('long-url')
  const pct = (href.match(/%[0-9a-f]{2}/gi) ?? []).length
  if (pct > 8 || /%25[0-9a-f]{2}/i.test(href)) flags.push('encoded')
  if (pu.hostKind === 'domain') {
    const h = pu.host
    if (URL_SHORTENERS.has(orgDomain(h)) || URL_SHORTENERS.has(h)) flags.push('shortener')
    if (hasPunycode(h)) flags.push('punycode')
    if (SUSPICIOUS_TLDS.has(tldOf(h))) flags.push('suspicious-tld')
    if (subdomainDepth(h) >= 4) flags.push('many-subdomains')
    const la = findLookalike(h)
    if (la) { flags.push('lookalike'); info.lookalikeDetail = la.detail }
  }
  // Text vs destination
  const claimed = claimedHostFromText(text)
  if (claimed && (pu.hostKind === 'domain' || pu.hostKind === 'ip' || pu.hostKind.startsWith('ip'))) {
    info.claimedHost = claimed
    const c = claimed.replace(/^www\./, '')
    if (pu.hostKind !== 'domain' || !sameOrg(c, pu.host)) flags.push('text-mismatch')
  } else if (claimed && pu.hostKind === 'none' && pu.scheme !== 'mailto' && pu.scheme !== 'tel') {
    info.claimedHost = claimed
    flags.push('text-mismatch')
  }
  return info
}

const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>"'`]{3,2000}/gi

export function extractLinks(plain: string, html: string): LinkInfo[] {
  const links: LinkInfo[] = []
  const seen = new Set<string>()
  const add = (l: LinkInfo) => {
    const key = l.href + '\u0000' + l.text
    if (seen.has(key) || links.length >= LIMITS.maxLinks) return
    seen.add(key)
    links.push(l)
  }
  if (html) {
    const facts = scanHtml(html)
    for (const a of facts.links) {
      const href = a.href
      if (!href || href.startsWith('#')) continue
      add(analyseLink(href, a.text, 'html'))
    }
  }
  if (plain) {
    const text = plain.length > LIMITS.maxPartBytes ? plain.slice(0, LIMITS.maxPartBytes) : plain
    for (const m of text.matchAll(URL_IN_TEXT)) {
      let u = m[0].replace(/[.,;:!?)\]}>'"]+$/, '')
      if (!u) continue
      if (/^www\./i.test(u)) u = 'http://' + u
      if (links.some((l) => l.href === u)) continue
      add(analyseLink(u, '', 'text'))
    }
  }
  return links
}
