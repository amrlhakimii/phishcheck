import type { Context } from '../context'
import type { Finding } from '../types'
import { sameOrg } from '../domain'
import { mk } from './util'

/** C2: From vs Return-Path vs Reply-To (vs Sender) organisation domains. */
export function c2(ctx: Context): Finding[] {
  const out: Finding[] = []
  const from = ctx.from?.domain
  if (!from) return out
  const cmp = (a: typeof ctx.from, label: string, code: string, sev: 'high' | 'medium' | 'low', why: string) => {
    if (a?.domain && !sameOrg(a.domain, from)) {
      out.push(mk({ check: 'C2', code, severity: sev, title: `${label} domain differs from From`, evidence: `From: ${from} / ${label}: ${a.domain}`, why,
        action: 'Be wary: replies or bounces would go somewhere other than the address you see. Verify the sender separately.' }))
    }
  }
  cmp(ctx.replyTo, 'Reply-To', 'C2.replyto_mismatch', 'high',
    'If you reply, your answer goes to a different domain than the one shown in From. Attackers use this to collect replies while looking like a trusted sender.')
  cmp(ctx.returnPath, 'Return-Path', 'C2.returnpath_mismatch', 'medium',
    'The real "envelope" sender differs from the visible From domain. This is normal for bulk-mail services but also typical for spoofed messages; check authentication results too.')
  cmp(ctx.sender, 'Sender', 'C2.sender_mismatch', 'low',
    'The Sender header names a different domain than From. Often benign (mailing lists) but worth a look.')
  return out
}
