import type { Finding } from './types'
import { BANDS, CHECK_CAPS, GOOD_CAP } from './weights'

export type BandId = (typeof BANDS)[number]['id']
export interface Band { id: BandId; label: string; blurb: string; tone: string }

export interface ScoreResult {
  score: number
  band: Band
  /** Per-check contribution after caps. */
  perCheck: Record<string, number>
  topReasons: Finding[]
}

export function bandFor(score: number): Band {
  const s = Math.max(0, Math.min(100, Math.round(score)))
  const b = BANDS.find((x) => s >= x.min && s <= x.max) ?? BANDS[0]
  return { id: b.id, label: b.label, blurb: b.blurb, tone: b.tone }
}

export function computeScore(findings: Finding[]): ScoreResult {
  const perCheck: Record<string, number> = {}
  for (const f of findings) perCheck[f.check] = (perCheck[f.check] ?? 0) + f.points
  let total = 0
  let good = 0
  for (const [check, pts] of Object.entries(perCheck)) {
    if (pts > 0) {
      const capped = Math.min(pts, CHECK_CAPS[check] ?? 20)
      perCheck[check] = capped
      total += capped
    } else {
      good += pts
    }
  }
  good = Math.max(good, GOOD_CAP)
  const score = Math.max(0, Math.min(100, Math.round(total + good)))
  const topReasons = findings
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
  return { score, band: bandFor(score), perCheck, topReasons }
}
