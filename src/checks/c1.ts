import type { Context } from '../context'
import type { Finding } from '../types'
import { resultFor } from '../auth'
import { mk, DO_NOT_ACT } from './util'

const BAD = new Set(['fail', 'softfail'])

/** C1: Authentication-Results (SPF / DKIM / DMARC). */
export function c1(ctx: Context): Finding[] {
  const out: Finding[] = []
  if (ctx.auth.length === 0) {
    out.push(mk({
      check: 'C1', code: 'C1.missing', severity: 'low', title: 'No SPF / DKIM / DMARC results found',
      evidence: 'No Authentication-Results or Received-SPF header present.',
      why: 'Receiving mail servers normally record whether the sender passed authentication. Pasted partial headers or forwarded copies often lose this, so this is only a weak signal.',
      action: 'Open the original message ("Show original" / "View message source") rather than a forwarded copy and analyse that.',
    }))
    return out
  }
  const spf = resultFor(ctx.auth, 'spf')
  const dkim = resultFor(ctx.auth, 'dkim')
  const dmarc = resultFor(ctx.auth, 'dmarc')
  const line = (r: typeof spf) => (r ? `${r.method}=${r.result}${r.props['smtp.mailfrom'] ? ' smtp.mailfrom=' + r.props['smtp.mailfrom'] : ''}${r.props['header.d'] ? ' header.d=' + r.props['header.d'] : ''}${r.props['header.from'] ? ' header.from=' + r.props['header.from'] : ''}` : '')
  if (dmarc?.result === 'fail') {
    out.push(mk({ check: 'C1', code: 'C1.dmarc_fail', severity: 'high', title: 'DMARC check failed', evidence: line(dmarc),
      why: 'DMARC tells receivers what to do when mail claiming to be from a domain is not properly authenticated by that domain. A fail means the message did not align with the From domain\'s policy, a classic sign of spoofing.',
      action: DO_NOT_ACT }))
  }
  if (spf?.result === 'fail') {
    out.push(mk({ check: 'C1', code: 'C1.spf_fail', severity: 'high', title: 'SPF check failed', evidence: line(spf),
      why: 'SPF lists which servers may send mail for a domain. A fail means the sending server is not on that list, so the message was probably not sent by the domain owner.',
      action: DO_NOT_ACT }))
  } else if (spf?.result === 'softfail') {
    out.push(mk({ check: 'C1', code: 'C1.spf_softfail', severity: 'medium', title: 'SPF softfail', evidence: line(spf),
      why: 'A softfail means the sending server is probably not authorised by the domain (the owner has not asked for outright rejection).',
      action: 'Treat the sender with suspicion and verify through another channel.' }))
  }
  if (dkim && BAD.has(dkim.result)) {
    out.push(mk({ check: 'C1', code: 'C1.dkim_fail', severity: 'high', title: 'DKIM signature failed', evidence: line(dkim),
      why: 'DKIM is a cryptographic signature added by the sending domain. A failed signature means the message was altered or the signature is not valid for the claimed domain.',
      action: DO_NOT_ACT }))
  }
  for (const r of ctx.auth) {
    if (['temperror', 'permerror'].includes(r.result) && ['spf', 'dkim', 'dmarc'].includes(r.method)) {
      out.push(mk({ check: 'C1', code: 'C1.other_error', severity: 'low', title: `${r.method.toUpperCase()} could not be evaluated`, evidence: line(r), suffix: r.method,
        why: 'The receiver could not complete this check (DNS error or a broken record). Misconfiguration is common, but attackers also use throwaway domains with broken records.',
        action: 'Treat as unverified.' }))
    }
  }
  return out
}
