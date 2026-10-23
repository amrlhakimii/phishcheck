import type { Context } from '../context'
import type { Finding } from '../types'
import { BRANDS, findLookalike, normalizeHost, sameOrg, foldUnicode } from '../domain'
import { mk } from './util'

/** C3: display name spoofing. */
export function c3(ctx: Context): Finding[] {
  const out: Finding[] = []
  const f = ctx.from
  if (!f || !f.display) return out
  const name = f.display
  const em = /[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})+)/.exec(name)
  if (em) {
    const dom = em[1].toLowerCase()
    if (!f.domain || !sameOrg(dom, f.domain)) {
      out.push(mk({ check: 'C3', code: 'C3.address_in_name', severity: 'high', title: 'Display name contains a different email address',
        evidence: `Display name "${name}" vs real address ${f.address}`,
        why: 'Many mail apps show only the display name. Putting a trusted-looking address inside it makes the message look like it came from there.',
        action: 'Look at the real address behind the name, not the name itself.' }))
    }
  }
  const lowName = foldUnicode(name).replace(/[^a-z0-9]+/g, '')
  const lowNameSpaced = foldUnicode(name).replace(/[^a-z0-9]+/g, ' ')
  for (const b of BRANDS) {
    const nameKey = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const phrase = ` ${b.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
    const paddedName = ` ${lowNameSpaced.trim()} `
    const hit =
      (nameKey.length >= 6 && lowName.includes(nameKey)) ||
      paddedName.includes(phrase) ||
      [b.label, ...b.aliases].some((l) => l.length >= 4 && paddedName.includes(` ${l} `))
    if (!hit) continue
    const dom = normalizeHost(f.domain)
    const official = b.domains.some((d) => dom === d || dom.endsWith('.' + d))
    if (!official) {
      const la = findLookalike(dom)
      out.push(mk({ check: 'C3', code: 'C3.brand_in_name', severity: 'high', title: `Display name mentions ${b.name} but the address is not theirs`,
        evidence: `Display name "${name}" sent from ${f.domain || f.address}${la ? ` (${la.detail})` : ''}`,
        why: 'A brand name in the display name is free to type. Genuine mail from the brand comes from its own domains.',
        action: 'Ignore the name; judge by the actual sending domain and authentication results.', suffix: b.label }))
      break
    }
  }
  return out
}
