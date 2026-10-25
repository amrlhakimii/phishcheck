import type { Finding } from '../types'
import { mk } from './util'

const LOOKALIKE = ['C4.homoglyph', 'C4.idn_homoglyph', 'C4.typosquat', 'C4.brand_in_domain', 'C4.brand_other_domain']

/** Combination bonuses: independent signals that together are the classic shape of a phish. Shown as their own rows. */
export function combo(others: Finding[]): Finding[] {
  const has = (p: (c: string) => boolean) => others.some((f) => f.points > 0 && p(f.code))
  const out: Finding[] = []
  if (has((c) => c === 'C3.brand_in_name') && has((c) => LOOKALIKE.includes(c)) && has((c) => c === 'C5.mismatch')) {
    out.push(mk({ check: 'COMBO', code: 'COMBO.brand_spoof', severity: 'high', title: 'Brand impersonation: name, domain and link text all point the same way',
      evidence: 'A brand in the display name, a look-alike or brand-embedded domain, and link text that hides the real destination.',
      why: 'Each sign can be innocent alone. All three together is the standard pattern of a fake bank or brand message.',
      action: 'Do not click or reply. Go to the brand\'s own website or app by typing the address yourself.' }))
  }
  if (has((c) => c === 'C13.authority_freemail') && has((c) => c.startsWith('C14.'))) {
    out.push(mk({ check: 'COMBO', code: 'COMBO.exec_payment', severity: 'high', title: 'Executive impersonation together with a payment, gift-card or secrecy request',
      evidence: 'An authority title on an unmatched address, plus wording asking for money, gift cards or secrecy.',
      why: 'This is the textbook business email compromise scam: a fake boss asks for something quick and private.',
      action: 'Call the real person on a known number before doing anything, and alert your finance and IT teams.' }))
  }
  return out
}
