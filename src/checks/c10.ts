import type { Context } from '../context'
import type { Finding } from '../types'
import { getFirst } from '../parse/headers'
import { mk } from './util'
import { formatDelay } from '../received'

const DAY = 86400_000

/** C10: header anomalies. */
export function c10(ctx: Context): Finding[] {
  const out: Finding[] = []
  if (!getFirst(ctx.email.headers, 'message-id')) {
    out.push(mk({ check: 'C10', code: 'C10.no_message_id', severity: 'low', title: 'Missing Message-ID', evidence: 'No Message-ID header.',
      why: 'Mail servers and normal mail software always add a Message-ID. Crude bulk-mail tools sometimes do not.', action: 'Minor on its own; weigh with other findings.' }))
  }
  const dh = getFirst(ctx.email.headers, 'date')
  if (!dh || ctx.dateMs === null) {
    out.push(mk({ check: 'C10', code: 'C10.bad_date', severity: 'low', title: dh ? 'Date header could not be read' : 'Missing Date header', evidence: dh ? dh.raw.slice(0, 80) : 'No Date header.',
      why: 'Every genuine message has a parseable Date.', action: 'Minor on its own.' }))
  } else {
    const first = ctx.hops.find((h) => h.timestamp !== null)?.timestamp ?? null
    if (ctx.dateMs - ctx.now > 2 * DAY) {
      out.push(mk({ check: 'C10', code: 'C10.bad_date', severity: 'low', title: 'Date is in the future', evidence: dh.raw, why: 'A date well ahead of now is a forging artefact (or a wrong clock).', action: 'Minor on its own.' }))
    } else if (ctx.now - ctx.dateMs > 3650 * DAY) {
      out.push(mk({ check: 'C10', code: 'C10.bad_date', severity: 'low', title: 'Date is more than 10 years in the past', evidence: dh.raw, why: 'An implausibly old date is a forging artefact.', action: 'Minor on its own.' }))
    } else if (first !== null && Math.abs(first - ctx.dateMs) > 30 * DAY) {
      out.push(mk({ check: 'C10', code: 'C10.bad_date', severity: 'low', title: 'Date header disagrees with the first Received hop',
        evidence: `Date: ${dh.raw}; first hop: ${ctx.hops.find((h) => h.timestamp !== null)?.dateText}`, why: 'The claimed send date and the first server timestamp should be within minutes of each other.', action: 'Minor on its own.' }))
    }
  }
  const back = ctx.hops.filter((h) => h.delaySec !== null && h.delaySec < -120)
  if (back.length) {
    out.push(mk({ check: 'C10', code: 'C10.received_order', severity: 'low', title: 'Received timestamps go backwards',
      evidence: back.slice(0, 3).map((h) => `hop ${h.index} is ${formatDelay(h.delaySec)} vs previous`).join('; '),
      why: 'Each server stamps the time it handled the message, so times should increase along the chain. A decrease suggests forged headers or badly set clocks.', action: 'Minor on its own.' }))
  }
  const slow = ctx.hops.filter((h) => h.delaySec !== null && h.delaySec > DAY / 1000)
  if (slow.length) {
    out.push(mk({ check: 'C10', code: 'C10.received_delay', severity: 'low', title: 'Very long delay between hops',
      evidence: slow.slice(0, 3).map((h) => `hop ${h.index}: ${formatDelay(h.delaySec)}`).join('; '),
      why: 'Normal delivery takes seconds. Day-long gaps can be queued mail or an inserted fake hop.', action: 'Minor on its own.' }))
  }
  return out
}
