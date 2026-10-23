import type { Context } from '../context'
import type { Finding } from '../types'
import { mk } from './util'

/** C11: tracking pixels, hidden text, many remote images. Static analysis only; images are never loaded. */
export function c11(ctx: Context): Finding[] {
  const out: Finding[] = []
  const h = ctx.html
  if (!h) return out
  const pixels = h.images.filter((i) => {
    const w = i.width.replace(/px$/i, '')
    const ht = i.height.replace(/px$/i, '')
    return i.hidden || ((w === '1' || w === '0') && (ht === '1' || ht === '0'))
  })
  if (pixels.length) {
    out.push(mk({ check: 'C11', code: 'C11.pixel', severity: 'low', title: 'Tracking pixel (1x1 or hidden image)',
      evidence: pixels.slice(0, 3).map((p) => p.src.slice(0, 90) || '(no src)').join(' , '),
      why: 'Invisible images tell the sender that you opened the message (and your IP address) once the image loads. PhishCheck never loads images. Newsletters do this too.',
      action: 'Turn off automatic image loading in your mail app.' }))
  }
  if (h.hiddenText.length) {
    out.push(mk({ check: 'C11', code: 'C11.hidden_text', severity: 'medium', title: 'Hidden text in the HTML',
      evidence: h.hiddenText.slice(0, 2).map((t) => `"${t.slice(0, 80)}"`).join(' , '),
      why: 'Text hidden with CSS (size 0, white on white, display:none) is used to fool spam filters by padding the message with innocent words.',
      action: 'Weigh with other findings; some email templates hide a preview line harmlessly.' }))
  }
  const remote = h.images.filter((i) => /^https?:\/\//i.test(i.src))
  if (remote.length > 10) {
    out.push(mk({ check: 'C11', code: 'C11.many_images', severity: 'low', title: `Many remote images (${remote.length})`, evidence: `${remote.length} images hosted elsewhere.`,
      why: 'Mostly image-based messages can evade text scanners. Marketing mail is often image heavy as well.', action: 'Do not enable image loading.' }))
  }
  return out
}
