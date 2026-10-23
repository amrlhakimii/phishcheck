import { describe, expect, it } from 'vitest'
import { parseEmail } from '../src/parse'
import { LIMITS } from '../src/parse/limits'
import { mail, BASE_HEADERS } from './helpers'

const parse = (raw: string) => {
  const r = parseEmail(raw)
  if (!r.ok) throw new Error(r.message)
  return r.email
}

describe('MIME', () => {
  it('parses a simple text/plain message', () => {
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'text/plain' }, 'hello there'))
    expect(e.plain).toBe('hello there')
  })
  it('decodes quoted-printable and base64 bodies', () => {
    const qp = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Transfer-Encoding': 'quoted-printable' }, 'caf=C3=A9 =\nok'))
    expect(qp.plain).toBe('café ok')
    const b = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Transfer-Encoding': 'base64' }, btoa('plain base64 body')))
    expect(b.plain).toBe('plain base64 body')
  })
  it('handles nested multipart (mixed > alternative) and lists attachments', () => {
    const body = [
      '--outer', 'Content-Type: multipart/alternative; boundary="inner"', '',
      '--inner', 'Content-Type: text/plain', '', 'plain part', '--inner', 'Content-Type: text/html', '', '<p>html part</p>', '--inner--', '',
      '--outer', 'Content-Type: application/pdf; name="a.pdf"', 'Content-Disposition: attachment; filename="a.pdf"', 'Content-Transfer-Encoding: base64', '', 'QUJD', '--outer--', '',
    ].join('\n')
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'multipart/mixed; boundary=outer' }, body))
    expect(e.plain).toBe('plain part')
    expect(e.html).toContain('html part')
    expect(e.attachments).toEqual([expect.objectContaining({ filename: 'a.pdf', contentType: 'application/pdf' })])
  })
  it('treats a missing boundary parameter as plain text with a warning', () => {
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'multipart/mixed' }, 'just text'))
    expect(e.plain).toContain('just text')
    expect(e.warnings.join(' ')).toMatch(/boundary/i)
  })
  it('handles a declared boundary that never appears', () => {
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'multipart/mixed; boundary="nope"' }, 'no delimiters here'))
    expect(e.plain).toContain('no delimiters here')
    expect(e.warnings.join(' ')).toMatch(/never found/i)
  })
  it('tolerates an unterminated final part', () => {
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'multipart/mixed; boundary=b' }, '--b\nContent-Type: text/plain\n\ncut off'))
    expect(e.plain).toContain('cut off')
  })
  it('stops at the MIME depth limit', () => {
    let inner = '--b0\nContent-Type: text/plain\n\ndeep\n--b0--'
    for (let i = 1; i < LIMITS.maxMimeDepth + 5; i++) {
      inner = `--b${i}\nContent-Type: multipart/mixed; boundary="b${i - 1}"\n\n${inner}\n--b${i}--`
    }
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': `multipart/mixed; boundary="b${LIMITS.maxMimeDepth + 4}"` }, inner))
    expect(e.warnings.join(' ')).toMatch(/nesting/i)
  })
  it('caps the number of parts', () => {
    const parts = Array.from({ length: LIMITS.maxParts + 50 }, (_, i) => `--b\nContent-Type: text/plain\n\npart ${i}`).join('\n') + '\n--b--'
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'multipart/mixed; boundary=b' }, parts))
    expect(e.texts.length).toBeLessThanOrEqual(LIMITS.maxParts)
  })
  it('truncates huge parts without blowing up', () => {
    const big = 'A'.repeat(Math.floor(LIMITS.maxPartBytes * 1.3))
    const t0 = performance.now()
    const e = parse(mail({ ...BASE_HEADERS, 'Content-Type': 'text/plain', 'Content-Transfer-Encoding': 'base64' }, btoa(big)))
    expect(e.plain.length).toBeLessThanOrEqual(LIMITS.maxPartBytes)
    expect(e.warnings.join(' ')).toMatch(/truncated/i)
    expect(performance.now() - t0).toBeLessThan(3000)
  })
  it('rejects input over 2 MB', () => {
    const r = parseEmail('Subject: x\nFrom: a@example.com\n\n' + 'x'.repeat(LIMITS.maxInput + 1))
    expect(r).toMatchObject({ ok: false, reason: 'too-large' })
  })
  it('reports empty and non-email input gracefully', () => {
    expect(parseEmail('   ')).toMatchObject({ ok: false, reason: 'empty' })
    expect(parseEmail('hello, this is just a paragraph of text\nwith two lines')).toMatchObject({ ok: false, reason: 'not-email' })
    expect(parseEmail('{"json": true}')).toMatchObject({ ok: false, reason: 'not-email' })
  })
  it('does not hang on pathological input', () => {
    const t0 = performance.now()
    parseEmail(mail(BASE_HEADERS, '='.repeat(500_000) + '\n' + '<'.repeat(100_000)))
    parseEmail(mail({ ...BASE_HEADERS, 'Content-Type': 'multipart/mixed; boundary=b' }, '--b\n'.repeat(50_000)))
    parseEmail('Subject: ' + ' '.repeat(300_000) + 'x\nFrom: a@example.com\n\nbody')
    expect(performance.now() - t0).toBeLessThan(5000)
  })
  it('handles CRLF input identically', () => {
    const e = parse(mail(BASE_HEADERS, 'line1\nline2').replace(/\n/g, '\r\n'))
    expect(e.plain).toBe('line1\nline2')
  })
})
