import { describe, expect, it } from 'vitest'
import { analyze, type AnalysisResult } from '../src/analyze'
import { SAMPLES } from '../src/samples'
import { bandFor, computeScore } from '../src/score'
import { BANDS, CHECK_CAPS, WEIGHTS, weight } from '../src/weights'
import { buildReport } from '../src/report'
import { NOW } from './helpers'
import type { Finding } from '../src/types'

const run = (id: string): AnalysisResult => {
  const r = analyze(SAMPLES.find((s) => s.id === id)!.raw, NOW)
  if (!r.ok) throw new Error(r.message)
  return r
}

describe('verdict bands', () => {
  it.each([[0, 'Looks fine'], [24, 'Looks fine'], [25, 'Be careful'], [49, 'Be careful'], [50, 'Suspicious'], [74, 'Suspicious'], [75, 'Likely phishing'], [100, 'Likely phishing']])('score %i is %s', (s, label) => {
    expect(bandFor(s).label).toBe(label)
  })
  it('bands cover 0-100 without gaps', () => {
    for (let i = 0; i <= 100; i++) expect(BANDS.filter((b) => i >= b.min && i <= b.max)).toHaveLength(1)
  })
})

describe('score arithmetic', () => {
  const f = (check: string, points: number): Finding => ({ id: check + points, check, code: 'x', severity: 'high', title: 't', evidence: '', why: '', action: '', points })
  it('applies per-check caps, clamps at 0 and 100', () => {
    expect(computeScore([f('C7', 50)]).score).toBe(CHECK_CAPS.C7)
    expect(computeScore([f('C12', -15)]).score).toBe(0)
    expect(computeScore(Object.keys(CHECK_CAPS).map((k) => f(k, 99))).score).toBe(100)
  })
  it('subtracts good signs (capped) from the total', () => {
    expect(computeScore([f('C4', 30), f('C12', -15), f('C12', -10)]).score).toBe(10)
  })
  it('every weight code is unique and used checks have caps', () => {
    expect(new Set(WEIGHTS.map((w) => w.code)).size).toBe(WEIGHTS.length)
    for (const w of WEIGHTS) if (w.points > 0) expect(CHECK_CAPS[w.check], w.code).toBeGreaterThan(0)
    expect(() => weight('nope')).toThrow()
  })
})

describe('sample emails land in the expected bands', () => {
  it('obvious phish >= 75, Likely phishing, 4+ distinct findings, top 3 reasons', () => {
    const r = run('phish')
    expect(r.score.score).toBeGreaterThanOrEqual(75)
    expect(r.score.band.label).toBe('Likely phishing')
    expect(new Set(r.findings.map((x) => x.check)).size).toBeGreaterThanOrEqual(4)
    expect(r.findings.filter((x) => x.points > 0).length).toBeGreaterThanOrEqual(4)
    expect(r.score.topReasons).toHaveLength(3)
  })
  it('lookalike-domain phish >= 50 and flagged as a lookalike', () => {
    const r = run('lookalike')
    expect(r.score.score).toBeGreaterThanOrEqual(50)
    expect(r.findings.map((x) => x.code)).toEqual(expect.arrayContaining(['C4.homoglyph', 'C5.mismatch', 'C8.credentials']))
    // authentication passes but must NOT earn "good signs" for a lookalike
    expect(r.findings.some((x) => x.severity === 'good')).toBe(false)
  })
  it('legitimate newsletter < 25 with good signs', () => {
    const r = run('newsletter')
    expect(r.score.score).toBeLessThan(25)
    expect(r.score.band.label).toBe('Looks fine')
    expect(r.findings.filter((x) => x.severity === 'good').length).toBeGreaterThan(0)
  })
  it('phish sample: header explainer chain is ordered with per-hop delays (A5)', () => {
    const r = run('phish')
    expect(r.ctx.hops.map((h) => h.index)).toEqual([1, 2, 3])
    expect(r.ctx.hops[0].from).toBe('[10.0.0.5]')
    expect(r.ctx.hops.map((h) => h.delaySec)).toEqual([null, 616, 2])
  })
  it('A3: mismatching link shown defanged', () => {
    const r = run('phish')
    const l = r.ctx.links.find((x) => x.text.startsWith('www.maybank2u'))!
    expect(l.flags).toContain('text-mismatch')
    expect(l.defanged).toBe('hxxp[://]203[.]0[.]113[.]45/m2u/login[.]php?session=expired')
  })
  it('decodes encoded-word headers in samples', () => {
    expect(run('phish').ctx.subject).toContain('Akaun anda akan digantung')
    expect(run('phish').ctx.from?.display).toBe('Maybank Security')
  })
})

describe('sample hygiene (SR-6)', () => {
  const all = SAMPLES.map((s) => s.raw).join('\n')
  it('uses only reserved domains in addresses and URLs', () => {
    const hosts = [...all.matchAll(/[@/.]([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:[a-z]{2,}))\b/gi)].map((m) => m[1].toLowerCase())
    const ok = (h: string) => /(^|\.)(example\.(com|net|org)|[a-z0-9-]+\.test|invalid)$/.test(h) || /^(rnicrosoft)\.test$/.test(h)
    const bad = [...new Set(hosts.filter((h) => !ok(h) && !/\.(php|gif|png|exe|pdf|html)$/.test(h)))]
    // Display-text in the phish deliberately shows a *target* brand domain as link text.
    expect(bad.filter((h) => !['maybank2u.com.my', 'account.microsoft.com', 'microsoft.com'].includes(h))).toEqual([])
  })
  it('uses only documentation IP ranges', () => {
    for (const m of all.matchAll(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g)) {
      const ip = m[0]
      expect(/^(203\.0\.113|198\.51\.100|10\.0\.0)\./.test(ip), ip).toBe(true)
    }
  })
})

describe('report export (A6)', () => {
  it.each(['phish', 'lookalike', 'newsletter'])('%s report has verdict, score, findings and only defanged IOCs', (id) => {
    const r = run(id)
    const md = buildReport(r)
    expect(md).toContain(`**Verdict:** ${r.score.band.label}`)
    expect(md).toContain(`**Score:** ${r.score.score}/100`)
    expect(md).toContain('## Findings')
    expect(md).toContain('## Indicators of compromise (defanged)')
    expect(md).not.toMatch(/https?:\/\//i)
    expect(md).not.toMatch(/[A-Za-z0-9._-]+@[A-Za-z0-9-]+\./) // no live email address
    expect(md).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/) // no live IPv4
    expect(md).not.toMatch(/\b[a-z0-9-]+\.(com|net|org|test|my)\b/i) // no live domain
  })
  it('does not include the raw message body', () => {
    const md = buildReport(run('phish'))
    expect(md).not.toContain('Salam pelanggan')
  })
})
