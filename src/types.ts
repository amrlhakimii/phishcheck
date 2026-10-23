export type Severity = 'high' | 'medium' | 'low' | 'info' | 'good'

export interface Finding {
  /** Unique within a result, e.g. "C4.homoglyph:0" */
  id: string
  /** Check id, C1..C12 or DNS */
  check: string
  /** Weight code that appears in the "How the score works" table */
  code: string
  severity: Severity
  title: string
  /** What we saw. Always defanged. */
  evidence: string
  why: string
  action: string
  /** Points contributed (negative for good signs). */
  points: number
}
