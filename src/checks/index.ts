import type { Context } from '../context'
import type { Finding } from '../types'
import { c1 } from './c1'
import { c2 } from './c2'
import { c3 } from './c3'
import { c4 } from './c4'
import { c5 } from './c5'
import { c6 } from './c6'
import { c7 } from './c7'
import { c8 } from './c8'
import { c9 } from './c9'
import { c10 } from './c10'
import { c11 } from './c11'
import { c12 } from './c12'

export const CHECKS: { id: string; name: string; run: (ctx: Context) => Finding[] }[] = [
  { id: 'C1', name: 'Authentication results', run: c1 },
  { id: 'C2', name: 'Sender mismatch', run: c2 },
  { id: 'C3', name: 'Display-name spoofing', run: c3 },
  { id: 'C4', name: 'Lookalike domains', run: c4 },
  { id: 'C5', name: 'Link text mismatch', run: c5 },
  { id: 'C6', name: 'Link hygiene', run: c6 },
  { id: 'C7', name: 'Urgency wording', run: c7 },
  { id: 'C8', name: 'Credential / payment requests', run: c8 },
  { id: 'C9', name: 'Attachment risk', run: c9 },
  { id: 'C10', name: 'Header anomalies', run: c10 },
  { id: 'C11', name: 'Tracking and hidden content', run: c11 },
]

export { c12 }

export function runAllChecks(ctx: Context): Finding[] {
  const found = CHECKS.flatMap((c) => c.run(ctx))
  return [...found, ...c12(ctx, found)]
}
