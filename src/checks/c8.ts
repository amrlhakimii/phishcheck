import type { Context } from '../context'
import type { Finding } from '../types'
import { CREDENTIALS, PAYMENT_PUSH, findPhrases } from '../data/keywords'
import { mk } from './util'

/** C8: credential or payment requests. */
export function c8(ctx: Context): Finding[] {
  const out: Finding[] = []
  const text = `${ctx.subject}\n${ctx.bodyText}`
  const cred = findPhrases(text, CREDENTIALS, 12)
  if (cred.length) {
    out.push(mk({ check: 'C8', code: 'C8.credentials', severity: 'high', title: 'Asks for passwords, codes or card / bank details',
      evidence: cred.map((h) => `"${h}"`).join(', '),
      why: 'Legitimate organisations never ask you to send or type your password, OTP/TAC or full card number in reply to an email or on a page reached from one.',
      action: 'Never share these. If you already did, change the password, enable MFA and call your bank.' }))
  }
  const pay = findPhrases(text, PAYMENT_PUSH, 8)
  if (pay.length) {
    out.push(mk({ check: 'C8', code: 'C8.payment', severity: 'medium', title: 'Pushes a payment or transfer',
      evidence: pay.map((h) => `"${h}"`).join(', '),
      why: 'Requests to pay immediately, wire money, or buy gift cards are core to invoice fraud and business email compromise.',
      action: 'Confirm any payment request by phone using a number you already have.' }))
  }
  return out
}
