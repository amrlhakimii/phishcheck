import { Budget } from './parse/limits'
import { parseEmail, type ParsedEmail } from './parse'
import { buildContext, type Context } from './context'
import { runAllChecks } from './checks'
import { computeScore, type ScoreResult } from './score'
import type { Finding } from './types'

export interface AnalysisResult {
  ok: true
  email: ParsedEmail
  ctx: Context
  findings: Finding[]
  score: ScoreResult
  warnings: string[]
}
export type AnalysisOutcome = AnalysisResult | { ok: false; reason: 'empty' | 'too-large' | 'not-email'; message: string }

export function analyze(raw: string, now: number = Date.now()): AnalysisOutcome {
  const budget = new Budget()
  const parsed = parseEmail(raw, budget)
  if (!parsed.ok) return parsed
  const ctx = buildContext(parsed.email, now)
  const findings = runAllChecks(ctx)
  const warnings = [...parsed.email.warnings]
  if (budget.check()) warnings.push('Analysis time limit reached; results may be incomplete.')
  return { ok: true, email: parsed.email, ctx, findings, score: computeScore(findings), warnings }
}

/** Re-score after adding extra findings (e.g. optional DNS results). */
export function withExtraFindings(r: AnalysisResult, extra: Finding[]): AnalysisResult {
  const findings = [...r.findings, ...extra]
  return { ...r, findings, score: computeScore(findings) }
}
