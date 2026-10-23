import type { Context } from '../context'
import type { Finding } from '../types'
import { URGENCY, findPhrases } from '../data/keywords'
import { mk } from './util'

/** C7: urgency and pressure wording (EN + BM). Tiered by number of distinct phrases. */
export function c7(ctx: Context): Finding[] {
  const hits = findPhrases(`${ctx.subject}\n${ctx.bodyText}`, URGENCY, 20)
  if (hits.length === 0) return []
  const code = hits.length >= 5 ? 'C7.urgency_many' : hits.length >= 3 ? 'C7.urgency_some' : 'C7.urgency_few'
  return [mk({
    check: 'C7', code, severity: hits.length >= 3 ? 'medium' : 'low',
    title: `Pressure or urgency wording (${hits.length} phrase${hits.length > 1 ? 's' : ''})`,
    evidence: hits.map((h) => `"${h}"`).join(', '),
    why: 'Phishing tries to rush you into acting before you think: threats of suspension, deadlines, prizes. Genuine marketing also uses some of these words, so this is a weak signal alone.',
    action: 'Slow down. Real organisations do not mind if you verify through their official app or website first.',
  })]
}
