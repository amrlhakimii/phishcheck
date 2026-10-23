import type { Context } from '../context'
import type { Finding } from '../types'
import { resultFor } from '../auth'
import { sameOrg } from '../domain'
import { mk } from './util'

/** Aligned = the authenticated domain shares an organisational domain with From. */
function aligned(ctx: Context): { spf: boolean; dkim: boolean; dmarc: boolean } {
  const f = ctx.from?.domain
  const spf = resultFor(ctx.auth, 'spf')
  const dkim = resultFor(ctx.auth, 'dkim')
  const dmarc = resultFor(ctx.auth, 'dmarc')
  const dom = (v?: string) => (v ? v.split('@').pop() ?? '' : '')
  const al = (d: string) => !!f && !!d && sameOrg(d, f)
  return {
    spf: spf?.result === 'pass' && al(dom(spf.props['smtp.mailfrom'] ?? ctx.returnPath?.domain ?? '')),
    dkim: dkim?.result === 'pass' && al(dom(dkim.props['header.d'] ?? dkim.props['header.i'])),
    dmarc: dmarc?.result === 'pass' && (!dmarc.props['header.from'] || al(dom(dmarc.props['header.from']))),
  }
}

/**
 * C12: positive signals. These are suppressed whenever another check found something high severity,
 * because attackers can pass authentication on a domain they own.
 */
export function c12(ctx: Context, others: Finding[]): Finding[] {
  if (others.some((f) => f.severity === 'high' && f.points > 0)) return []
  const out: Finding[] = []
  const a = aligned(ctx)
  const anyFail = ctx.auth.some((r) => ['fail', 'softfail'].includes(r.result) && ['spf', 'dkim', 'dmarc'].includes(r.method))
  if (a.spf && a.dkim && a.dmarc) {
    out.push(mk({ check: 'C12', code: 'C12.all_pass', severity: 'good', title: 'SPF, DKIM and DMARC all pass and align with the From domain',
      evidence: `From domain ${ctx.from?.domain}`, why: 'The sending domain\'s owner authorised this message. This confirms who sent it, not that the content is safe.', action: 'Still check that the domain is the one you expect.' }))
  } else if ((a.spf || a.dkim || a.dmarc) && !anyFail) {
    out.push(mk({ check: 'C12', code: 'C12.partial_pass', severity: 'good', title: 'Some authentication passes and aligns with the From domain',
      evidence: [a.spf && 'SPF', a.dkim && 'DKIM', a.dmarc && 'DMARC'].filter(Boolean).join(', ') + ' pass', why: 'Partial evidence the From domain is genuine.', action: 'Check the remaining results in the Headers tab.' }))
  }
  const f = ctx.from?.domain
  const consistent = !!f && (!ctx.returnPath?.domain || sameOrg(ctx.returnPath.domain, f)) && (!ctx.replyTo?.domain || sameOrg(ctx.replyTo.domain, f)) && !!(ctx.returnPath?.domain || ctx.replyTo?.domain)
  if (consistent && !anyFail) {
    out.push(mk({ check: 'C12', code: 'C12.consistent', severity: 'good', title: 'From, Return-Path and Reply-To domains are consistent',
      evidence: `All use ${f}`, why: 'Replies and bounces go to the same organisation that appears as the sender.', action: 'None.' }))
  }
  return out
}
