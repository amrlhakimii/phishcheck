import type { Context } from '../context'
import type { Finding } from '../types'
import { mk } from './util'

/** C5: link text shows one site, href goes to another. */
export function c5(ctx: Context): Finding[] {
  const out: Finding[] = []
  for (const l of ctx.links) {
    if (!l.flags.includes('text-mismatch')) continue
    out.push(mk({
      check: 'C5', code: 'C5.mismatch', severity: 'high', suffix: String(out.length),
      title: 'Link text does not match where the link goes',
      evidence: `Text shows "${l.text.slice(0, 80)}" but the link goes to ${l.host || l.href.slice(0, 80)}`,
      why: 'The visible text of a link is not the destination. Attackers show a trusted address and hide a different one underneath.',
      action: 'Never click. To visit the real site, type its address yourself.',
    }))
  }
  return out
}
