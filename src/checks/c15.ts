import type { Context } from '../context'
import type { Finding } from '../types'
import { QR_ACTION, QR_MENTION, QR_SCAN_VERB } from '../data/keywords'
import { mk } from './util'

/** C15: QR-code (quishing) lures. We never decode the image; we only read the wording around it. */
export function c15(ctx: Context): Finding[] {
  const text = `${ctx.subject}\n${ctx.bodyText}`.toLowerCase().slice(0, 200_000)
  if (!QR_MENTION.test(text) || !QR_SCAN_VERB.test(text) || !QR_ACTION.test(text)) return []
  const hasImage = (ctx.html?.images.length ?? 0) > 0 || ctx.email.attachments.some((a) => a.contentType.toLowerCase().startsWith('image/'))
  if (!hasImage || ctx.links.length > 2) return []
  return [mk({
    check: 'C15', code: 'C15.qr_lure', severity: 'medium', title: 'Asks you to scan a QR code, with an image and almost no links',
    evidence: `Wording asks you to scan a code; the message has an image and ${ctx.links.length} link${ctx.links.length === 1 ? '' : 's'}. PhishCheck does not read or decode the image.`,
    why: 'Attackers put the malicious link inside a QR image so link scanners and this tool see nothing. Scanning with a phone also moves you off the protected work computer onto a personal device.',
    action: 'Do not scan it with a phone. Verify with IT through a channel you already know (phone, chat, ticket system), not by replying. Report the message.',
  })]
}
