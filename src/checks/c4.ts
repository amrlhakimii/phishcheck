import type { Context } from '../context'
import type { Finding } from '../types'
import { SUSPICIOUS_TLDS, findLookalike, hasPunycode, hostToUnicode, orgDomain, subdomainDepth, tldOf, isOfficialAnyBrand, type LookalikeKind } from '../domain'
import { mk } from './util'

const KIND_CODE: Record<LookalikeKind, string> = {
  homoglyph: 'C4.homoglyph', 'idn-homoglyph': 'C4.idn_homoglyph', typosquat: 'C4.typosquat',
  'brand-in-domain': 'C4.brand_in_domain', 'brand-on-other-domain': 'C4.brand_other_domain',
}

export interface DomainSource { host: string; where: string }

/** Analyse one host for C4 signals. Exported for unit tests. */
export function checkDomain(host: string, where: string): Finding[] {
  const out: Finding[] = []
  const h = host.toLowerCase()
  if (!h || /^[\d.]+$/.test(h) || isOfficialAnyBrand(h)) return out
  const la = findLookalike(h)
  if (la) {
    const code = KIND_CODE[la.kind]
    out.push(mk({
      check: 'C4', code, severity: 'high', suffix: h,
      title: la.kind === 'homoglyph' || la.kind === 'idn-homoglyph' ? `Look-alike domain imitating ${la.brand.name}` : la.kind === 'typosquat' ? `Misspelled domain imitating ${la.brand.name}` : `Domain uses the ${la.brand.name} name but is not theirs`,
      evidence: `${h} (${where}): ${la.detail}`,
      why: 'Attackers register domains that look like a real brand at a glance (swapped letters, 0 for o, rn for m, accented or Cyrillic characters).',
      action: 'Do not trust this domain. Type the brand\'s real address yourself or use its official app.',
    }))
  }
  if (hasPunycode(h)) {
    out.push(mk({ check: 'C4', code: 'C4.punycode', severity: 'medium', suffix: h, title: 'Punycode (xn--) domain',
      evidence: `${h} (${where}) displays as ${hostToUnicode(h)}`,
      why: 'Punycode is how non-ASCII domain names are stored. It is legitimate for many languages but is also how look-alike (IDN homograph) domains are built.',
      action: 'Treat with suspicion unless you expect a non-English domain from this sender.' }))
  }
  const tld = tldOf(h)
  if (SUSPICIOUS_TLDS.has(tld)) {
    out.push(mk({ check: 'C4', code: 'C4.suspicious_tld', severity: 'low', suffix: h, title: `Unusual top-level domain .${tld}`,
      evidence: `${h} (${where})`,
      why: 'Some TLDs are cheap or free and are heavily abused. This alone proves nothing but raises the odds.',
      action: 'Check whether this is a domain you recognise.' }))
  }
  if (subdomainDepth(h) >= 4) {
    out.push(mk({ check: 'C4', code: 'C4.many_subdomains', severity: 'low', suffix: h, title: 'Excessive subdomains',
      evidence: `${h} (${where}) - real domain is ${orgDomain(h)}`,
      why: 'Long chains of subdomains can hide the real registered domain at the right-hand end, where people do not look.',
      action: 'Read the domain from right to left to find who actually owns it.' }))
  }
  return out
}

/** C4: lookalike / punycode / TLD / subdomain checks on the sender and every link host. */
export function c4(ctx: Context): Finding[] {
  const out: Finding[] = []
  const seen = new Set<string>()
  const sources: DomainSource[] = []
  if (ctx.from?.domain) sources.push({ host: ctx.from.domain, where: 'From' })
  if (ctx.replyTo?.domain) sources.push({ host: ctx.replyTo.domain, where: 'Reply-To' })
  if (ctx.returnPath?.domain) sources.push({ host: ctx.returnPath.domain, where: 'Return-Path' })
  for (const l of ctx.links) if (l.hostKind === 'domain' && l.host) sources.push({ host: l.host, where: 'link' })
  for (const s of sources) {
    if (seen.has(s.host)) continue
    seen.add(s.host)
    out.push(...checkDomain(s.host, s.where))
  }
  return out
}
