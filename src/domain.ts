import brandsJson from './data/brands.json'

export interface Brand {
  name: string
  label: string
  domains: string[]
  aliases: string[]
}
export const BRANDS: Brand[] = brandsJson

/** Second-level suffixes where the registrable domain has three labels. */
const MULTI_SUFFIXES = new Set([
  'com.my', 'gov.my', 'edu.my', 'org.my', 'net.my', 'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'co.id', 'com.sg', 'co.nz', 'co.jp', 'com.br', 'co.in', 'com.cn', 'com.hk',
])

export const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'xyz', 'top', 'click', 'country', 'gq', 'tk', 'ml', 'ga', 'cf', 'work', 'loan',
  'support', 'live', 'rest', 'icu', 'cyou', 'buzz', 'monster', 'cam', 'sbs', 'bond', 'cfd', 'quest',
])

export const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly',
  'shorturl.at', 'rb.gy', 'tiny.cc', 'bl.ink', 's.id', 'lnkd.in', 'wa.me',
])

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '')
}

/** Heuristic registrable ("organisational") domain: no public-suffix list is bundled. */
export function orgDomain(host: string): string {
  const h = normalizeHost(host)
  const labels = h.split('.').filter(Boolean)
  if (labels.length <= 2) return labels.join('.')
  const last2 = labels.slice(-2).join('.')
  if (MULTI_SUFFIXES.has(last2)) return labels.slice(-3).join('.')
  return last2
}

export function tldOf(host: string): string {
  const labels = normalizeHost(host).split('.')
  return labels[labels.length - 1] ?? ''
}

export function sameOrg(a: string, b: string): boolean {
  return orgDomain(a) === orgDomain(b)
}

// ---------- Punycode (RFC 3492) ----------
const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128

function adapt(delta: number, numPoints: number, first: boolean): number {
  delta = first ? Math.floor(delta / DAMP) : delta >> 1
  delta += Math.floor(delta / numPoints)
  let k = 0
  while (delta > ((BASE - TMIN) * TMAX) >> 1) {
    delta = Math.floor(delta / (BASE - TMIN))
    k += BASE
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW))
}

/** Decode a single punycode label body (without "xn--"). Returns null when malformed. */
export function punycodeDecode(input: string): string | null {
  const output: number[] = []
  const basicEnd = input.lastIndexOf('-')
  for (let j = 0; j < Math.max(basicEnd, 0); j++) {
    const c = input.charCodeAt(j)
    if (c >= 0x80) return null
    output.push(c)
  }
  let n = INITIAL_N, i = 0, bias = INITIAL_BIAS
  let idx = basicEnd > 0 ? basicEnd + 1 : 0
  let guard = 0
  while (idx < input.length) {
    if (++guard > 5000) return null
    const oldi = i
    let w = 1
    for (let k = BASE; ; k += BASE) {
      if (idx >= input.length) return null
      const cp = input.charCodeAt(idx++)
      const digit = cp >= 48 && cp <= 57 ? cp - 22 : cp >= 65 && cp <= 90 ? cp - 65 : cp >= 97 && cp <= 122 ? cp - 97 : BASE
      if (digit >= BASE) return null
      i += digit * w
      if (i > 0x7fffffff) return null
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (digit < t) break
      w *= BASE - t
      if (w > 0x7fffffff) return null
    }
    const len = output.length + 1
    bias = adapt(i - oldi, len, oldi === 0)
    n += Math.floor(i / len)
    if (n > 0x10ffff) return null
    i %= len
    output.splice(i++, 0, n)
    if (output.length > 256) return null
  }
  try {
    return String.fromCodePoint(...output)
  } catch {
    return null
  }
}

/** Convert any xn-- labels to Unicode. Labels that fail to decode stay as-is. */
export function hostToUnicode(host: string): string {
  return normalizeHost(host)
    .split('.')
    .map((l) => (l.startsWith('xn--') ? (punycodeDecode(l.slice(4)) ?? l) : l))
    .join('.')
}

export function hasPunycode(host: string): boolean {
  return normalizeHost(host).split('.').some((l) => l.startsWith('xn--'))
}

// ---------- Homoglyphs ----------
const GLYPHS: Record<string, string> = {
  // Cyrillic
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', ѕ: 's', һ: 'h', ԁ: 'd', ԛ: 'q', ԝ: 'w', к: 'k', м: 'm', т: 't', в: 'b', н: 'h', ӏ: 'l',
  // Greek
  α: 'a', ο: 'o', ρ: 'p', ν: 'v', τ: 't', ι: 'i', κ: 'k', β: 'b', η: 'n', υ: 'u', χ: 'x', ε: 'e',
  // Latin extras
  ı: 'i', ɡ: 'g', ɑ: 'a', ǀ: 'l', ⅼ: 'l', ⅰ: 'i',
}

/** True if the string mixes ASCII letters with non-ASCII letters, or contains Cyrillic/Greek. */
export function hasConfusableScript(s: string): boolean {
  return /[Ͱ-ϿЀ-ԯ]/.test(s)
}

/** Map confusable non-ASCII characters to their Latin look-alike. */
export function foldUnicode(s: string): string {
  let out = ''
  for (const ch of s.normalize('NFKD').toLowerCase()) {
    if (/[̀-ͯ]/.test(ch)) continue
    out += GLYPHS[ch] ?? ch
  }
  return out
}

/** Collapse look-alike digit/letter substitutions: 0->o, 1->l, 3->e, 5->s, rn->m, vv->w, cl->d. */
export function normalizeLookalike(label: string): string {
  return foldUnicode(label)
    .replace(/[01358]/g, (d) => ({ '0': 'o', '1': 'l', '3': 'e', '5': 's', '8': 'b' })[d] as string)
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/cl/g, 'd')
}

/** Same as normalizeLookalike but treats 1 as i (second reading of the ambiguous glyph). */
export function normalizeLookalikeAlt(label: string): string {
  return normalizeLookalike(label.replace(/1/g, 'i'))
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  if (Math.abs(a.length - b.length) > 8) return Math.abs(a.length - b.length)
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Edit distance where swapping two adjacent characters counts as one edit (optimal string alignment). */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 8) return Math.abs(a.length - b.length)
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

// ---------- Brand matching ----------
export type LookalikeKind = 'homoglyph' | 'idn-homoglyph' | 'typosquat' | 'brand-in-domain' | 'brand-on-other-domain'

export interface LookalikeHit {
  kind: LookalikeKind
  brand: Brand
  host: string
  detail: string
}

function isOfficial(host: string, brand: Brand): boolean {
  const h = normalizeHost(host)
  return brand.domains.some((d) => h === d || h.endsWith('.' + d))
}

export function isOfficialAnyBrand(host: string): boolean {
  return BRANDS.some((b) => isOfficial(host, b))
}

function brandLabels(b: Brand): string[] {
  return [b.label, ...b.aliases]
}

/** Find the strongest brand lookalike signal for a host, or null. */
export function findLookalike(rawHost: string): LookalikeHit | null {
  const host = normalizeHost(rawHost)
  if (!host || /^[\d.]+$/.test(host) || host.length > 253) return null
  if (isOfficialAnyBrand(host)) return null
  const uni = hostToUnicode(host)
  const org = orgDomain(uni)
  const orgLabels = org.split('.')
  const mainLabel = orgLabels[0] ?? ''
  const wasIdn = hasPunycode(host)
  const tokens = mainLabel.split('-').filter(Boolean)

  // Pass 1: exact brand after confusable normalisation (strongest).
  for (const b of BRANDS) {
    for (const bl of brandLabels(b)) {
      if (bl.length < 3) continue
      const variants = new Set([foldUnicode(mainLabel), normalizeLookalike(mainLabel), normalizeLookalikeAlt(mainLabel)])
      const bln = bl
      for (const cand of [mainLabel, ...tokens]) {
        if (cand === bln) continue // exact label with a different domain handled later
        const c = [foldUnicode(cand), normalizeLookalike(cand), normalizeLookalikeAlt(cand)]
        if (c.some((v) => v === bln) || (cand === mainLabel && [...variants].some((v) => v === bln))) {
          return {
            kind: wasIdn || hasConfusableScript(mainLabel) ? 'idn-homoglyph' : 'homoglyph',
            brand: b,
            host,
            detail: `"${cand}" is a look-alike spelling of "${bl}" (${b.name})`,
          }
        }
      }
    }
  }
  // Pass 2: typosquat via edit distance (labels of 5+ chars only, to limit false positives).
  for (const b of BRANDS) {
    for (const bl of brandLabels(b)) {
      if (bl.length < 5 || mainLabel === bl) continue
      const max = bl.length >= 9 ? 2 : 1
      const d = damerauLevenshtein(foldUnicode(mainLabel), bl)
      if (d > 0 && d <= max) {
        return { kind: 'typosquat', brand: b, host, detail: `"${mainLabel}" is ${d} edit${d > 1 ? 's' : ''} away from "${bl}" (${b.name})` }
      }
    }
  }
  // Pass 3: brand name used as a hyphenated token or as a subdomain of an unrelated domain.
  for (const b of BRANDS) {
    for (const bl of brandLabels(b)) {
      if (bl.length < 4) continue
      const subLabels = uni.split('.').slice(0, -orgLabels.length)
      if (mainLabel === bl) {
        return { kind: 'brand-on-other-domain', brand: b, host, detail: `"${bl}" appears on an unofficial domain (${org})` }
      }
      if (tokens.length > 1 && tokens.includes(bl)) {
        return { kind: 'brand-in-domain', brand: b, host, detail: `"${bl}" is embedded in the domain name ${org}` }
      }
      if (subLabels.some((l) => l === bl || l.split('-').includes(bl))) {
        return { kind: 'brand-in-domain', brand: b, host, detail: `"${bl}" used as a subdomain of ${org}` }
      }
    }
  }
  return null
}

export function subdomainDepth(host: string): number {
  const h = normalizeHost(host)
  return Math.max(0, h.split('.').length - orgDomain(h).split('.').length)
}
