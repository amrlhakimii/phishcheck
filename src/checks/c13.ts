import type { Context } from '../context'
import type { Finding } from '../types'
import { sameOrg } from '../domain'
import { AUTHORITY_ACRONYMS, AUTHORITY_PREFIXES, AUTHORITY_WORDS, FREEMAIL_DOMAINS } from '../data/keywords'
import { mk } from './util'

/** Returns the authority title found in a display name, or null. */
export function authorityTitle(display: string): string | null {
  const name = display.replace(/[‘’]/g, "'").trim()
  for (const a of AUTHORITY_ACRONYMS) {
    if (new RegExp(`(^|[^A-Za-z0-9])${a}([^A-Za-z0-9]|$)`).test(name)) return a
  }
  const low = ` ${name.toLowerCase().replace(/[^a-z0-9']+/g, ' ')} `
  for (const w of AUTHORITY_WORDS) if (low.includes(` ${w} `)) return w
  const start = `${low.trimStart()}`
  for (const p of AUTHORITY_PREFIXES) if (start.startsWith(`${p} `)) return p
  return null
}

/** C13: executive / authority impersonation (BEC). */
export function c13(ctx: Context): Finding[] {
  const f = ctx.from
  if (!f?.display || !f.domain) return []
  const title = authorityTitle(f.display)
  if (!title) return []
  const free = FREEMAIL_DOMAINS.includes(f.domain.toLowerCase())
  const replyDiff = !!ctx.replyTo?.domain && !sameOrg(ctx.replyTo.domain, f.domain)
  if (!free && !replyDiff) return []
  const reason = free && replyDiff
    ? `the address is on a free-mail provider (${f.domain}) and Reply-To goes to ${ctx.replyTo?.domain}`
    : free ? `the address is on a free-mail provider (${f.domain})` : `Reply-To goes to ${ctx.replyTo?.domain}, not ${f.domain}`
  return [mk({
    check: 'C13', code: 'C13.authority_freemail', severity: 'high',
    title: 'Display name claims an executive or authority role, but the address does not back it up',
    evidence: `Display name "${f.display}" (title: ${title}); ${reason}.`,
    why: 'Fraudsters pose as a boss, finance or HR to make staff act quickly without checking (business email compromise). A senior person normally writes from the company\'s own domain, and the display name is free text anyone can type.',
    action: 'Do not act on the request. Contact the person using a phone number or chat you already have, not by replying. Tell your IT / security team and finance team.',
  })]
}
