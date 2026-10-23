export const LIMITS = {
  /** Maximum accepted input, in characters / bytes. */
  maxInput: 2 * 1024 * 1024,
  maxMimeDepth: 8,
  maxParts: 200,
  maxHeaders: 1000,
  maxHeaderBlock: 512 * 1024,
  /** Decoded bytes kept per text part; the rest is dropped with a warning. */
  maxPartBytes: 1024 * 1024,
  /** Decoded bytes across all parts. */
  maxTotalDecoded: 4 * 1024 * 1024,
  maxLinks: 500,
  maxHtmlDepth: 200,
  /** Cooperative analysis deadline (ms). */
  deadlineMs: 4000,
} as const

export class Budget {
  private readonly end: number
  expired = false
  constructor(ms: number = LIMITS.deadlineMs) {
    this.end = performance.now() + ms
  }
  /** Returns true once the deadline has passed; callers stop work and add a warning. */
  check(): boolean {
    if (!this.expired && performance.now() > this.end) this.expired = true
    return this.expired
  }
}
