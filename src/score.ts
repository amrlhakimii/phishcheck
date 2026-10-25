import type { Finding } from './types'
import { BANDS, CHECK_CAPS, FLOOR_MIN_POINTS, GOOD_CAP, LOW_RISK_LABEL } from './weights'

export type BandId = (typeof BANDS)[number]['id']
export interface Band { id: BandId; label: string; blurb: string; tone: string }

const CAREFUL = BANDS[1]

export interface ScoreResult {
  score: number
  band: Band
  /** Per-check contribution after caps. */
  perCheck: Record<string, number>
  topReasons: Finding[]
  /** Set when the verdict was raised above the numeric band (see FLOOR_RULES). */
  floorReason?: string
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
  let band = bandFor(score)
  let floorReason: string | undefined
  if (band.id === 'fine') {
    const pos = findings.filter((f) => f.points > 0)
    const checks = new Set(pos.map((f) => f.check))
    const positiveTotal = pos.reduce((n, f) => n + f.points, 0)
    if (pos.some((f) => f.severity === 'high')) floorReason = 'a high-severity finding exists'
    else if (pos.some((f) => f.severity === 'medium' && f.points >= FLOOR_MIN_POINTS)) floorReason = `a medium-severity finding is worth ${FLOOR_MIN_POINTS} or more points`
    else if (positiveTotal >= FLOOR_MIN_POINTS && checks.size >= 2) floorReason = `findings from ${checks.size} different checks add up to ${positiveTotal} points`
    if (floorReason) {
      band = { id: CAREFUL.id, label: CAREFUL.label, blurb: `${CAREFUL.blurb} The score is low, but the verdict is raised because ${floorReason}.`, tone: CAREFUL.tone }
    } else if (pos.some((f) => f.severity === 'medium')) {
      band = { ...band, label: LOW_RISK_LABEL, blurb: 'Only minor indicators were found, but at least one is worth a look in the Findings tab. That is not a guarantee of safety.' }
    }
  }
  return { score, band, perCheck, topReasons, floorReason }
}
