import type { Context } from '../context'
import type { Finding } from '../types'
import { SOCIAL_GROUPS } from '../data/keywords'
import { getFirst } from '../parse/headers'
import { mk } from './util'

/** C14: payment / gift-card / secrecy social engineering (text or HTML body, EN + BM). */
export function c14(ctx: Context): Finding[] {
  const text = `${ctx.subject}\n${ctx.bodyText}`.toLowerCase().replace(/[‘’]/g, "'").slice(0, 600_000)
  const hits = SOCIAL_GROUPS.map((g) => ({ g, phrase: g.phrases.find((p) => text.includes(p)) })).filter((h) => h.phrase)
  if (hits.length === 0) return []
  // Bulk mail with an unsubscribe header (promotions, receipts) must show a clear pattern, not a single mention.
  if (getFirst(ctx.email.headers, 'list-unsubscribe') && hits.length < 3) return []
  const n = hits.length
  const code = n >= 3 ? 'C14.social_many' : n === 2 ? 'C14.social_two' : 'C14.social_one'
  return [mk({
    check: 'C14', code, severity: n >= 3 ? 'high' : n === 2 ? 'medium' : 'low',
    title: `Payment, gift-card or secrecy request (${n} kind${n > 1 ? 's' : ''} of ask)`,
    evidence: hits.map((h) => `${h.g.label}: "${h.phrase}"`).join('; '),
    why: 'Business email compromise and gift-card scams ask for money or codes, often with "are you available?" openers and a demand for secrecy so you do not check with anyone. The more of these appear together, the more it looks like a scam.',
    action: 'Do not buy, pay or send codes. Confirm the request by phone or in person with the named person, using contact details you already have, and tell your finance or IT team.',
  })]
}
